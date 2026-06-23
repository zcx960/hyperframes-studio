import { HTTPError, TimeoutError } from "ky";

const DEFAULT_IMAGE_CONCURRENCY = 4;
const DEFAULT_IMAGE_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1_500;

export class MediaProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaProviderError";
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
  onProgress?: (message: string) => Promise<void> | void,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableMediaError(error) || attempt >= DEFAULT_IMAGE_RETRIES) {
        throw error;
      }
      attempt += 1;
      const delayMs = retryDelayMs(attempt);
      await onProgress?.(
        `${label} 超时或限流，${delayMs / 1000}s 后重试 ${attempt}/${DEFAULT_IMAGE_RETRIES}`,
      );
      await sleep(delayMs);
    }
  }
}

export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  const results = new Map<number, R>();
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) {
        results.set(index, await mapper(item, index));
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  const ordered: R[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const value = results.get(index);
    if (value === undefined) {
      throw new MediaProviderError("场景图片并发生成结果缺失。");
    }
    ordered.push(value);
  }
  return ordered;
}

export function imageConcurrency(sceneCount: number): number {
  const value = numberEnv("HF_IMAGE_CONCURRENCY", DEFAULT_IMAGE_CONCURRENCY);
  return Math.min(value, sceneCount);
}

function isRetryableMediaError(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error instanceof HTTPError) {
    return isRetryableStatus(error.response.status);
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function retryDelayMs(attempt: number): number {
  const base = numberEnv("HF_IMAGE_RETRY_BASE_MS", DEFAULT_RETRY_BASE_MS);
  return Math.min(15_000, base * 2 ** (attempt - 1));
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
