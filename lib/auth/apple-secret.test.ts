import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  APPLE_SECRET_LIFETIME_SECONDS,
  appleClientSecret,
  normalizePrivateKey,
} from "./apple-secret";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString());

describe("appleClientSecret", () => {
  const now = new Date("2026-09-29T12:00:00Z");
  const secret = appleClientSecret({
    clientId: "eu.ownaplane.signin",
    teamId: "TEAM123456",
    keyId: "KEY1234567",
    privateKey: pem,
    now,
  });
  const [header, payload, signature] = secret.split(".");

  it("is an ES256 JWT for Apple with the team, key and Services ID", () => {
    expect(decode(header!)).toEqual({ alg: "ES256", kid: "KEY1234567" });
    const iat = now.getTime() / 1000;
    expect(decode(payload!)).toEqual({
      iss: "TEAM123456",
      iat,
      exp: iat + APPLE_SECRET_LIFETIME_SECONDS,
      aud: "https://appleid.apple.com",
      sub: "eu.ownaplane.signin",
    });
  });

  it("stays within Apple's 6-month limit", () => {
    expect(APPLE_SECRET_LIFETIME_SECONDS).toBeLessThan(15_777_000);
  });

  it("is signed with the key (raw r||s signature, as JWTs need)", () => {
    const sig = Buffer.from(signature!, "base64url");
    expect(sig).toHaveLength(64);
    const ok = verify(
      "sha256",
      Buffer.from(`${header}.${payload}`),
      {
        key: publicKey,
        dsaEncoding: "ieee-p1363",
      },
      sig,
    );
    expect(ok).toBe(true);
  });
});

describe("normalizePrivateKey", () => {
  it("accepts a key pasted on one line with \\n and quotes", () => {
    const oneLine = `"${pem.trim().replace(/\n/g, "\\n")}"`;
    expect(normalizePrivateKey(oneLine)).toBe(pem.trim());
  });
});
