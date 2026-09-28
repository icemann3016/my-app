import { describe, expect, it } from "vitest";

import {
  bookingNotificationEmail,
  credentialReviewedEmail,
  defectReportedEmail,
  expiryReminderEmail,
  resetPasswordEmail,
} from "./templates";

describe("email templates", () => {
  it("writes the email in the user's language", () => {
    const en = resetPasswordEmail({ name: "Ana", url: "https://x/y", locale: "en" });
    const bg = resetPasswordEmail({ name: "Ана", url: "https://x/y", locale: "bg" });
    expect(en.subject).toContain("Reset your");
    expect(bg.subject).toContain("Нулиране на паролата");
    expect(bg.text).toContain("Здравейте, Ана,");
    expect(bg.text).toContain("https://x/y");
  });

  it("falls back to English and escapes names in HTML", () => {
    const email = resetPasswordEmail({ name: "<b>x</b>", url: "https://x", locale: "xx" });
    expect(email.subject).toContain("Reset your");
    expect(email.html).not.toContain("<b>x</b>");
  });
});

describe("pilot credential emails", () => {
  it("tells the pilot why a credential was rejected, in their language", () => {
    const email = credentialReviewedEmail({
      name: "Мария",
      locale: "bg",
      item: { kind: "medical", class: "class2" },
      decision: "reject",
      reason: "Снимката е неясна.",
      url: "https://ownaplane.eu/pilot",
    });
    expect(email.subject).toBe("Не успяхме да потвърдим Медицинско свидетелство (Клас 2)");
    expect(email.text).toContain("Причина: Снимката е неясна.");
    expect(email.text).toContain("https://ownaplane.eu/pilot");
  });

  it("lists everything that expires soon", () => {
    const email = expiryReminderEmail({
      name: "Ana",
      locale: "en",
      items: [
        { ref: { kind: "medical", class: "class2" }, expiresOn: "2026-10-15" },
        { ref: { kind: "rating", ratingKind: "class", code: "SEP_LAND" }, expiresOn: "2026-10-20" },
      ],
      url: "https://ownaplane.eu/pilot",
    });
    expect(email.subject).toBe("Pilot credentials expire soon");
    expect(email.text).toContain("- Class 2 medical: valid until 15 October 2026");
    expect(email.html).toContain("<li>SEP (land): valid until 20 October 2026</li>");
  });

  it("tells the owner about a defect, escaping what the pilot wrote", () => {
    const email = defectReportedEmail({
      name: "Zlati",
      registration: "LZ-ABC",
      reporter: "Ana",
      severity: "unsafe",
      description: "Oil <leak> & smoke",
      url: "https://ownaplane.eu/owner/aircraft/1/defects",
    });
    expect(email.subject).toBe("Urgent: LZ-ABC reported unsafe to fly");
    expect(email.text).toContain("Ana reported a defect on LZ-ABC:");
    expect(email.html).toContain("Oil &#60;leak&#62; &#38; smoke");
    expect(email.html).not.toContain("<leak>");
  });

  it("words booking notifications with the aircraft and the local time", () => {
    const email = bookingNotificationEmail({
      name: "Zlati",
      type: "requested",
      registration: "LZ-ABC",
      from: new Date("2026-10-01T07:00:00Z"),
      timeZone: "Europe/Sofia",
      other: "Ana",
      url: "https://ownaplane.eu/bookings/1",
      locale: "en",
    });
    expect(email.subject).toBe("New booking request for LZ-ABC");
    expect(email.text).toContain("Ana asked to rent LZ-ABC from 1 Oct 2026, 10:00.");
  });
});
