/**
 * Centralized security configuration.
 * All env vars are parsed once at boot and validated.
 */

export interface SecurityConfig {
  jwtSecret: string;
  accessTtl: string;
  refreshTtl: string;
  actionTokenTtl: string;
  cookieDomain: string;
  cookieSecure: boolean;
  cookieSameSite: "lax" | "strict" | "none";
  databaseSslMode: "disable" | "insecure" | "strict";
  nodeEnv: string;
}

function parseDuration(value: string): string {
  const match = value.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  return value;
}

export function resolveSecurityConfig(): SecurityConfig {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }
  if (jwtSecret.length < 43) {
    throw new Error("JWT_SECRET must be at least 43 characters");
  }

  // SSL mode
  let databaseSslMode: SecurityConfig["databaseSslMode"] = "disable";
  if (process.env.DATABASE_SSL_MODE) {
    databaseSslMode = process.env.DATABASE_SSL_MODE as SecurityConfig["databaseSslMode"];
  } else if (process.env.PG_SSL_REJECT_UNAUTHORIZED === "false") {
    databaseSslMode = "insecure";
  } else if (isProduction) {
    databaseSslMode = "strict";
  }

  return {
    jwtSecret,
    accessTtl: parseDuration(process.env.AUTH_ACCESS_TTL || "12h"),
    refreshTtl: parseDuration(process.env.AUTH_REFRESH_TTL || "7d"),
    actionTokenTtl: parseDuration(process.env.ACCOUNT_ACTION_TTL || "24h"),
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN || "",
    cookieSecure: isProduction,
    cookieSameSite: (process.env.AUTH_COOKIE_SAME_SITE as SecurityConfig["cookieSameSite"]) || "lax",
    databaseSslMode,
    nodeEnv,
  };
}

export const securityConfig = resolveSecurityConfig();
