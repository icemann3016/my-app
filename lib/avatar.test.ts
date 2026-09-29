import { describe, expect, it } from "vitest";

import { initials } from "./avatar";

describe("initials", () => {
  it("uses first and last name", () => {
    expect(initials("Alice Marie Pilot")).toBe("AP");
  });
  it("handles single names and blanks", () => {
    expect(initials("bob")).toBe("B");
    expect(initials("   ")).toBe("?");
  });
  it("ignores brackets and punctuation", () => {
    expect(initials("Maria Georgieva (demo)")).toBe("MG");
    expect(initials('Иван "Ваньо" Петров')).toBe("ИП");
    expect(initials("(test)")).toBe("?");
  });
});
