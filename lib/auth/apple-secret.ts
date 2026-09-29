import { createPrivateKey, sign } from "node:crypto";

/** Apple accepts a client secret for at most 6 months; we make a fresh one well before that. */
export const APPLE_SECRET_LIFETIME_SECONDS = 150 * 24 * 60 * 60;

/** A .p8 key pasted into an environment variable: allows quotes and "\n" instead of line breaks. */
export function normalizePrivateKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/**
 * The "client secret" Sign in with Apple wants: a JWT signed (ES256) with the key from the Apple
 * Developer account. See https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
 */
export function appleClientSecret(options: {
  clientId: string; // the Services ID, e.g. eu.ownaplane.signin
  teamId: string;
  keyId: string;
  privateKey: string;
  now?: Date;
}): string {
  const iat = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: options.keyId }));
  const payload = base64url(
    JSON.stringify({
      iss: options.teamId,
      iat,
      exp: iat + APPLE_SECRET_LIFETIME_SECONDS,
      aud: "https://appleid.apple.com",
      sub: options.clientId,
    }),
  );
  const key = createPrivateKey(normalizePrivateKey(options.privateKey));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: "ieee-p1363", // JWTs use raw r||s, not DER
  });
  return `${header}.${payload}.${base64url(signature)}`;
}
