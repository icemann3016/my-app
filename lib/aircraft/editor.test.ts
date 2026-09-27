import { describe, expect, it } from "vitest";

import { sectionStates } from "./editor";

describe("sectionStates", () => {
  it("marks sections with missing information as to do", () => {
    const s = sectionStates(["model", "price", "photo", "cofa", "arc", "insurance"], []);
    expect(s).toMatchObject({
      details: "todo",
      equipment: "done",
      base: "done",
      pricing: "todo",
      photos: "todo",
      documents: "todo",
      requirements: "done",
    });
  });

  it("shows documents as waiting while they're being checked", () => {
    const docs = [
      { kind: "cofa" as const, status: "verified" },
      { kind: "arc" as const, status: "pending" },
      { kind: "insurance" as const, status: "pending" },
    ];
    expect(sectionStates(["arc", "insurance"], docs).documents).toBe("waiting");
    expect(
      sectionStates(
        ["arc", "insurance"],
        [...docs.slice(0, 2), { kind: "insurance", status: "rejected" }],
      ).documents,
    ).toBe("todo");
    expect(sectionStates([], docs).documents).toBe("done");
  });
});
