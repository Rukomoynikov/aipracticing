import { setCookie } from "hono/cookie";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(c: Parameters<typeof setCookie>[0]) {
  setCookie(c, SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 0,
    path: "/",
  });
}
