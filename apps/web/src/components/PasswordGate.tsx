import { type FormEvent, type ReactNode, useState } from "react";
import { login } from "../api";
import { type AuthScope, getToken } from "../lib/auth";

export function PasswordGate(props: {
  readonly scope: AuthScope;
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
}) {
  const [authed, setAuthed] = useState(() => getToken(props.scope) != null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (authed) {
    return <>{props.children}</>;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await login(props.scope, password);
      setAuthed(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <div className="brand-mark gate-mark" aria-hidden="true">
          HF
        </div>
        <h1 className="gate-title">{props.title}</h1>
        <p className="gate-sub">{props.subtitle}</p>

        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="访问密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <p className="gate-error">{error}</p> : null}

        <button type="submit" className="btn btn-primary gate-submit" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? "验证中…" : "进入"}
        </button>
      </form>
    </div>
  );
}
