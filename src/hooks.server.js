import { base, resolve as resolvePath } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { clearAuthCookies, getUserFromCookies, setAuthCookies } from '$lib/server/supabase';

/** @param {string} pathname */
function isProtectedPage(pathname) {
  return pathname === '/app' || pathname.startsWith('/app/');
}

/** @param {string} pathname */
function stripBase(pathname) {
  if (base && pathname.startsWith(base)) {
    return pathname.slice(base.length) || '/';
  }

  return pathname;
}

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
  const routePath = stripBase(pathname);
  const isApiRoute = routePath.startsWith('/api/');
  const isProtectedRoute = isProtectedPage(routePath);

  if (!user && !isApiRoute && isProtectedRoute) {
    const redirectTo = `${pathname}${search}`;
    throw redirect(303, resolvePath(`/login?redirectTo=${encodeURIComponent(redirectTo)}`));
  }

  if (user && (routePath === '/' || routePath === '/login')) {
    throw redirect(303, resolvePath('/app'));
  }

  return resolve(event);
}
