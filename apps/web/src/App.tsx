import { Admin } from "./apps/Admin";
import { Studio } from "./apps/Studio";
import { PasswordGate } from "./components/PasswordGate";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "");

  if (path === "/admin" || path.startsWith("/admin/")) {
    return (
      <PasswordGate scope="admin" title="Studio 后台" subtitle="输入管理密码以配置模型与渲染。">
        <Admin />
      </PasswordGate>
    );
  }

  return (
    <PasswordGate scope="user" title="HyperFrames Studio" subtitle="输入访问密码以使用工作台。">
      <Studio />
    </PasswordGate>
  );
}
