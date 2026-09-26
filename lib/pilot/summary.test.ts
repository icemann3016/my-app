import { describe, expect, it } from "vitest";

import { credentialLabel } from "./labels";
import { type CredentialItem, pilotSummary } from "./summary";

const TODAY = "2026-09-26";
const item = (p: Partial<CredentialItem>): CredentialItem => ({
  id: Math.random().toString(36),
  kind: "licence",
  status: "verified",
  expiresOn: null,
  ...p,
});

describe("pilotSummary", () => {
  it("needs a verified licence and an unexpired verified medical", () => {
    expect(pilotSummary([], TODAY)).toMatchObject({
      verified: false,
      missing: ["licence", "medical"],
    });
    const s = pilotSummary([item({}), item({ kind: "medical", expiresOn: "2027-06-30" })], TODAY);
    expect(s).toMatchObject({ verified: true, missing: [], pending: 0 });
  });

  it("doesn't count pending or expired items", () => {
    const s = pilotSummary(
      [
        item({ status: "pending" }),
        item({ kind: "medical", expiresOn: "2026-09-01" }),
        item({ kind: "rating", expiresOn: "2026-10-10" }),
        item({ kind: "rating", status: "rejected", expiresOn: "2026-10-01" }),
      ],
      TODAY,
    );
    expect(s.verified).toBe(false);
    expect(s.missing).toEqual(["licence", "medical"]);
    expect(s.pending).toBe(1);
    expect(s.rejected).toBe(1);
    expect(s.expired.map((i) => i.kind)).toEqual(["medical"]);
    expect(s.expiring.map((i) => i.kind)).toEqual(["rating"]); // the rejected one is ignored
  });
});

describe("credentialLabel", () => {
  const t = (key: string, values?: Record<string, string>) =>
    `${key}${values ? JSON.stringify(values) : ""}`;

  it("uses the licence's own wording and translates the rest", () => {
    expect(credentialLabel({ kind: "licence", type: "ppl_a" }, t)).toBe("PPL(A)");
    expect(credentialLabel({ kind: "licence", type: "other" }, t)).toBe("licences.other");
    expect(credentialLabel({ kind: "rating", ratingKind: "class", code: "SEP_LAND" }, t)).toBe(
      "classRatings.SEP_LAND",
    );
    expect(credentialLabel({ kind: "rating", ratingKind: "privilege", code: "NIGHT" }, t)).toBe(
      "privileges.NIGHT",
    );
    expect(credentialLabel({ kind: "rating", ratingKind: "type", code: "C510" }, t)).toBe(
      'ratings.typeLabel{"code":"C510"}',
    );
  });
});
