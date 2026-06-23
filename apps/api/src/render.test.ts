import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderComposition } from "./render.js";

type MockRenderJob = { readonly progress: number };
type MockProgressCallback = (job: MockRenderJob, message: string) => void;
type MockCreateRenderJob = () => MockRenderJob;
type MockExecuteRenderJob = (
  job: MockRenderJob,
  projectDir: string,
  outputPath: string,
  onProgress?: MockProgressCallback,
  signal?: AbortSignal,
) => Promise<void>;

const producerMocks = vi.hoisted(() => ({
  createRenderJob: vi.fn<MockCreateRenderJob>(() => ({ progress: 0 })),
  executeRenderJob: vi.fn<MockExecuteRenderJob>(
    () =>
      new Promise<void>(() => {
        return;
      }),
  ),
}));

vi.mock("@hyperframes/producer", () => ({
  createRenderJob: producerMocks.createRenderJob,
  executeRenderJob: producerMocks.executeRenderJob,
}));

afterEach(() => {
  Reflect.deleteProperty(process.env, "HF_RENDER_TIMEOUT_MS");
  vi.clearAllMocks();
});

describe("renderComposition", () => {
  it("Given producer stops responding When rendering Then it fails with a bounded timeout", async () => {
    Reflect.set(process.env, "HF_RENDER_TIMEOUT_MS", "20");
    const dir = await mkdtemp(join(tmpdir(), "hf-render-timeout-"));

    try {
      await expect(
        Promise.race([
          renderComposition(dir, join(dir, "renders", "output.mp4")),
          new Promise<never>((_resolve, reject) => {
            setTimeout(() => reject(new Error("test timed out waiting for render timeout")), 200);
          }),
        ]),
      ).rejects.toThrow(/渲染超时/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("Given producer reports percentage progress When rendering Then it forwards unit progress", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hf-render-progress-"));
    const events: Array<{ readonly progress: number; readonly message: string }> = [];
    producerMocks.executeRenderJob.mockImplementationOnce(
      async (
        job: MockRenderJob,
        _projectDir: string,
        _outputPath: string,
        onProgress?: MockProgressCallback,
      ) => {
        onProgress?.({ ...job, progress: 25 }, "Compiling composition");
      },
    );

    try {
      await renderComposition(dir, join(dir, "renders", "output.mp4"), (progress, message) => {
        events.push({ progress, message });
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    expect(events).toContainEqual({ progress: 0.25, message: "Compiling composition" });
  });

  it("Given async progress persistence When producer completes Then rendering waits for it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hf-render-progress-wait-"));
    let releaseProgress: (() => void) | undefined;
    const progressBlocker = new Promise<void>((resolve) => {
      releaseProgress = resolve;
    });
    producerMocks.executeRenderJob.mockImplementationOnce(
      async (
        job: MockRenderJob,
        _projectDir: string,
        _outputPath: string,
        onProgress?: MockProgressCallback,
      ) => {
        onProgress?.({ ...job, progress: 25 }, "Compiling composition");
      },
    );

    try {
      const render = renderComposition(
        dir,
        join(dir, "renders", "output.mp4"),
        async (_progress, message) => {
          if (message === "Compiling composition") {
            await progressBlocker;
          }
        },
      );
      const early = await Promise.race([
        render.then(() => "done"),
        new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 20)),
      ]);
      expect(early).toBe("pending");

      if (releaseProgress === undefined) {
        throw new Error("Expected progress callback to be blocked.");
      }
      releaseProgress();
      await render;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
