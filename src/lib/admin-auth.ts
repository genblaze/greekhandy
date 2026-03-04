import type { APIContext } from 'astro';

export const ADMIN_COOKIE = 'gh_admin_session';

const getExpectedKey = () => process.env.PROFESSIONAL_MODERATION_KEY || '';

export const isAdminKeyValid = (key: string) => {
  const expected = getExpectedKey();
  return Boolean(expected && key && key === expected);
};

export const getAdminAuth = (context: Pick<APIContext, 'request' | 'cookies'>, fallbackKey = '') => {
  const cookieKey = context.cookies.get(ADMIN_COOKIE)?.value || '';
  const provided = fallbackKey || '';
  const token = cookieKey || provided;
  return {
    expectedKey: getExpectedKey(),
    token,
    isAuthorized: isAdminKeyValid(token)
  };
};
