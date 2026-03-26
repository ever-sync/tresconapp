import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { SignOptions } from "jsonwebtoken";
import { securityConfig } from "@/config/security";

export interface JwtPayload {
  sessionId: string;
  subjectType: "staff" | "client";
  role: string;
  userId?: string;
  clientId?: string;
  accountingId: string;
}

/**
 * Sign a JWT access token.
 */
export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: securityConfig.accessTtl as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, securityConfig.jwtSecret, options);
}

/**
 * Verify and decode a JWT access token.
 * Returns null if invalid/expired.
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, securityConfig.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically random refresh token.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Hash a token with SHA256 for storage.
 * Never store raw tokens in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a random action token (for password reset, invites, etc).
 */
export function generateActionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Parse duration string (e.g., "12h", "7d") to milliseconds.
 */
export function durationToMs(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}
