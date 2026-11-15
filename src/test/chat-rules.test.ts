import { describe, expect, it } from "vitest";
import { canDeleteMessage } from "@/lib/chat";

describe("メッセージ削除", () => {
  it("自分が送信したメッセージは削除できる", () => {
    expect(canDeleteMessage("profile-1", "profile-1")).toBe(true);
  });

  it("他の人が送信したメッセージには削除操作を表示しない", () => {
    expect(canDeleteMessage("profile-2", "profile-1")).toBe(false);
  });
});
