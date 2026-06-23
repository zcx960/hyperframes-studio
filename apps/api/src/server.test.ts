import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tokenFor } from "./auth.js";
import { DEFAULT_SETTINGS } from "./domain.js";
import { JobService } from "./jobs.js";
import { createApp } from "./server.js";

const ADMIN_AUTH = { Authorization: `Bearer ${tokenFor("admin")}` };
const USER_AUTH = { Authorization: `Bearer ${tokenFor("user")}` };

const DRAFT_BODY = {
  title: "微信文章短视频",
  sourceType: "wechat-url",
  source: "https://mp.weixin.qq.com/example",
  style: "news-flash",
  format: "portrait",
  sceneCount: 12,
  includeVoiceover: true,
};

class MemoryStore {
  #settings = DEFAULT_SETTINGS;

  async read() {
    return this.#settings;
  }

  async write(settings: typeof DEFAULT_SETTINGS) {
    this.#settings = settings;
    return this.#settings;
  }

  get raw() {
    return this.#settings;
  }
}

const SETTINGS_WITH_KEYS: typeof DEFAULT_SETTINGS = {
  ...DEFAULT_SETTINGS,
  llm: { ...DEFAULT_SETTINGS.llm, apiKey: "test-key-live-1234567890" },
  tts: { ...DEFAULT_SETTINGS.tts, apiKey: "tts-secret-key-9999" },
};

async function postSettings(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ADMIN_AUTH },
    body: JSON.stringify(body),
  });
}

describe("HyperFrames Studio API", () => {
  it("Given a user token When drafting a workflow Then returns warnings for missing keys", async () => {
    const app = createApp(new MemoryStore());

    const response = await app.request("/api/workflows/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...USER_AUTH },
      body: JSON.stringify(DRAFT_BODY),
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.estimatedDurationSeconds).toBe(96);
    expect(body.configWarnings.length).toBeGreaterThan(0);
  });

  it("Given no token When drafting a workflow Then it is rejected", async () => {
    const app = createApp(new MemoryStore());

    const response = await app.request("/api/workflows/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DRAFT_BODY),
    });

    expect(response.status).toBe(401);
  });

  it("Given the correct password When logging in Then returns a token", async () => {
    const app = createApp(new MemoryStore());

    const ok = await app.request("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "admin", password: "change-me-admin" }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).token).toBe(tokenFor("admin"));

    const bad = await app.request("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "admin", password: "wrong" }),
    });
    expect(bad.status).toBe(401);
  });

  it("Given a user token When reading admin settings Then it is rejected", async () => {
    const app = createApp(new MemoryStore());

    const response = await app.request("/api/settings", { headers: { ...USER_AUTH } });

    expect(response.status).toBe(401);
  });

  it("Given a stored key When saving the masked value Then the real key is kept", async () => {
    const store = new MemoryStore();
    const app = createApp(store);

    const first = await postSettings(app, SETTINGS_WITH_KEYS);
    const masked = await first.json();
    expect(masked.llm.apiKey).toBe("test...7890");

    // Client re-saves with the masked value (user did not re-enter the key).
    const second = await postSettings(app, masked);
    expect(second.status).toBe(200);

    expect(store.raw.llm.apiKey).toBe("test-key-live-1234567890");
    expect(store.raw.tts.apiKey).toBe("tts-secret-key-9999");
  });

  it("Given a stored key When saving a new key Then the new key overwrites it", async () => {
    const store = new MemoryStore();
    const app = createApp(store);

    await postSettings(app, SETTINGS_WITH_KEYS);
    await postSettings(app, {
      ...SETTINGS_WITH_KEYS,
      llm: { ...SETTINGS_WITH_KEYS.llm, apiKey: "test-key-rotated-0000" },
    });

    expect(store.raw.llm.apiKey).toBe("test-key-rotated-0000");
  });
});

describe("HyperFrames Studio jobs", () => {
  async function makeApp() {
    const dataDir = await mkdtemp(join(tmpdir(), "hf-jobs-"));
    const store = new MemoryStore();
    const jobs = new JobService(store, {
      dataDir,
      deps: {
        loadSourceText: async (request) => request.source,
        generateStoryboard: async () => ({
          title: "测试视频",
          summary: "已生成结构化视频方案",
          scenes: [
            {
              headline: "测试场景",
              body: "这是用于集成测试的场景。",
              narration: "这是一段测试旁白。",
              visual: "简洁标题卡。",
              emphasis: "测试",
            },
          ],
        }),
        prepareSceneAssets: async () => [],
        prepareVoiceoverAssets: async () => [],
        renderComposition: async (_projectDir: string, outputPath: string) => {
          await writeFile(outputPath, "fake", "utf8");
        },
      },
    });
    return { app: createApp(store, jobs), dataDir };
  }

  it("Given no token When creating a job Then it is rejected", async () => {
    const { app, dataDir } = await makeApp();
    const response = await app.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DRAFT_BODY),
    });
    expect(response.status).toBe(401);
    await rm(dataDir, { recursive: true, force: true });
  });

  it("Given a user token When creating a job Then it runs to completion with artifacts", async () => {
    const { app, dataDir } = await makeApp();

    const created = await app.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...USER_AUTH },
      body: JSON.stringify({
        ...DRAFT_BODY,
        sourceType: "script",
        source: "一段用于测试的脚本内容。",
        sceneCount: 2,
      }),
    });
    expect(created.status).toBe(200);
    const { id } = await created.json();

    // poll until the worker finishes
    let job: { status: string; result?: { videoFile?: string } } | undefined;
    for (let attempt = 0; attempt < 50; attempt++) {
      const detail = await app.request(`/api/jobs/${id}`, { headers: { ...USER_AUTH } });
      job = await detail.json();
      if (job?.status === "succeeded" || job?.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(job?.status).toBe("succeeded");
    expect(job?.result?.videoFile).toBe("renders/output.mp4");

    // video artifact is fetchable with a query token
    const video = await app.request(
      `/api/jobs/${id}/artifacts/renders/output.mp4?token=${tokenFor("user")}`,
    );
    expect(video.status).toBe(200);

    // .env (secrets) must NOT be downloadable
    const env = await app.request(`/api/jobs/${id}/artifacts/.env?token=${tokenFor("user")}`);
    expect([400, 404]).toContain(env.status);

    // list shows the job summary
    const list = await app.request("/api/jobs", { headers: { ...USER_AUTH } });
    expect((await list.json()).length).toBe(1);

    await rm(dataDir, { recursive: true, force: true });
  });

  it("Given a bad artifact path When fetching Then traversal is blocked", async () => {
    const { app, dataDir } = await makeApp();
    const response = await app.request(
      `/api/jobs/x/artifacts/..%2f..%2fsettings.json?token=${tokenFor("user")}`,
    );
    expect([400, 404]).toContain(response.status);
    await rm(dataDir, { recursive: true, force: true });
  });
});
