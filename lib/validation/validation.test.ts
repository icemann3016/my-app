import { describe, expect, it } from "vitest";

import { changePasswordSchema, signUpSchema } from "./auth";
import { profileSchema } from "./profile";

describe("signUpSchema", () => {
  const valid = {
    displayName: " Alice ",
    email: " Alice@Example.COM ",
    password: "correct-horse",
    terms: "on",
  };

  it("accepts and normalises valid input", () => {
    const r = signUpSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ displayName: "Alice", email: "alice@example.com" });
  });

  it("requires accepting the terms", () => {
    const { terms: _terms, ...withoutTerms } = valid;
    const r = signUpSchema.safeParse(withoutTerms);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Please accept the terms to continue.");
  });

  it("rejects short passwords and bad emails", () => {
    const r = signUpSchema.safeParse({ ...valid, email: "nope", password: "short" });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["email", "password"]));
  });
});

describe("changePasswordSchema", () => {
  it("requires matching passwords", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "old-password",
      password: "long-enough",
      confirm: "different",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});

describe("profileSchema", () => {
  it("upper-cases ICAO codes and turns empty fields into null", () => {
    const r = profileSchema.parse({ displayName: "Bob", homeAirport: " lbsf ", bio: "  " });
    expect(r).toEqual({ displayName: "Bob", homeAirport: "LBSF", bio: null });
  });

  it("rejects codes that are not 4 characters", () => {
    expect(
      profileSchema.safeParse({ displayName: "Bob", homeAirport: "SOF", bio: "" }).success,
    ).toBe(false);
  });
});
