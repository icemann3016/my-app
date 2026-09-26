import { describe, expect, it } from "vitest";

import { authErrorCode, loginErrorKey } from "./errors";

describe("loginErrorKey", () => {
  it("explains an existing account that isn't linked to Google yet", () => {
    expect(loginErrorKey("account_not_linked")).toBe("accountNotLinked");
  });
  it("treats expired email links as expired", () => {
    expect(loginErrorKey("INVALID_TOKEN")).toBe("linkExpired");
    expect(loginErrorKey("token_expired")).toBe("linkExpired");
  });
  it("reports other Google problems as a failed Google sign-in", () => {
    expect(loginErrorKey("state_mismatch")).toBe("oauthFailed");
  });
  it("returns null without an error", () => {
    expect(loginErrorKey(undefined)).toBeNull();
  });
});

describe("authErrorCode", () => {
  it("reads the code of Better Auth errors, even from a second copy of the library", () => {
    const err = Object.assign(new Error("Invalid email or password"), {
      name: "APIError",
      body: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
    expect(authErrorCode(err)).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect(authErrorCode(new Error("boom"))).toBeUndefined();
    expect(authErrorCode("nope")).toBeUndefined();
  });
});
