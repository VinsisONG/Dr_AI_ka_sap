import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

const isProduction = process.env.NODE_ENV === 'production';

export function createSupabaseServerClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

/**
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {import('@supabase/supabase-js').Session} session
 */
export function setAuthCookies(cookies, session) {
  cookies.set('sb-access-token', session.access_token, {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
  });

  cookies.set('sb-refresh-token', session.refresh_token, {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  });
}

/** @param {import('@sveltejs/kit').Cookies} cookies */
export function clearAuthCookies(cookies) {
  cookies.delete('sb-access-token', { path: '/' });
  cookies.delete('sb-refresh-token', { path: '/' });
}

/** @param {import('@sveltejs/kit').Cookies} cookies */
export async function getUserFromCookies(cookies) {
  const accessToken = cookies.get('sb-access-token');
  const refreshToken = cookies.get('sb-refresh-token');

  if (!accessToken && !refreshToken) {
    return { session: null, user: null };
  }

  const supabase = createSupabaseServerClient();

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (!error && data?.user) {
      return { session: null, user: data.user };
    }
  }

  if (!refreshToken) {
    return { session: null, user: null };
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken
  });

  if (error || !data?.user) {
    return { session: null, user: null };
  }

  return {
    session: data.session ?? null,
    user: data.user
  };
}
