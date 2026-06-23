import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type HyperframeLintFinding, lintHyperframeHtml } from "@hyperframes/core/lint";

const DEFAULT_RENDER_TIMEOUT_MS = 15 * 60_000;

export type RenderProgressFn = (progress: number, message: string) => Promise<void> | void;

export class CompositionLintError extends Error {
  override readonly name = "CompositionLintError";
}

export class RenderTimeoutError extends Error {
  override readonly name = "RenderTimeoutError";
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      `渲染超时：${Math.round(timeoutMs / 1000)} 秒内没有完成。若日志停在 Compiling composition，请检查图片体积、Chrome 环境，或调大 HF_RENDER_TIMEOUT_MS。`,
    );
    this.timeoutMs = timeoutMs;
  }
}

export async function assertCompositionValid(html: string): Promise<void> {
  const result = await lintHyperframeHtml(html, { filePath: "index.html" });
  if (result.ok) {
    return;
  }
  const details = result.findings
    .filter((finding: HyperframeLintFinding) => finding.severity === "error")
    .slice(0, 5)
    .map((finding: HyperframeLintFinding) => `${finding.code}: ${finding.message}`)
    .join("; ");
  throw new CompositionLintError(`生成的 HyperFrames HTML 未通过 lint：${details}`);
}

export async function renderComposition(
  projectDir: string,
  outputPath: string,
  onProgress?: RenderProgressFn,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  ensureProducerCompatGlobals();
  const producer = await import("@hyperframes/producer");
  const timeoutMs = numberEnv("HF_RENDER_TIMEOUT_MS", DEFAULT_RENDER_TIMEOUT_MS);
  const controller = new AbortController();
  const job = producer.createRenderJob({
    entryFile: "index.html",
    fps: 30,
    quality: "standard",
    format: "mp4",
    workers: numberEnv("HF_RENDER_WORKERS", 1),
  });
  await onProgress?.(0, `启动 HyperFrames 渲染，超时上限 ${Math.round(timeoutMs / 1000)} 秒`);
  let progressQueue: Promise<void> = Promise.resolve();
  await withRenderTimeout(
    producer.executeRenderJob(
      job,
      projectDir,
      outputPath,
      (renderJob, message) => {
        progressQueue = progressQueue.then(() =>
          onProgress?.(normalizeProducerProgress(renderJob.progress), message),
        );
      },
      controller.signal,
    ),
    timeoutMs,
    controller,
  );
  await progressQueue;
}

export async function assertRenderedFile(path: string): Promise<void> {
  const data = await readFile(path);
  if (data.length === 0) {
    throw new Error("渲染产物为空文件。");
  }
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeProducerProgress(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) {
    return 0;
  }
  return Math.min(1, progress > 1 ? progress / 100 : progress);
}

async function withRenderTimeout(
  operation: Promise<void>,
  timeoutMs: number,
  controller: AbortController,
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new RenderTimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });

  try {
    await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function ensureProducerCompatGlobals(): void {
  if ("__dirname" in globalThis) return;
  // @hyperframes/producer 0.6.120 bundles a CJS wawoff2 binding that reads
  // __dirname even when loaded as ESM.
  Object.defineProperty(globalThis, "__dirname", {
    value: dirname(fileURLToPath(import.meta.url)),
    configurable: true,
  });
}
