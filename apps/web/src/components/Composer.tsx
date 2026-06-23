import type { WorkflowRequest } from "../types";

const SOURCE_TYPES: ReadonlyArray<{ value: WorkflowRequest["sourceType"]; label: string }> = [
  { value: "script", label: "脚本" },
  { value: "document", label: "文档" },
  { value: "wechat-url", label: "公众号链接" },
];

const STYLES: ReadonlyArray<{ value: WorkflowRequest["style"]; label: string; hint: string }> = [
  { value: "news-flash", label: "信息流", hint: "快节奏" },
  { value: "cinematic", label: "电影感", hint: "强氛围" },
  { value: "infographic", label: "信息图", hint: "图表驱动" },
  { value: "minimal-editorial", label: "简约图文", hint: "杂志感" },
];

const FORMATS: ReadonlyArray<{ value: WorkflowRequest["format"]; label: string; hint: string }> = [
  { value: "portrait", label: "竖屏", hint: "9:16" },
  { value: "landscape", label: "横屏", hint: "16:9" },
  { value: "square", label: "方形", hint: "1:1" },
];

const SOURCE_PLACEHOLDER: Record<WorkflowRequest["sourceType"], string> = {
  script: "粘贴脚本…",
  document: "粘贴正文…",
  "wechat-url": "粘贴公众号链接…",
};

export function Composer(props: {
  readonly request: WorkflowRequest;
  readonly onChange: (patch: Partial<WorkflowRequest>) => void;
  readonly onGenerate: () => void;
  readonly busy: boolean;
}) {
  const { request, onChange } = props;

  return (
    <section className="block composer" aria-labelledby="composer-title">
      <div className="section-head">
        <h3 id="composer-title">输入</h3>
        <span className="meta">{request.sceneCount} 场景</span>
      </div>

      <div className="form-grid">
        <div className="field">
          <span className="field-label">标题</span>
          <input
            className="input"
            value={request.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>

        <div className="field">
          <span className="field-label">来源</span>
          <div className="segmented" aria-label="来源类型">
            {SOURCE_TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={request.sourceType === item.value ? "on" : ""}
                onClick={() => onChange({ sourceType: item.value })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 22 }}>
        <div className="field">
          <span className="field-label">风格</span>
          <div className="choice-grid">
            {STYLES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`choice ${request.style === item.value ? "on" : ""}`}
                onClick={() => onChange({ style: item.value })}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">画幅</span>
          <div className="choice-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {FORMATS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`choice ${request.format === item.value ? "on" : ""}`}
                onClick={() => onChange({ format: item.value })}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field composer-source">
        <span className="field-label">内容</span>
        <textarea
          className="textarea"
          placeholder={SOURCE_PLACEHOLDER[request.sourceType]}
          value={request.source}
          onChange={(event) => onChange({ source: event.target.value })}
        />
      </div>

      <div className="composer-foot">
        <div className="composer-controls">
          <div className="field" style={{ gap: 6 }}>
            <span className="field-label">场景数</span>
            <SceneStepper
              value={request.sceneCount}
              onChange={(sceneCount) => onChange({ sceneCount })}
            />
          </div>

          <Switch
            checked={request.includeVoiceover}
            label="分场景语音"
            onChange={(includeVoiceover) => onChange({ includeVoiceover })}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={props.busy || request.source.trim().length === 0}
          onClick={props.onGenerate}
        >
          {props.busy ? <span className="spinner" aria-hidden="true" /> : null}
          {props.busy ? "制作中…" : "开始制作"}
        </button>
      </div>
    </section>
  );
}

function SceneStepper(props: {
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(40, Math.max(1, next));
  return (
    <div className="num">
      <button
        type="button"
        aria-label="减少场景数"
        disabled={props.value <= 1}
        onClick={() => props.onChange(clamp(props.value - 1))}
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={40}
        value={props.value}
        onChange={(event) => props.onChange(clamp(Number.parseInt(event.target.value, 10) || 1))}
      />
      <button
        type="button"
        aria-label="增加场景数"
        disabled={props.value >= 40}
        onClick={() => props.onChange(clamp(props.value + 1))}
      >
        +
      </button>
    </div>
  );
}

function Switch(props: {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      className={`switch ${props.checked ? "on" : ""}`}
      onClick={() => props.onChange(!props.checked)}
    >
      <span className="switch-track" aria-hidden="true" />
      {props.label}
    </button>
  );
}
