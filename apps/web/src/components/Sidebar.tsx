export type StepState = "active" | "done" | "warn" | "idle";

export interface StudioStep {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
  readonly state: StepState;
}

export function Sidebar(props: {
  readonly steps: readonly StudioStep[];
  readonly renderSize: string;
  readonly onSelect?: (id: string) => void;
  readonly onLogout?: () => void;
}) {
  return (
    <aside className="sidebar" aria-label="工作台导航">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          HF
        </div>
        <div className="brand-text">
          <h1>HyperFrames Studio</h1>
          <p>视频生成工作台</p>
        </div>
      </div>

      <nav className="stepper" aria-label="制作步骤">
        {props.steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={`step ${step.state}`}
            onClick={() => props.onSelect?.(step.id)}
          >
            <span className="step-index" aria-hidden="true">
              {step.state === "done" ? "✓" : index + 1}
            </span>
            <span className="step-body">
              <span className="step-title">{step.title}</span>
              <span className="step-meta">{step.meta}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className="eyebrow">画幅</span>
        <span className="ratio">{props.renderSize}</span>
        {props.onLogout ? (
          <button type="button" className="link gate-logout" onClick={props.onLogout}>
            退出
          </button>
        ) : null}
      </div>
    </aside>
  );
}
