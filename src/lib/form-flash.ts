type FlashPayload = {
  values?: Record<string, string>;
  errors?: Record<string, string>;
};

const COOKIE_PREFIX = 'gh_form_flash_';

const toCookieName = (scope: string) => `${COOKIE_PREFIX}${scope.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}`;

const encode = (payload: FlashPayload) => {
  const json = JSON.stringify(payload || {});
  return Buffer.from(json, 'utf-8').toString('base64url');
};

const decode = (raw?: string | null): FlashPayload => {
  if (!raw) return {};
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as FlashPayload;
    return {
      values: parsed?.values && typeof parsed.values === 'object' ? parsed.values : {},
      errors: parsed?.errors && typeof parsed.errors === 'object' ? parsed.errors : {}
    };
  } catch {
    return {};
  }
};

export const writeFormFlash = (cookies: any, scope: string, payload: FlashPayload) => {
  const name = toCookieName(scope);
  cookies.set(name, encode(payload), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 10
  });
};

export const readFormFlash = (cookies: any, scope: string): FlashPayload => {
  const name = toCookieName(scope);
  const raw = cookies.get(name)?.value || null;
  return decode(raw);
};

export const clearFormFlash = (cookies: any, scope: string) => {
  const name = toCookieName(scope);
  cookies.set(name, '', { path: '/', maxAge: 0 });
};
