import { useCallback, useEffect, useState } from "react";
import { ApiError, createJob, getJob, listJobs } from "../api";
import { Composer } from "../components/Composer";
import { JobView } from "../components/JobView";
import { Sidebar, type StudioStep } from "../components/Sidebar";
import { Toasts } from "../components/Toasts";
import { useToasts } from "../hooks/useToasts";
import { logout } from "../lib/auth";
import type { Job, JobStep, JobSummary, WorkflowRequest } from "../types";

const DEFAULT_REQUEST: WorkflowRequest = {
  title: "信息流中文短视频",
  sourceType: "script",
  source: "",
  style: "news-flash",
  format: "portrait",
  sceneCount: 20,
  includeVoiceover: true,
};

const SIZE_BY_FORMAT: Record<WorkflowRequest["format"], string> = {
  portrait: "1080 × 1920",
  landscape: "1920 × 1080",
  square: "1080 × 1080",
};

const STEP_LABEL: Record<JobStep, string> = {
  prepare: "准备项目",
  author: "AI 创作",
  render: "渲染成片",
};

export function Studio() {
  const { toasts, push, dismiss } = useToasts();
  const [request, setRequest] = useState<WorkflowRequest>(DEFAULT_REQUEST);
  const [job, setJob] = useState<Job | null>(null);
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState<readonly JobSummary[]>([]);

  const refreshHistory = useCallback(() => {
    listJobs()
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Poll the active job until it finishes.
  const active = job && (job.status === "queued" || job.status === "running");
  useEffect(() => {
    if (!job || !active) return;
    const timer = setInterval(async () => {
      try {
        const next = await getJob(job.id);
        setJob(next);
        if (next.status === "succeeded") {
          push("success", "制作完成", next.result?.videoFile ? "成片已生成" : "已完成");
          refreshHistory();
        } else if (next.status === "failed") {
          push("error", "制作失败", next.error);
          refreshHistory();
        }
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 404) {
          setJob({
            ...job,
            status: "failed",
            error: "任务不存在，可能是服务重启或数据目录改变。请从最近项目重新打开或重新开始制作。",
          });
          push("error", "任务已丢失", "后端没有找到这个任务，已停止轮询。");
          refreshHistory();
          return;
        }
        const message = error instanceof Error ? error.message : "读取任务失败";
        setJob({ ...job, status: "failed", error: message });
        push("error", "读取任务失败", message);
        refreshHistory();
      }
    }, 900);
    return () => clearInterval(timer);
  }, [job, active, push, refreshHistory]);

  const steps = buildSteps(request, job);

  async function handleStart() {
    setCreating(true);
    try {
      const created = await createJob(request);
      setJob(created);
      refreshHistory();
    } catch (error: unknown) {
      push("error", "提交失败", error instanceof Error ? error.message : undefined);
    } finally {
      setCreating(false);
    }
  }

  async function openJob(id: string) {
    try {
      setJob(await getJob(id));
    } catch (error: unknown) {
      push("error", "打开任务失败", error instanceof Error ? error.message : undefined);
      if (error instanceof ApiError && error.status === 404) {
        refreshHistory();
      }
    }
  }

  return (
    <div className="shell">
      <Sidebar
        steps={steps}
        renderSize={SIZE_BY_FORMAT[request.format]}
        onLogout={() => logout("user")}
      />

      <header className="app-bar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            HF
          </div>
          <div className="brand-text">
            <h1>HyperFrames Studio</h1>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="main-inner">
          <header className="hero">
            <span className="eyebrow">HyperFrames Studio</span>
            <h2 className="title">从内容到视频</h2>
            <p className="lede">脚本、文档或公众号链接，由 AI 自动创作并渲染成短视频。</p>
          </header>

          <Composer
            request={request}
            busy={creating || Boolean(active)}
            onChange={(patch) => setRequest((current) => ({ ...current, ...patch }))}
            onGenerate={handleStart}
          />

          <JobView job={job} stepLabel={STEP_LABEL} />

          {history.length > 0 ? (
            <section className="block">
              <div className="section-head">
                <h3>最近项目</h3>
                <span className="meta">{history.length}</span>
              </div>
              <div className="history">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`history-row ${job?.id === item.id ? "on" : ""}`}
                    onClick={() => openJob(item.id)}
                  >
                    <span className={`history-dot ${item.status}`} aria-hidden="true" />
                    <span className="history-title">{item.title}</span>
                    <span className="history-meta">
                      {item.status === "succeeded"
                        ? `${item.durationSeconds ?? 0}s`
                        : STATUS_LABEL[item.status]}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

const STATUS_LABEL: Record<Job["status"], string> = {
  queued: "排队",
  running: "进行中",
  succeeded: "完成",
  failed: "失败",
};

function buildSteps(request: WorkflowRequest, job: Job | null): readonly StudioStep[] {
  const sourceReady = request.source.trim().length > 0;
  const running = job?.status === "queued" || job?.status === "running";
  const done = job?.status === "succeeded";

  return [
    {
      id: "input",
      title: "输入内容",
      meta: sourceReady ? "内容已就绪" : "待输入",
      state: sourceReady ? "done" : "active",
    },
    {
      id: "produce",
      title: "生成制作",
      meta: job ? STATUS_LABEL[job.status] : "待开始",
      state: job?.status === "failed" ? "warn" : done ? "done" : running ? "active" : "idle",
    },
    {
      id: "artifact",
      title: "成片",
      meta: done
        ? job?.result?.durationSeconds
          ? `${job.result.durationSeconds}s 视频`
          : "已生成"
        : "等待完成",
      state: done ? "active" : "idle",
    },
  ];
}
