import { describe, expect, it } from "vitest";

import { AVATAR_PRESETS, presetFromKey, presetKey } from "./avatar-presets";

describe("avatar presets", () => {
  it("has ten presets and reads them back from the stored key", () => {
    expect(AVATAR_PRESETS).toHaveLength(10);
    for (const preset of AVATAR_PRESETS) expect(presetFromKey(presetKey(preset))).toBe(preset);
  });

  it("ignores uploaded photos and unknown or crafted names", () => {
    expect(presetFromKey("avatars/u1/123.jpg")).toBeNull();
    expect(presetFromKey("preset:../../etc/passwd")).toBeNull();
    expect(presetFromKey("preset:dragon")).toBeNull();
    expect(presetFromKey(null)).toBeNull();
  });
});
