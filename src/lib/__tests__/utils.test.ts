import { describe, it, expect } from "vitest";
import { timingSafeCompare, escapeRegex } from "../utils";

describe("timingSafeCompare", () => {
  it("accepts identical strings", () => {
    expect(timingSafeCompare("abc123", "abc123")).toBe(true);
  });

  it("rejects strings that differ", () => {
    expect(timingSafeCompare("abc123", "abc124")).toBe(false);
  });

  it("rejects strings of different lengths", () => {
    expect(timingSafeCompare("abc", "abcd")).toBe(false);
  });

  it("rejects when only a prefix matches", () => {
    // The whole point: a `===` short-circuit leaks how much of a guess was right.
    expect(timingSafeCompare("secrettoken", "secretXXXXX")).toBe(false);
  });

  it("handles empty strings without throwing", () => {
    expect(timingSafeCompare("", "")).toBe(true);
    expect(timingSafeCompare("", "a")).toBe(false);
    expect(timingSafeCompare("a", "")).toBe(false);
  });

  it("rejects non-string input", () => {
    // A missing cookie or header arrives as undefined; it must not compare equal to anything.
    const loose = timingSafeCompare as (a: unknown, b: unknown) => boolean;
    expect(loose(undefined, "a")).toBe(false);
    expect(loose("a", null)).toBe(false);
    expect(loose(undefined, undefined)).toBe(false);
  });
});

describe("escapeRegex", () => {
  it("neutralises regex metacharacters", () => {
    const escaped = escapeRegex("a.b*c+d?e");
    expect(new RegExp(escaped).test("a.b*c+d?e")).toBe(true);
    expect(new RegExp(escaped).test("axbxcxdxe")).toBe(false);
  });

  it("makes an otherwise-invalid pattern safe to compile", () => {
    // `new RegExp("(((")` throws; escaped it is just a literal search for "(((".
    expect(() => new RegExp(escapeRegex("((("))).not.toThrow();
    expect(new RegExp(escapeRegex("(((")).test("a((( b")).toBe(true);
  });

  it("defuses a catastrophically backtracking pattern", () => {
    const evil = "(a+)+$";
    const pattern = new RegExp(escapeRegex(evil));
    // Treated as a literal, so this returns immediately instead of pinning the CPU.
    expect(pattern.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaaX")).toBe(false);
    expect(pattern.test("prefix (a+)+$ suffix")).toBe(true);
  });

  it("leaves plain text untouched", () => {
    expect(escapeRegex("john@example.com")).toBe("john@example\\.com");
    expect(new RegExp(`^${escapeRegex("john@example.com")}$`, "i").test("JOHN@EXAMPLE.COM")).toBe(true);
  });
});
