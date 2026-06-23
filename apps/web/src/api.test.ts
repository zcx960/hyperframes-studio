import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getJob } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getJob", () => {
  it("Given the API returns 404 When loading a job Then it exposes a not found ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "not_found" }), { status: 404 })),
    );

    await expect(getJob("missing-job")).rejects.toMatchObject({
      message: "任务不存在或已被清理",
      status: 404,
    });
    await expect(getJob("missing-job")).rejects.toBeInstanceOf(ApiError);
  });
});
