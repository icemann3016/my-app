import { describe, expect, it } from "vitest";

import { safeFilename, sniffFileType } from "./sniff";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)),
  );

describe("sniffFileType", () => {
  it("recognises the accepted types by content", () => {
    expect(sniffFileType(bytes("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffFileType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffFileType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      "image/png",
    );
    expect(sniffFileType(bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 "))).toBe("image/webp");
  });

  it("rejects everything else, whatever the name says", () => {
    expect(sniffFileType(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffFileType(bytes("RIFF", [1, 2, 3, 4], "WAVE"))).toBeNull();
    expect(sniffFileType(new Uint8Array())).toBeNull();
  });
});

describe("safeFilename", () => {
  it("keeps the name, drops paths and fixes the extension", () => {
    expect(safeFilename("C:\\scans\\licence page 1.PDF", "application/pdf")).toBe(
      "licence page 1.pdf",
    );
    expect(safeFilename("../../etc/passwd", "image/png")).toBe("passwd.png");
    expect(safeFilename('bad"\u0000name.jpeg', "image/jpeg")).toBe("badname.jpg");
    expect(safeFilename("", "image/webp")).toBe("document.webp");
  });
});
