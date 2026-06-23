import { describe, expect, it } from "vitest";
import { formatClipDuration } from "./time-format.js";

describe("formatClipDuration", () => {
  it("Given adjacent clips When formatting duration Then it leaves a millisecond guard gap", () => {
    expect(formatClipDuration(8.2, true)).toBe("8.199");
    expect(formatClipDuration(8.2, false)).toBe("8.2");
  });
});
