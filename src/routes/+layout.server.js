/** @param {import('@supabase/supabase-js').User | null} user */
function getViewer(user) {
  if (!user) {
    return null;
  }

  const nickname = user.user_metadata?.nickname?.toString().trim();

  return {
    isAuthenticated: true,
    nickname: nickname || null
  };
}

export function load({ locals }) {
  return {
    viewer: getViewer(locals.user)
  };
}
