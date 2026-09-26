import { describe, expect, it } from "vitest";

import { experienceSchema, licenceSchema, medicalSchema, ratingSchema } from "./pilot";

describe("pilot validation", () => {
  const DOC = "0b6d6f7e-3c1a-4d8e-9f1a-2b3c4d5e6f70";

  it("accepts a licence and turns empty dates into null", () => {
    const r = licenceSchema.parse({
      type: "ppl_a",
      issuingState: "BG",
      number: " BG.FCL.123 ",
      issuedOn: "2019-05-01",
      expiresOn: "",
      documentId: DOC,
    });
    expect(r).toMatchObject({ number: "BG.FCL.123", expiresOn: null, documentId: DOC });
  });

  it("needs a scan for licences and medicals, but not for ratings", () => {
    const licence = licenceSchema.safeParse({
      type: "ppl_a",
      issuingState: "BG",
      number: "X",
      issuedOn: "",
      expiresOn: "",
      documentId: "",
    });
    expect(licence.error?.issues[0]).toMatchObject({
      path: ["documentId"],
      message: "documentRequired",
    });
    expect(
      medicalSchema.safeParse({
        class: "class2",
        issuingState: "BG",
        validUntil: "2027-01-01",
        documentId: "",
      }).error?.issues[0]?.message,
    ).toBe("documentRequired");
    expect(
      ratingSchema.parse({ kind: "privilege", code: "night", expiresOn: "", documentId: "" })
        .documentId,
    ).toBeNull();
  });

  it("rejects an expiry before the issue date", () => {
    const r = licenceSchema.safeParse({
      type: "ppl_a",
      issuingState: "BG",
      number: "X",
      issuedOn: "2020-01-01",
      expiresOn: "2019-01-01",
      documentId: DOC,
    });
    expect(r.error?.issues[0]).toMatchObject({ path: ["expiresOn"], message: "expiryBeforeIssue" });
  });

  it("checks rating codes by kind and normalises type designators", () => {
    expect(
      ratingSchema.safeParse({ kind: "class", code: "SEP_LAND", expiresOn: "", documentId: "" })
        .success,
    ).toBe(true);
    expect(
      ratingSchema.safeParse({ kind: "class", code: "C172", expiresOn: "", documentId: "" })
        .success,
    ).toBe(false);
    expect(
      ratingSchema.parse({ kind: "type", code: " pc-12 ", expiresOn: "", documentId: "" }).code,
    ).toBe("PC12");
  });

  it("keeps PIC and recent hours within total hours", () => {
    expect(
      experienceSchema.safeParse({ totalHours: "250", picHours: "200", last90DaysHours: "6" })
        .success,
    ).toBe(true);
    const r = experienceSchema.safeParse({
      totalHours: "100",
      picHours: "150",
      last90DaysHours: "0",
    });
    expect(r.error?.issues[0]).toMatchObject({ path: ["picHours"], message: "hoursMoreThanTotal" });
  });
});
