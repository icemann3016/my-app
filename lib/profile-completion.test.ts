import { describe, expect, it } from "vitest";

import { type CompletionInput, profileCompletion } from "./profile-completion";

const empty: CompletionInput = {
  roles: { pilot: false, owner: false },
  profile: { avatarKey: null, homeAirportIdent: null, bio: null },
  phone: null,
  pilot: null,
  aircraft: [],
};

describe("profile completion", () => {
  it("starts with choosing pilot or owner", () => {
    const c = profileCompletion(empty);
    expect(c.todo.map((i) => i.key)).toEqual(["roles", "photo", "home", "bio", "phone"]);
    expect(c.percent).toBe(0);
  });

  it("counts credentials waiting for a check as done, and lists them as waiting", () => {
    const c = profileCompletion({
      ...empty,
      roles: { pilot: true, owner: false },
      profile: { avatarKey: "a", homeAirportIdent: "LBSF", bio: "Hi" },
      phone: "+359 88 123 4567",
      pilot: {
        items: [
          { kind: "licence", status: "pending", expired: false },
          { kind: "medical", status: "rejected", expired: false },
          { kind: "rating", status: "verified", ratingKind: "class", expired: false },
        ],
        hasExperience: false,
      },
    });
    expect(c.todo.map((i) => i.key)).toEqual(["medical", "experience", "rejected"]);
    expect(c.waiting.map((i) => i.key)).toEqual(["pendingCreds"]);
    expect(c.percent).toBe(70); // 7 of 10
  });

  it("turns listing gaps into owner steps, except documents being checked", () => {
    const c = profileCompletion({
      ...empty,
      roles: { pilot: false, owner: true },
      aircraft: [
        {
          id: "a1",
          registration: "LZ-ABC",
          status: "draft",
          gaps: ["photo", "arc", "insurance"],
          pendingKinds: ["arc"],
        },
        { id: "a2", registration: "LZ-XYZ", status: "draft", gaps: [], pendingKinds: [] },
        { id: "a3", registration: "LZ-OK", status: "listed", gaps: [], pendingKinds: [] },
      ],
    });
    const owner = c.todo.filter((i) => i.group === "owner");
    expect(owner.map((i) => [i.label, i.href])).toEqual([
      ["gap.photo", "/owner/aircraft/a1/photos"],
      ["gap.insurance", "/owner/aircraft/a1/documents"],
      ["publish", "/owner/aircraft/a2"],
    ]);
    expect(c.waiting.map((i) => i.label)).toEqual(["pendingDoc.arc"]);
  });

  it("reaches 100% when everything is done", () => {
    const c = profileCompletion({
      ...empty,
      roles: { pilot: false, owner: true },
      profile: { avatarKey: "a", homeAirportIdent: "LBSF", bio: "Hi" },
      phone: "+359 1",
      aircraft: [{ id: "a", registration: "LZ-OK", status: "listed", gaps: [], pendingKinds: [] }],
    });
    expect(c.percent).toBe(100);
    expect(c.todo).toEqual([]);
  });
});
