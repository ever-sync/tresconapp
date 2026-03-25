import { cookies } from "next/headers";
import { securityConfig } from "@/config/security";
import { durationToMs } from "./auth-tokens";

const STAFF_ACCESS_COOKIE = "tc_staff_at";
const STAFF_REFRESH_COOKIE = "tc_staff_rt";
const CLIENT_ACCESS_COOKIE = "tc_client_at";
const CLIENT_REFRESH_COOKIE = "tc_client_rt";

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
  domain?: string;
}

function baseCookieOptions(maxAgeMs: number): CookieOptions {
  const opts: CookieOptions = {
    httpOnly: true,
    secure: securityConfig.cookieSecure,
    sameSite: securityConfig.cookieSameSite,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
  if (securityConfig.cookieDomain) {
    opts.domain = securityConfig.cookieDomain;
  }
  return opts;
}

// ── Staff cookies ──────────────────────────────────────────

export async function setStaffCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_ACCESS_COOKIE, accessToken, baseCookieOptions(durationToMs(securityConfig.accessTtl)));
  cookieStore.set(STAFF_REFRESH_COOKIE, refreshToken, baseCookieOptions(durationToMs(securityConfig.refreshTtl)));
}

export async function clearStaffCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_ACCESS_COOKIE);
  cookieStore.delete(STAFF_REFRESH_COOKIE);
}

export async function getStaffAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(STAFF_ACCESS_COOKIE)?.value;
}

export async function getStaffRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(STAFF_REFRESH_COOKIE)?.value;
}

// ── Client cookies ─────────────────────────────────────────

export async function setClientCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_ACCESS_COOKIE, accessToken, baseCookieOptions(durationToMs(securityConfig.accessTtl)));
  cookieStore.set(CLIENT_REFRESH_COOKIE, refreshToken, baseCookieOptions(durationToMs(securityConfig.refreshTtl)));
}

export async function clearClientCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(CLIENT_ACCESS_COOKIE);
  cookieStore.delete(CLIENT_REFRESH_COOKIE);
}

export async function getClientAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CLIENT_ACCESS_COOKIE)?.value;
}

export async function getClientRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CLIENT_REFRESH_COOKIE)?.value;
}
