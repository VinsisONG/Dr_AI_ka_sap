import { redirect } from '@sveltejs/kit';
import { clearAuthCookies, getUserFromCookies, setAuthCookies } from '$lib/server/supabase';

const PUBLIC_PATHS = new Set(['/login', '/reset-password']);

export async function handle({ event, resolve }) {
  const hadAuthCookies =
    Boolean(event.cookies.get('sb-access-token')) || Boolean(event.cookies.get('sb-refresh-token'));

  const { session, user } = await getUserFromCookies(event.cookies);

  event.locals.session = session;
  event.locals.user = user;

  if (session) {
    setAuthCookies(event.cookies, session);
  } else if (!user && hadAuthCookies) {
    clearAuthCookies(event.cookies);
  }

  const { pathname, search } = event.url;
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicRoute = PUBLIC_PATHS.has(pathname);

  if (!user && !isApiRoute && !isPublicRoute) {
    const redirectTo = `${pathname}${search}`;
    throw redirect(303, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  if (user && pathname === '/login') {
    throw redirect(303, '/');
  }

  return resolve(event);
}
