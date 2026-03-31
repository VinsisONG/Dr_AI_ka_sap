// @ts-nocheck
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
        error: error.message || 'Invalid email or password.'
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

    throw redirect(303, url.searchParams.get('redirectTo') || '/');
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          city,
          country
        }
      }
    });

    if (error) {
      return fail(400, {
        mode: 'signup',
        values,
        error: error.message
      });
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
      redirectTo: `${url.origin}/reset-password`
    });

    if (error) {
      return fail(400, {
        mode: 'forgot',
        values,
        error: error.message
      });
    }

    return {
      mode: 'forgot',
      success: 'Reset link sent. Check your inbox.'
    };
  }
};
