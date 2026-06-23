import { useEffect, useMemo, useState } from "react";
import { loadSettings, saveSettings } from "../api";
import { Toasts } from "../components/Toasts";
import { useToasts } from "../hooks/useToasts";
import { logout } from "../lib/auth";
import {
  LLM_PRESETS,
  LLM_PROVIDER_LABELS,
  TTS_PRESETS,
  TTS_PROVIDER_LABELS,
  countChanges,
} from "../lib/presets";
import type { StudioSettings } from "../types";

type Llm = StudioSettings["llm"];
type Tts = StudioSettings["tts"];

const EMPTY_SETTINGS: StudioSettings = {
  llm: {
    provider: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
    temperature: 0.7,
  },
  tts: {
    provider: "mimo",
    baseUrl: "https://api.xiaomimimo.com/v1",
    apiKey: "",
    model: "mimo-v2.5-tts",
    voice: "冰糖",
    format: "wav",
    speed: 1.2,
  },
  media: {
    imageProvider: "none",
    pexelsApiKey: "",
    imageBaseUrl: "https://api.openai.com/v1",
    imageApiKey: "",
    imageModel: "gpt-image-2",
  },
  render: {
    format: "portrait",
    width: 1080,
    height: 1920,
    targetScenes: 20,
    outputDirectory: "/workspace/renders",
  },
};

export function Admin() {
  const { toasts, push, dismiss } = useToasts();
  const [settings, setSettings] = useState<StudioSettings>(EMPTY_SETTINGS);
  const [saved, setSaved] = useState<StudioSettings>(EMPTY_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadSettings()
      .then((value) => {
        if (!active) return;
        setSettings(value);
        setSaved(value);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        push("error", "配置读取失败", error instanceof Error ? error.message : undefined);
      });
    return () => {
      active = false;
    };
  }, [push]);

  const dirtyCount = useMemo(
    () => (loaded ? countChanges(settings, saved) : 0),
    [loaded, settings, saved],
  );

  const setLlm = (patch: Partial<Llm>) =>
    setSettings((s) => ({ ...s, llm: { ...s.llm, ...patch } }));
  const setTts = (patch: Partial<Tts>) =>
    setSettings((s) => ({ ...s, tts: { ...s.tts, ...patch } }));
  const setMedia = (patch: Partial<StudioSettings["media"]>) =>
    setSettings((s) => ({ ...s, media: { ...s.media, ...patch } }));
  const setRender = (patch: Partial<StudioSettings["render"]>) =>
    setSettings((s) => ({ ...s, render: { ...s.render, ...patch } }));

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveSettings(settings);
      setSettings(result);
      setSaved(result);
      setLastSavedLabel(
        `已保存 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      );
      push("success", "配置已保存");
    } catch (error: unknown) {
      push("error", "保存配置失败", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            HF
          </div>
          <div className="brand-text">
            <h1>Studio 后台</h1>
          </div>
        </div>
        <div className="topbar-links">
          <a className="link" href="/">
            查看前台 ↗
          </a>
          <button type="button" className="link" onClick={() => logout("admin")}>
            退出
          </button>
        </div>
      </header>

      <main className="main">
        <div className="main-inner">
          <header className="hero">
            <span className="eyebrow">Console</span>
            <h2 className="title">配置</h2>
            <p className="lede">配置文本模型、语音与渲染，对前台所有生成生效。</p>
          </header>

          <section className="block">
            <div className="section-head">
              <h3>文本模型</h3>
            </div>
            <div className="cfg-fields">
              <Field label="Provider">
                <select
                  className="select"
                  value={settings.llm.provider}
                  onChange={(e) => {
                    const provider = e.target.value as Llm["provider"];
                    setLlm({ provider, ...LLM_PRESETS[provider] });
                  }}
                >
                  {Object.entries(LLM_PROVIDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Model">
                <input
                  className="input"
                  value={settings.llm.model}
                  onChange={(e) => setLlm({ model: e.target.value })}
                />
              </Field>
              <Field label="Base URL" wide>
                <input
                  className="input"
                  value={settings.llm.baseUrl}
                  onChange={(e) => setLlm({ baseUrl: e.target.value })}
                />
              </Field>
              <Field label="API Key">
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-…"
                  value={settings.llm.apiKey}
                  onChange={(e) => setLlm({ apiKey: e.target.value })}
                />
              </Field>
              <Field label="Temperature" hint={settings.llm.temperature.toFixed(1)}>
                <input
                  className="slider"
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.llm.temperature}
                  onChange={(e) => setLlm({ temperature: Number.parseFloat(e.target.value) })}
                />
              </Field>
            </div>
          </section>

          <section className="block">
            <div className="section-head">
              <h3>语音 (TTS)</h3>
            </div>
            <div className="cfg-fields">
              <Field label="Provider">
                <select
                  className="select"
                  value={settings.tts.provider}
                  onChange={(e) => {
                    const provider = e.target.value as Tts["provider"];
                    setTts({ provider, ...TTS_PRESETS[provider] });
                  }}
                >
                  {Object.entries(TTS_PROVIDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Model">
                <input
                  className="input"
                  value={settings.tts.model}
                  onChange={(e) => setTts({ model: e.target.value })}
                />
              </Field>
              <Field label="Base URL" wide>
                <input
                  className="input"
                  value={settings.tts.baseUrl}
                  onChange={(e) => setTts({ baseUrl: e.target.value })}
                />
              </Field>
              <Field label="API Key">
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  value={settings.tts.apiKey}
                  onChange={(e) => setTts({ apiKey: e.target.value })}
                />
              </Field>
              <Field label="Voice">
                <input
                  className="input"
                  value={settings.tts.voice}
                  onChange={(e) => setTts({ voice: e.target.value })}
                />
              </Field>
              <Field label="Format">
                <select
                  className="select"
                  value={settings.tts.format}
                  onChange={(e) => setTts({ format: e.target.value as Tts["format"] })}
                >
                  <option value="wav">wav</option>
                  <option value="mp3">mp3</option>
                  <option value="pcm16">pcm16</option>
                </select>
              </Field>
              <Field label="语速" hint={`${settings.tts.speed.toFixed(1)}×`}>
                <input
                  className="slider"
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={settings.tts.speed}
                  onChange={(e) => setTts({ speed: Number.parseFloat(e.target.value) })}
                />
              </Field>
            </div>
          </section>

          <section className="block">
            <div className="section-head">
              <h3>素材与渲染</h3>
            </div>
            <div className="cfg-fields">
              <Field label="配图来源">
                <select
                  className="select"
                  value={settings.media.imageProvider}
                  onChange={(e) =>
                    setMedia({
                      imageProvider: e.target.value as StudioSettings["media"]["imageProvider"],
                    })
                  }
                >
                  <option value="none">无（渐变/排版）</option>
                  <option value="pexels">Pexels 图库</option>
                  <option value="openai">OpenAI 生图</option>
                </select>
              </Field>
              {settings.media.imageProvider === "pexels" ? (
                <Field label="Pexels API Key">
                  <input
                    className="input"
                    type="password"
                    autoComplete="off"
                    value={settings.media.pexelsApiKey ?? ""}
                    onChange={(e) => setMedia({ pexelsApiKey: e.target.value })}
                  />
                </Field>
              ) : null}
              {settings.media.imageProvider === "openai" ? (
                <>
                  <Field label="生图 Model">
                    <input
                      className="input"
                      value={settings.media.imageModel}
                      onChange={(e) => setMedia({ imageModel: e.target.value })}
                    />
                  </Field>
                  <Field label="生图 Base URL" wide>
                    <input
                      className="input"
                      value={settings.media.imageBaseUrl}
                      onChange={(e) => setMedia({ imageBaseUrl: e.target.value })}
                    />
                  </Field>
                  <Field label="生图 API Key">
                    <input
                      className="input"
                      type="password"
                      autoComplete="off"
                      value={settings.media.imageApiKey}
                      onChange={(e) => setMedia({ imageApiKey: e.target.value })}
                    />
                  </Field>
                </>
              ) : null}
              <Field label="画幅">
                <select
                  className="select"
                  value={settings.render.format}
                  onChange={(e) => {
                    const format = e.target.value as StudioSettings["render"]["format"];
                    const dims =
                      format === "landscape"
                        ? { width: 1920, height: 1080 }
                        : format === "square"
                          ? { width: 1080, height: 1080 }
                          : { width: 1080, height: 1920 };
                    setRender({ format, ...dims });
                  }}
                >
                  <option value="portrait">竖屏 9:16</option>
                  <option value="landscape">横屏 16:9</option>
                  <option value="square">方形 1:1</option>
                </select>
              </Field>
              <Field label="目标场景数" hint={`${settings.render.targetScenes}`}>
                <input
                  className="slider"
                  type="range"
                  min={1}
                  max={40}
                  step={1}
                  value={settings.render.targetScenes}
                  onChange={(e) =>
                    setRender({ targetScenes: Number.parseInt(e.target.value, 10) || 1 })
                  }
                />
              </Field>
              <Field label="宽度">
                <input
                  className="input"
                  type="number"
                  value={settings.render.width}
                  onChange={(e) => setRender({ width: Number.parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
              <Field label="高度">
                <input
                  className="input"
                  type="number"
                  value={settings.render.height}
                  onChange={(e) => setRender({ height: Number.parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
              <Field label="输出目录" wide>
                <input
                  className="input"
                  value={settings.render.outputDirectory}
                  onChange={(e) => setRender({ outputDirectory: e.target.value })}
                />
              </Field>
            </div>
          </section>
        </div>
      </main>

      <div className="save-bar">
        <div className="save-bar-inner">
          <div className="save-state">
            {dirtyCount > 0 ? (
              <span className="dirty-badge">
                <span className="dot" aria-hidden="true" />
                {dirtyCount} 项未保存改动
              </span>
            ) : (
              <span className="clean">{lastSavedLabel ?? "已是最新"}</span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || dirtyCount === 0}
            onClick={handleSave}
          >
            {saving ? <span className="spinner" aria-hidden="true" /> : null}
            {saving ? "保存中…" : "保存配置"}
          </button>
        </div>
      </div>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function Field(props: {
  readonly label: string;
  readonly hint?: string;
  readonly wide?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <div className={`field ${props.wide ? "span-2" : ""}`}>
      <span className="field-label">
        {props.label}
        {props.hint ? <span className="hint">{props.hint}</span> : null}
      </span>
      {props.children}
    </div>
  );
}
