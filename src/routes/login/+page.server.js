// @ts-nocheck
import { resolve } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import { createSupabaseServerClient, setAuthCookies } from '$lib/server/supabase';

function getFormValues(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)
  );
}

export const actions = {
  login: async ({ request, cookies, url }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString().trim();
    const password = data.get('password')?.toString();
    const values = getFormValues({ email });

    if (!email || !password) {
      return fail(400, {
        mode: 'login',
        values,
        error: 'Email and password are required.'
      });
    }

    const supabase = createSupabaseServerClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return fail(401, {
        mode: 'login',
        values,
        error: 'Invalid email or password.'
      });
    }

    if (!authData?.session) {
      return fail(500, {
        mode: 'login',
        values,
        error: 'Login succeeded, but Supabase did not return a session.'
      });
    }

    setAuthCookies(cookies, authData.session);

    throw redirect(303, url.searchParams.get('redirectTo') || resolve('/app'));
  },

  signup: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString().trim();
    const password = data.get('password')?.toString();
    const confirm = data.get('confirm')?.toString();
    const country = data.get('country')?.toString().trim();
    const city = data.get('city')?.toString().trim();
    const values = getFormValues({ email, country, city });

    if (!email || !password || !confirm || !country || !city) {
      return fail(400, {
        mode: 'signup',
        values,
        error: 'Email, password, city, and country are all required.'
      });
    }

    if (password !== confirm) {
      return fail(400, {
        mode: 'signup',
        values,
        error: 'Passwords do not match.'
      });
    }

    if (password.length < 8) {
      return fail(400, {
        mode: 'signup',
        values,
        error: 'Password must be at least 8 characters.'
      });
    }

    const supabase = createSupabaseServerClient();
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      return fail(400, {
        mode: 'signup',
        values,
        error: 'Account could not be created. Please review your details and try again.'
      });
    }

    if (authData.user?.id) {
      const { error: locationError } = await supabase.from('c_and_c').upsert(
        {
          id: authData.user.id,
          city,
          country
        },
        { onConflict: 'id' }
      );

      if (locationError) {
        return fail(500, {
          mode: 'signup',
          values,
          error: 'Account was created, but profile details could not be saved yet.'
        });
      }
    }

    return {
      mode: 'signup',
      success: 'Account created. Check your email to confirm your address.'
    };
  },

  forgot: async ({ request, url }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString().trim();
    const values = getFormValues({ email });

    if (!email) {
      return fail(400, {
        mode: 'forgot',
        values,
        error: 'Please enter your email.'
      });
    }

    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${url.origin}${resolve('/reset-password')}`
    });

    if (error) {
      return fail(400, {
        mode: 'forgot',
        values,
        error: 'Reset link could not be sent. Please try again.'
      });
    }

    return {
      mode: 'forgot',
      success: 'Reset link sent. Check your inbox.'
    };
  }
};
