import { readFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { LoginSchema, checkPassword, isValidToken, requireAuth, tokenFor } from "./auth.js";
import { type StudioSettings, StudioSettingsSchema, WorkflowDraftRequestSchema } from "./domain.js";
import { JobService } from "./jobs.js";
import { SettingsStore } from "./storage.js";
import { buildWorkflowDraft } from "./workflow.js";

const { NODE_ENV: nodeEnv, PORT: portEnv, SETTINGS_PATH: settingsPathEnv } = process.env;
const PORT = Number.parseInt(portEnv ?? "8787", 10);
const SETTINGS_PATH = settingsPathEnv ?? "/data/settings.json";

const ARTIFACT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};

export interface SettingsRepository {
  read(): Promise<StudioSettings>;
  write(settings: StudioSettings): Promise<StudioSettings>;
}

export function createApp(store: SettingsRepository, jobs?: JobService): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => origin,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.post("/api/login", async (context) => {
    const { scope, password } = LoginSchema.parse(await context.req.json());
    if (!checkPassword(scope, password)) {
      return context.json({ error: "invalid_password" }, 401);
    }
    return context.json({ token: tokenFor(scope), scope });
  });

  app.use("/api/settings", requireAuth(["admin"]));
  app.use("/api/workflows/draft", requireAuth(["user", "admin"]));

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: "hyperframes-studio-api",
    }),
  );

  app.get("/api/settings", async (context) => {
    const settings = await store.read();
    return context.json(maskSettings(settings));
  });

  app.post("/api/settings", async (context) => {
    const payload = await context.req.json();
    const incoming = StudioSettingsSchema.parse(payload);
    const existing = await store.read();
    const saved = await store.write(mergeSecrets(incoming, existing));
    return context.json(maskSettings(saved));
  });

  app.post("/api/workflows/draft", async (context) => {
    const payload = await context.req.json();
    const request = WorkflowDraftRequestSchema.parse(payload);
    const settings = await store.read();
    return context.json(buildWorkflowDraft(request, settings));
  });

  if (jobs) {
    app.post("/api/jobs", requireAuth(["user", "admin"]), async (context) => {
      const request = WorkflowDraftRequestSchema.parse(await context.req.json());
      const job = await jobs.create(request);
      return context.json(job);
    });

    app.get("/api/jobs", requireAuth(["user", "admin"]), async (context) => {
      const list = await jobs.list();
      return context.json(list.map(toSummary));
    });

    app.get("/api/jobs/:id", requireAuth(["user", "admin"]), async (context) => {
      const job = await jobs.get(context.req.param("id"));
      return job ? context.json(job) : context.json({ error: "not_found" }, 404);
    });

    // Media elements can't send Authorization headers, so artifacts also accept
    // a ?token= query param.
    app.get("/api/jobs/:id/artifacts/:name{.+}", async (context) => {
      const header = (context.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
      const token = header || context.req.query("token") || "";
      if (!isValidToken(token, ["user", "admin"])) {
        return context.json({ error: "unauthorized" }, 401);
      }

      const path = jobs.artifactPath(context.req.param("id"), context.req.param("name"));
      if (!path) {
        return context.json({ error: "bad_path" }, 400);
      }
      try {
        const body = await readFile(path);
        const type = ARTIFACT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
        return new Response(body, { headers: { "content-type": type } });
      } catch {
        return context.json({ error: "not_found" }, 404);
      }
    });
  }

  app.onError((error, context) => {
    if (error instanceof z.ZodError) {
      return context.json({ error: "validation_error", issues: error.issues }, 400);
    }

    console.error(error);
    return context.json({ error: "internal_error" }, 500);
  });

  return app;
}

/**
 * Settings come back from the API with masked secrets. When the client saves
 * without re-entering a key, the incoming value is the mask (or empty), so we
 * retain the stored secret instead of overwriting it with the placeholder.
 */
function mergeSecrets(incoming: StudioSettings, existing: StudioSettings): StudioSettings {
  return {
    ...incoming,
    llm: { ...incoming.llm, apiKey: keepSecret(incoming.llm.apiKey, existing.llm.apiKey) },
    tts: { ...incoming.tts, apiKey: keepSecret(incoming.tts.apiKey, existing.tts.apiKey) },
    media: {
      ...incoming.media,
      pexelsApiKey:
        keepSecret(incoming.media.pexelsApiKey ?? "", existing.media.pexelsApiKey ?? "") ||
        undefined,
      imageApiKey: keepSecret(incoming.media.imageApiKey, existing.media.imageApiKey),
    },
  };
}

function keepSecret(next: string, previous: string): string {
  if (next.length === 0 || isMasked(next)) {
    return previous;
  }
  return next;
}

function isMasked(value: string): boolean {
  return value === "********" || /^.{4}\.\.\..{4}$/.test(value);
}

function maskSettings(settings: StudioSettings): StudioSettings {
  return {
    ...settings,
    llm: {
      ...settings.llm,
      apiKey: maskSecret(settings.llm.apiKey),
    },
    tts: {
      ...settings.tts,
      apiKey: maskSecret(settings.tts.apiKey),
    },
    media: {
      ...settings.media,
      pexelsApiKey: settings.media.pexelsApiKey
        ? maskSecret(settings.media.pexelsApiKey)
        : undefined,
      imageApiKey: maskSecret(settings.media.imageApiKey),
    },
  };
}

function maskSecret(secret: string): string {
  if (secret.length === 0) {
    return "";
  }

  if (secret.length <= 8) {
    return "********";
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

/** Job list payload: status + meta only, without the heavy result body. */
function toSummary(job: import("./domain.js").JobRecord) {
  return {
    id: job.id,
    createdAt: job.createdAt,
    status: job.status,
    step: job.step,
    progress: job.progress,
    title: job.request.title,
    durationSeconds: job.result?.durationSeconds,
  };
}

if (nodeEnv !== "test") {
  const store = new SettingsStore(SETTINGS_PATH);
  const jobs = new JobService(store, { dataDir: dirname(SETTINGS_PATH) });
  void jobs.recover();

  serve({
    fetch: createApp(store, jobs).fetch,
    port: PORT,
  });

  console.log(`HyperFrames Studio API listening on :${PORT}`);
}
