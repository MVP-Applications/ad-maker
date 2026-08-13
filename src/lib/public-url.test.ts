import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePublicHttpUrl } from "./public-url";

/**
 * The dev-only upload exception widens a guard that exists to stop the server
 * being pointed at its own network, so the shape of the hole is worth stating:
 * one origin, one path, and only while NODE_ENV is not production.
 */
const withNodeEnv = (value: string, run: () => void) => {
  vi.stubEnv("NODE_ENV", value);
  run();
};

describe("parsePublicHttpUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts an ordinary public URL", () => {
    expect(parsePublicHttpUrl("https://example.com/logo.png")?.href).toBe(
      "https://example.com/logo.png",
    );
  });

  it.each([
    ["a non-HTTP protocol", "data:image/png;base64,AAAA"],
    ["a blob URL", "blob:http://localhost:3000/abc"],
    ["credentials", "https://user:pw@example.com/logo.png"],
    ["an IP literal", "http://93.184.216.34/logo.png"],
    ["a .internal host", "https://records.internal/logo.png"],
    ["a non-standard port", "https://example.com:8443/logo.png"],
  ])("refuses %s", (_why, raw) => {
    expect(parsePublicHttpUrl(raw)).toBeNull();
  });

  describe("the development upload exception", () => {
    it("accepts the dev server's own /uploads/ path", () => {
      withNodeEnv("development", () => {
        expect(
          parsePublicHttpUrl("http://localhost:3000/uploads/a.png")?.href,
        ).toBe("http://localhost:3000/uploads/a.png");
        expect(
          parsePublicHttpUrl("http://127.0.0.1:3000/uploads/a.png"),
        ).not.toBeNull();
      });
    });

    // The exception is what makes an uploaded logo reachable; it must not also
    // make the rest of the loopback interface reachable.
    it("still refuses other loopback paths in development", () => {
      withNodeEnv("development", () => {
        expect(parsePublicHttpUrl("http://localhost:8080/extract")).toBeNull();
        expect(parsePublicHttpUrl("http://127.0.0.1:3000/api/brief")).toBeNull();
      });
    });

    it("refuses the upload path in production", () => {
      withNodeEnv("production", () => {
        expect(parsePublicHttpUrl("http://localhost:3000/uploads/a.png")).toBeNull();
      });
    });
  });
});
