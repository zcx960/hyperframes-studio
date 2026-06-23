import { z } from "zod";
import { type AuthScope, authHeader, clearToken, getToken, setToken } from "./lib/auth";
import { JobSchema, JobSummarySchema, StudioSettingsSchema, WorkflowDraftSchema } from "./types";
import type { Job, JobSummary, StudioSettings, WorkflowDraft, WorkflowRequest } from "./types";

export async function login(scope: AuthScope, password: string): Promise<void> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope, password }),
  });

  if (!response.ok) {
    throw new ApiError(response.status === 401 ? "密码错误" : "登录失败", response.status);
  }

  const data = (await response.json()) as { token: string };
  setToken(scope, data.token);
}

export async function loadSettings(): Promise<StudioSettings> {
  const response = await fetch("/api/settings", { headers: { ...authHeader("admin") } });
  guardAuth(response, "admin");
  if (!response.ok) {
    throw new ApiError("读取配置失败", response.status);
  }

  return StudioSettingsSchema.parse(await response.json());
}

export async function saveSettings(settings: StudioSettings): Promise<StudioSettings> {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader("admin") },
    body: JSON.stringify(settings),
  });

  guardAuth(response, "admin");
  if (!response.ok) {
    throw new ApiError("保存配置失败", response.status);
  }

  return StudioSettingsSchema.parse(await response.json());
}

export async function createWorkflowDraft(request: WorkflowRequest): Promise<WorkflowDraft> {
  const response = await fetch("/api/workflows/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader("user") },
    body: JSON.stringify(request),
  });

  guardAuth(response, "user");
  if (!response.ok) {
    throw new ApiError("生成工作流草稿失败", response.status);
  }

  return WorkflowDraftSchema.parse(await response.json());
}

export async function createJob(request: WorkflowRequest): Promise<Job> {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader("user") },
    body: JSON.stringify(request),
  });

  guardAuth(response, "user");
  if (!response.ok) {
    throw new ApiError("创建制作任务失败", response.status);
  }

  return JobSchema.parse(await response.json());
}

export async function getJob(id: string): Promise<Job> {
  const response = await fetch(`/api/jobs/${id}`, { headers: { ...authHeader("user") } });
  guardAuth(response, "user");
  if (!response.ok) {
    throw new ApiError(
      response.status === 404 ? "任务不存在或已被清理" : "读取任务失败",
      response.status,
    );
  }
  return JobSchema.parse(await response.json());
}

export async function listJobs(): Promise<JobSummary[]> {
  const response = await fetch("/api/jobs", { headers: { ...authHeader("user") } });
  guardAuth(response, "user");
  if (!response.ok) {
    throw new ApiError("读取历史失败", response.status);
  }
  return z.array(JobSummarySchema).parse(await response.json());
}

/** URL for an artifact, with the user token as a query param for media elements. */
export function artifactUrl(jobId: string, name: string): string {
  const token = getToken("user") ?? "";
  const path = name
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/jobs/${jobId}/artifacts/${path}?token=${encodeURIComponent(token)}`;
}

/** On a 401 the stored token is stale — drop it and re-show the password gate. */
function guardAuth(response: Response, scope: AuthScope): void {
  if (response.status === 401) {
    clearToken(scope);
    window.location.reload();
    throw new ApiError("登录已失效，请重新输入密码", response.status);
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
