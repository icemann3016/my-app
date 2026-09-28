import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDsn, reportError, stackFrames } from "./index";

describe("error monitoring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("turns a DSN into the envelope URL and key", () => {
    expect(parseDsn("https://abc123@o1.ingest.de.sentry.io/4507")).toEqual({
      url: "https://o1.ingest.de.sentry.io/api/4507/envelope/",
      key: "abc123",
    });
    expect(parseDsn("https://key@glitchtip.example.com/prefix/7")?.url).toBe(
      "https://glitchtip.example.com/prefix/api/7/envelope/",
    );
    expect(parseDsn("not a dsn")).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
  });

  it("reads stack frames oldest first", () => {
    const frames = stackFrames(
      "Error: boom\n    at inner (/app/lib/a.ts:10:5)\n    at outer (/app/node_modules/x.js:2:1)",
    );
    expect(frames.map((f) => f.function)).toEqual(["outer", "inner"]);
    expect(frames[1]).toMatchObject({ lineno: 10, in_app: true });
  });

  it("sends the error without the query string, and only with a DSN", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(""));
    await reportError(new Error("nope"), { where: "/x", path: "/search?home=LBSF" });
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("SENTRY_DSN", "https://k@sentry.example.com/1");
    await reportError(new Error("nope"), { where: "/x", path: "/search?home=LBSF" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://sentry.example.com/api/1/envelope/");
    const event = JSON.parse(String(init!.body).split("\n")[2]!);
    expect(event.request.url).toBe("/search");
    expect(event.exception.values[0].value).toBe("nope");
  });
});
