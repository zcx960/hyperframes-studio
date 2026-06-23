import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { JobRecord } from "./domain.js";
import { JobStore } from "./jobs.js";

const JOB: JobRecord = {
  id: "job-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "running",
  step: "render",
  progress: 0.5,
  request: {
    title: "测试任务",
    sourceType: "script",
    source: "测试脚本",
    style: "news-flash",
    format: "portrait",
    sceneCount: 1,
    includeVoiceover: true,
  },
};

describe("JobStore", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "hf-job-store-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("Given a malformed existing job file When reading it Then it is not reported as missing", async () => {
    await writeFile(join(dir, "job-1.json"), `${JSON.stringify(JOB)}}`, "utf8");
    const store = new JobStore(dir);

    await expect(store.read("job-1")).rejects.toThrow(/job-1/);
  });

  it("Given many concurrent updates When reading the job file Then the JSON remains parseable", async () => {
    const store = new JobStore(dir);
    await store.create(JOB);

    await Promise.all(
      Array.from({ length: 120 }, async (_value, index) => {
        await store.update("job-1", {
          progress: index / 120,
          activity: Array.from({ length: index % 2 === 0 ? 80 : 1 }, () => `event-${index}`),
        });
      }),
    );

    const raw = await readFile(join(dir, "job-1.json"), "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    await expect(store.read("job-1")).resolves.toMatchObject({ id: "job-1" });
  });

  it("Given a malformed job file When listing jobs Then healthy records are still returned", async () => {
    const store = new JobStore(dir);
    await store.create(JOB);
    await writeFile(join(dir, "broken.json"), `${JSON.stringify(JOB)}}`, "utf8");

    await expect(store.list()).resolves.toEqual([JOB]);
  });
});
