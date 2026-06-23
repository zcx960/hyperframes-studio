import { createHmac, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";

export type AuthScope = "user" | "admin";

const {
  AUTH_SECRET: authSecretEnv,
  USER_PASSWORD: userPasswordEnv,
  ADMIN_PASSWORD: adminPasswordEnv,
} = process.env;

const AUTH_SECRET = authSecretEnv ?? "change-me-auth-secret";

const PASSWORDS: Record<AuthScope, string> = {
  user: userPasswordEnv ?? "change-me-user",
  admin: adminPasswordEnv ?? "change-me-admin",
};

export const LoginSchema = z.object({
  scope: z.enum(["user", "admin"]),
  password: z.string(),
});

export function checkPassword(scope: AuthScope, password: string): boolean {
  return safeEqual(password, PASSWORDS[scope]);
}

/** A scope token is an HMAC over the scope — opaque proof the password was known. */
export function tokenFor(scope: AuthScope): string {
  return createHmac("sha256", AUTH_SECRET).update(scope).digest("hex");
}

/** True when the token matches one of the given scopes. */
export function isValidToken(token: string, scopes: readonly AuthScope[]): boolean {
  return scopes.some((scope) => safeEqual(token, tokenFor(scope)));
}

/** Require a valid bearer token for one of the given scopes. */
export function requireAuth(scopes: readonly AuthScope[]): MiddlewareHandler {
  return async (context, next) => {
    const token = (context.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!isValidToken(token, scopes)) {
      return context.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
