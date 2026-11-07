import { Button } from "@nocoo/basalt";
import { useSearchParams } from "react-router";
import { Logo } from "../../components/Logo";
import { SITE_NAME } from "../../lib/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "登录请求不完整，请重试。",
  invalid_state: "登录状态校验失败，请重试。",
  oauth_failed: "Google 登录失败，请重试。",
  access_denied: "该邮箱不在白名单内。",
};

export default function LoginPage() {
  const [params] = useSearchParams();
  const error = params.get("error");
  const message = error ? (ERROR_MESSAGES[error] ?? "登录失败，请重试。") : null;

  const signIn = () => {
    window.location.assign("/api/auth/google");
  };

  return (
    <div className="basalt-ui relative flex min-h-dvh items-center justify-center bg-basalt-background p-basalt-space-lg">
      <div
        data-basalt-surface-root=""
        className="flex w-72 max-w-full flex-col overflow-hidden rounded-basalt-lg bg-basalt-card ring-1 ring-basalt-border"
      >
        <div className="flex items-center justify-between gap-basalt-space-lg bg-basalt-primary px-basalt-space-lg py-basalt-space-lg">
          <span className="text-basalt-base font-semibold text-basalt-primary-foreground">
            {SITE_NAME}
          </span>
          <span className="text-basalt-xs font-medium uppercase tracking-widest text-basalt-primary-foreground/80">
            Admin
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-basalt-space-lg px-basalt-space-lg py-basalt-space-lg">
          <Logo size="lg" />
          <p className="text-basalt-xl font-semibold text-basalt-foreground">管理台</p>
          <p className="text-basalt-sm text-basalt-muted-foreground">使用 Google 账号登录</p>
          {message ? (
            <p className="w-full rounded-basalt-md bg-basalt-danger-tint px-basalt-space-md py-basalt-space-sm text-basalt-sm text-basalt-danger">
              {message}
            </p>
          ) : null}
          <Button className="w-full" onClick={signIn}>
            使用 Google 登录
          </Button>
        </div>
        <div className="border-t border-basalt-border px-basalt-space-lg py-basalt-space-lg">
          <p className="text-basalt-xs text-basalt-muted-foreground">仅限白名单邮箱可登录</p>
        </div>
      </div>
    </div>
  );
}
