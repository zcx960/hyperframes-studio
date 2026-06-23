import { artifactUrl } from "../api";
import { JOB_STEPS, type Job, type JobStep } from "../types";

export function JobView(props: {
  readonly job: Job | null;
  readonly stepLabel: Record<JobStep, string>;
}) {
  const { job } = props;

  if (!job) {
    return (
      <section className="block">
        <div className="empty">
          <strong>还没有项目</strong>
          填入内容并「开始制作」，AI 会创作并渲染出成片视频。
        </div>
      </section>
    );
  }

  const running = job.status === "queued" || job.status === "running";
  const currentIndex = JOB_STEPS.indexOf(job.step);

  return (
    <section className="block">
      <div className="section-head">
        <h3>{job.request.title}</h3>
        <span className="meta">
          {job.status === "succeeded" && job.result?.durationSeconds
            ? `${job.result.durationSeconds}s`
            : `${Math.round(job.progress * 100)}%`}
        </span>
      </div>

      {running ? (
        <div className="pipeline">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>
          <div className="pipeline-steps">
            {JOB_STEPS.map((step, index) => {
              const state =
                index < currentIndex ? "done" : index === currentIndex ? "active" : "idle";
              return (
                <div key={step} className={`pipeline-step ${state}`}>
                  <span className="pipeline-dot" aria-hidden="true" />
                  {props.stepLabel[step]}
                </div>
              );
            })}
          </div>
          {job.activity && job.activity.length > 0 ? (
            <div className="activity-log">
              {job.activity.map((line, i) => (
                <div key={`${i}-${line}`} className="activity-line">
                  {line}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {job.status === "failed" ? (
        <div className="warn-banner" style={{ borderColor: "var(--red)" }}>
          <div className="warn-title" style={{ color: "var(--red)" }}>
            制作失败
          </div>
          <p>{job.error ?? "未知错误"}</p>
        </div>
      ) : null}

      {job.status === "succeeded" && job.result ? (
        <div className="result">
          {job.result.videoFile ? (
            <video
              className="result-video"
              controls
              preload="metadata"
              src={artifactUrl(job.id, job.result.videoFile)}
            >
              <track kind="captions" />
            </video>
          ) : null}

          {job.result.summary ? <p className="brief">{job.result.summary}</p> : null}

          <div className="artifacts">
            {job.result.videoFile ? (
              <a
                className="btn btn-primary"
                href={artifactUrl(job.id, job.result.videoFile)}
                download
              >
                下载视频
              </a>
            ) : null}
            {job.result.htmlFile ? (
              <a
                className="btn btn-secondary"
                href={artifactUrl(job.id, job.result.htmlFile)}
                target="_blank"
                rel="noreferrer"
              >
                预览 composition
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
