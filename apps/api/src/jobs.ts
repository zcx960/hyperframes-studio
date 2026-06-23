import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";
import {
  type JobRecord,
  JobRecordSchema,
  type StudioSettings,
  type WorkflowDraftRequest,
} from "./domain.js";
import { type PipelineDeps, defaultPipelineDeps, runPipeline } from "./pipeline.js";

interface SettingsReader {
  read(): Promise<StudioSettings>;
}

class JobStoreCorruptRecordError extends Error {
  readonly name = "JobStoreCorruptRecordError";

  constructor(
    readonly id: string,
    options: { readonly cause: unknown },
  ) {
    super(`Job record ${id} is corrupt and cannot be parsed.`, { cause: options.cause });
  }
}

/** File-backed persistence for job records, one JSON file per job. */
export class JobStore {
  readonly #dir: string;
  #mutationQueue: Promise<void> = Promise.resolve();

  constructor(dir: string) {
    this.#dir = dir;
  }

  async create(record: JobRecord): Promise<void> {
    await this.#mutate(() => this.#write(record));
  }

  async read(id: string): Promise<JobRecord | null> {
    let raw: string;
    try {
      raw = await readFile(this.#path(id), "utf8");
    } catch (error) {
      if (isFileNotFound(error)) {
        return null;
      }
      throw error;
    }

    try {
      return JobRecordSchema.parse(JSON.parse(raw));
    } catch (error) {
      throw new JobStoreCorruptRecordError(id, { cause: error });
    }
  }

  async update(id: string, patch: Partial<JobRecord>): Promise<JobRecord | null> {
    return this.#mutate(async () => {
      const current = await this.read(id);
      if (!current) {
        return null;
      }
      const next = JobRecordSchema.parse({ ...current, ...patch });
      await this.#write(next);
      return next;
    });
  }

  async list(): Promise<JobRecord[]> {
    let names: string[];
    try {
      names = await readdir(this.#dir);
    } catch {
      return [];
    }
    const records = await Promise.all(
      names.filter((name) => name.endsWith(".json")).map((name) => this.#readListEntry(name)),
    );
    return records
      .filter((record): record is JobRecord => record !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async #readListEntry(name: string): Promise<JobRecord | null> {
    try {
      return await this.read(name.slice(0, -5));
    } catch (error) {
      if (error instanceof JobStoreCorruptRecordError) {
        return null;
      }
      throw error;
    }
  }

  async #write(record: JobRecord): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    const tempPath = join(this.#dir, `${record.id}.${randomUUID()}.tmp`);
    try {
      await writeFile(tempPath, JSON.stringify(record, null, 2), "utf8");
      await rename(tempPath, this.#path(record.id));
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }

  #path(id: string): string {
    return join(this.#dir, `${id}.json`);
  }

  async #mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationQueue.then(operation, operation);
    this.#mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Owns the job store, a single-worker FIFO queue and the pipeline. */
export class JobService {
  readonly #settings: SettingsReader;
  readonly #store: JobStore;
  readonly #projectsDir: string;
  readonly #deps: PipelineDeps;
  readonly #queue: string[] = [];
  #running = false;

  constructor(settings: SettingsReader, options: { dataDir: string; deps?: PipelineDeps }) {
    this.#settings = settings;
    this.#store = new JobStore(join(options.dataDir, "jobs"));
    this.#projectsDir = join(options.dataDir, "projects");
    this.#deps = options.deps ?? defaultPipelineDeps;
  }

  async create(request: WorkflowDraftRequest): Promise<JobRecord> {
    const record: JobRecord = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "queued",
      step: "prepare",
      progress: 0,
      request,
    };
    await this.#store.create(record);
    this.#queue.push(record.id);
    void this.#tick();
    return record;
  }

  list(): Promise<JobRecord[]> {
    return this.#store.list();
  }

  get(id: string): Promise<JobRecord | null> {
    return this.#store.read(id);
  }

  /** Absolute path to an artifact, or null if the name escapes the job dir or
   * targets a dotfile (e.g. `.env`, which holds secrets). */
  artifactPath(id: string, name: string): string | null {
    const safe = normalize(name);
    const segments = safe.split(/[\\/]/);
    if (
      safe.startsWith("..") ||
      isAbsolute(safe) ||
      safe.includes("..") ||
      segments.some((segment) => segment.startsWith("."))
    ) {
      return null;
    }
    return join(this.#projectsDir, id, safe);
  }

  /** Mark jobs left mid-run by a previous process as failed. */
  async recover(): Promise<void> {
    for (const job of await this.#store.list()) {
      if (job.status === "running" || job.status === "queued") {
        await this.#store.update(job.id, { status: "failed", error: "服务重启，任务已中断" });
      }
    }
  }

  async #tick(): Promise<void> {
    if (this.#running) {
      return;
    }
    this.#running = true;
    try {
      while (this.#queue.length > 0) {
        const id = this.#queue.shift();
        if (id) {
          await this.#process(id);
        }
      }
    } finally {
      this.#running = false;
    }
  }

  async #process(id: string): Promise<void> {
    const job = await this.#store.read(id);
    if (!job) {
      return;
    }
    await this.#store.update(id, { status: "running" });
    const activity: string[] = [];
    try {
      const settings = await this.#settings.read();
      const projectDir = join(this.#projectsDir, id);
      const result = await runPipeline(
        job,
        settings,
        projectDir,
        (step, progress, line) => {
          if (line) {
            activity.push(line);
          }
          return this.#store
            .update(id, { step, progress, activity: activity.slice(-8) })
            .then(() => undefined);
        },
        this.#deps,
      );
      await this.#store.update(id, { status: "succeeded", progress: 1, result });
    } catch (error) {
      await this.#store.update(id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
