// @ts-nocheck
import { resolve } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import { clearAuthCookies, createSupabaseServerClient } from '$lib/server/supabase';

const LOCATION_TABLE = 'c_and_c';

function normalizeSports(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((sport) => sport && typeof sport === 'object')
    .map((sport) => ({
      name: sport.name?.toString().trim() || '',
      regularity: sport.regularity?.toString().trim() || '',
      intensity: sport.intensity?.toString().trim() || ''
    }))
    .filter((sport) => sport.name);
}

function normalizeProblems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => item?.toString().trim()).filter(Boolean);
}

function parseJsonField(raw, fallback = []) {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw.toString());
  } catch {
    return fallback;
  }
}

export async function load({ locals }) {
  const userId = locals.user?.id;

  if (!userId) {
    return {
      profile: {
        sports: [],
        problems: [],
        city: '',
        country: ''
      }
    };
  }

  const supabase = createSupabaseServerClient();

  const [{ data: attributes }, { data: location }] = await Promise.all([
    supabase.from('user_attributes').select('sports, problems').eq('id', userId).maybeSingle(),
    supabase.from(LOCATION_TABLE).select('city, country').eq('id', userId).maybeSingle()
  ]);

  return {
    profile: {
      sports: normalizeSports(attributes?.sports),
      problems: normalizeProblems(attributes?.problems),
      city: location?.city ?? '',
      country: location?.country ?? ''
    }
  };
}

export const actions = {
  saveProfile: async ({ request, locals }) => {
    const userId = locals.user?.id;

    if (!userId) {
      return fail(401, {
        profileError: 'You need to be logged in to save your profile.'
      });
    }

    const formData = await request.formData();
    const sports = normalizeSports(parseJsonField(formData.get('sports')));
    const problems = normalizeProblems(parseJsonField(formData.get('problems')));
    const city = formData.get('city')?.toString().trim() ?? '';
    const country = formData.get('country')?.toString().trim() ?? '';

    const supabase = createSupabaseServerClient();

    const [{ error: attributesError }, { error: locationError }] = await Promise.all([
      supabase.from('user_attributes').upsert(
        {
          id: userId,
          sports,
          problems
        },
        { onConflict: 'id' }
      ),
      supabase.from(LOCATION_TABLE).upsert(
        {
          id: userId,
          city,
          country
        },
        { onConflict: 'id' }
      )
    ]);

    if (attributesError || locationError) {
      const saveError = attributesError || locationError;
      console.error('Profile save failed:', saveError);

      return fail(500, {
        profileError: 'Profile details could not be saved. Please try again.'
      });
    }

    return {
      profileSaved: true
    };
  },

  logout: async ({ cookies }) => {
    clearAuthCookies(cookies);
    throw redirect(303, resolve('/login'));
  }
};
