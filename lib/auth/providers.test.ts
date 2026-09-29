import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { enabledProviders, isSocialProvider, socialProviderOptions } from "./providers";

const pem = generateKeyPairSync("ec", { namedCurve: "P-256" })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

const apple = {
  APPLE_CLIENT_ID: "eu.ownaplane.signin",
  APPLE_TEAM_ID: "TEAM123456",
  APPLE_KEY_ID: "KEY1234567",
};

function setEnv(values: Record<string, string>) {
  for (const name of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "APPLE_CLIENT_ID",
    "APPLE_TEAM_ID",
    "APPLE_KEY_ID",
    "APPLE_PRIVATE_KEY",
    "FACEBOOK_CLIENT_ID",
    "FACEBOOK_CLIENT_SECRET",
  ]) {
    vi.stubEnv(name, values[name] ?? "");
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("social providers", () => {
  it("shows no buttons without keys", () => {
    setEnv({});
    expect(enabledProviders()).toEqual([]);
    expect(socialProviderOptions()).toEqual({});
  });

  it("turns each provider on only when all its keys are set", () => {
    setEnv({ GOOGLE_CLIENT_ID: "g", FACEBOOK_CLIENT_ID: "f", ...apple });
    expect(enabledProviders()).toEqual([]);
    setEnv({
      GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "gs",
      FACEBOOK_CLIENT_ID: "f",
      FACEBOOK_CLIENT_SECRET: "fs",
      ...apple,
      APPLE_PRIVATE_KEY: pem,
    });
    expect(enabledProviders()).toEqual(["google", "apple", "facebook"]);
    const options = socialProviderOptions();
    expect(options.google).toEqual({ clientId: "g", clientSecret: "gs" });
    expect(options.facebook).toEqual({ clientId: "f", clientSecret: "fs" });
    expect(options.apple?.clientId).toBe("eu.ownaplane.signin");
    expect(options.apple?.clientSecret.split(".")).toHaveLength(3);
  });

  it("keeps Apple off when its key can't be read", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setEnv({ ...apple, APPLE_PRIVATE_KEY: "not a key" });
    expect(enabledProviders()).toEqual([]);
    expect(socialProviderOptions()).toEqual({});
  });

  it("recognises only known provider names", () => {
    expect(isSocialProvider("apple")).toBe(true);
    expect(isSocialProvider("github")).toBe(false);
    expect(isSocialProvider(null)).toBe(false);
  });
});
