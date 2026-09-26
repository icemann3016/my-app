import { describe, expect, it } from "vitest";

import { loginErrorKey } from "./errors";

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
