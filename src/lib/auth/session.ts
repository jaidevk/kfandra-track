import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * App-managed session tokens for phone + PIN auth.
 *
 * We do NOT use Supabase Auth. After verifying a PIN server-side (via the
 * service-role admin client), we mint a signed session JWT and store it in an
 * httpOnly cookie. All data access happens in server actions on the service-
 * role client, scoped by the player_id carried here; Supabase RLS is the
 * default-deny backstop. jose is used so the token can also be verified in
 * edge middleware.
 */

export type SessionPayload = {
  /** players.id */
  playerId: string;
  role: "super_admin" | "kfandra" | "admin" | "user";
  name: string;
};

export const SESSION_COOKIE = "jacaranda_session";
// Low-friction persistence: long-lived so players rarely re-enter their PIN.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days

const ALG = "HS256";

function getSessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing env SESSION_SECRET");
  return new TextEncoder().encode(secret);
}

/** Sign a session payload into a JWT valid for SESSION_MAX_AGE_SECONDS. */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    playerId: payload.playerId,
    role: payload.role,
    name: payload.name,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.playerId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionKey());
}

/**
 * Verify and decode a session token. Returns the payload, or null when the
 * token is missing, malformed, tampered with, or expired (never throws).
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), {
      algorithms: [ALG],
    });
    return toSessionPayload(payload);
  } catch {
    return null;
  }
}

function toSessionPayload(payload: JWTPayload): SessionPayload | null {
  const { playerId, role, name } = payload as Record<string, unknown>;
  if (typeof playerId !== "string") return null;
  if (
    role !== "super_admin" &&
    role !== "kfandra" &&
    role !== "admin" &&
    role !== "user"
  ) {
    return null;
  }
  return {
    playerId,
    role,
    name: typeof name === "string" ? name : "",
  };
}
