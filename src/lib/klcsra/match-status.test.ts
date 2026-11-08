import { describe, it, expect } from "vitest";
import { statusLabel } from "./match-status";

const s = (status: "draft" | "sent" | "submitted", over: object = {}) =>
  ({ status, isFriendly: false, homeSentAt: null, awaySentAt: null, ...over });

describe("statusLabel", () => {
  it("names each state", () => {
    expect(statusLabel(s("draft"))).toBe("Draft");
    expect(statusLabel(s("draft", { homeSentAt: "t" }))).toBe("Draft · 1 of 2 teams sent");
    expect(statusLabel(s("sent"))).toBe("Waiting for KFANDRA");
    expect(statusLabel(s("submitted"))).toBe("Official");
    expect(statusLabel(s("submitted", { isFriendly: true }))).toBe("Submitted");
  });
});
