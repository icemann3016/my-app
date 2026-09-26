import { describe, expect, it } from "vitest";

import { resetPasswordEmail } from "./templates";

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
