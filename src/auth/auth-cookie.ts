import type { Request, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'accessToken';

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
type CookieSameSite = 'lax' | 'strict' | 'none';

function maxAgeFromExpiresIn(value: string | undefined): number {
  if (!value) return DEFAULT_MAX_AGE_MS;

  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return DEFAULT_MAX_AGE_MS;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit as keyof typeof multipliers];
}

function sameSiteFromEnv(): CookieSameSite {
  const value = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  return value === 'strict' || value === 'none' ? value : 'lax';
}

export function authCookieOptions() {
  const sameSite = sameSiteFromEnv();

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/',
    maxAge: maxAgeFromExpiresIn(process.env.JWT_EXPIRES_IN),
  };
}

export function setAuthCookie(response: Response, accessToken: string) {
  response.cookie(ACCESS_TOKEN_COOKIE, accessToken, authCookieOptions());
}

export function clearAuthCookie(response: Response) {
  response.clearCookie(ACCESS_TOKEN_COOKIE, {
    ...authCookieOptions(),
    maxAge: undefined,
  });
}

export function getCookieValue(
  cookieHeader: string | string[] | undefined,
  name: string,
): string | undefined {
  const header = Array.isArray(cookieHeader)
    ? cookieHeader.join('; ')
    : cookieHeader;
  if (!header) return undefined;

  const cookies = header.split(';');
  for (const cookie of cookies) {
    const [rawKey, ...rawValue] = cookie.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rawValue.join('='));
  }

  return undefined;
}

export function getAuthTokenFromRequest(request: Request): string | undefined {
  return getCookieValue(request.headers.cookie, ACCESS_TOKEN_COOKIE);
}
