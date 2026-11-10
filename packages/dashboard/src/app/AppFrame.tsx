import {
  Button,
  ContentIsland,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  toast,
} from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { LoadingScreen } from "@nocoo/basalt/components/loading-screen";
import { Menu } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { GitHubLink, HexlyLink } from "../components/header-links";
import { IslandSkeleton } from "../components/island-skeleton";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/theme-toggle";
import type { MeResponse } from "../lib/api";
import { apiClient, describeError } from "../lib/api";
import { resolvePageContext } from "../lib/navigation";
import { useIsMobile } from "../lib/use-is-mobile";
import { AppSidebar } from "./AppSidebar";

type AuthState = "loading" | "anonymous" | "authenticated";

export function AppFrame() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>("loading");
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const page = resolvePageContext(location.pathname);
  const headerBreadcrumbs = page.breadcrumbs.length > 0 ? page.breadcrumbs : undefined;

  useEffect(() => {
    let active = true;
    void apiClient
      .me()
      .then((me) => {
        if (!active) return;
        setUser(me);
        setAuth(me.authenticated ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (active) setAuth("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => setAuth("anonymous"));
    return () => apiClient.setUnauthorizedHandler(null);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a route change closes the drawer without remounting the shell.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiClient.logout();
      setUser(null);
      setAuth("anonymous");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error("退出失败", {
        description: describeError(error),
        action: { label: "重试", onClick: () => void logout() },
      });
    } finally {
      setLoggingOut(false);
    }
  };

  if (auth === "loading") {
    return <LoadingScreen label="校验会话" mark={<Logo size="lg" />} />;
  }

  if (auth === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <AppSkipLink>跳到主内容</AppSkipLink>
      {!isMobile ? (
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
          user={user}
          onLogout={() => void logout()}
          loggingOut={loggingOut}
        />
      ) : null}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[260px] max-w-[260px] border-0 bg-basalt-background p-0"
        >
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          <AppSidebar
            collapsed={false}
            onToggle={() => setMobileOpen(false)}
            user={user}
            onLogout={() => void logout()}
            loggingOut={loggingOut}
          />
        </SheetContent>
        <AppMain>
          <AppHeader
            density={isMobile ? "compact" : "comfortable"}
            leading={
              isMobile ? (
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="打开导航菜单">
                    <Menu className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                  </Button>
                </SheetTrigger>
              ) : null
            }
            breadcrumbs={headerBreadcrumbs}
            title={page.title}
            actions={
              <div className="flex items-center gap-1">
                <GitHubLink />
                <HexlyLink />
                <ThemeToggle />
              </div>
            }
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-basalt-space-lg pb-basalt-space-lg md:px-basalt-layout-sm md:pb-basalt-layout-sm">
            <ContentIsland>
              <Suspense fallback={<IslandSkeleton variant={page.variant} />}>
                <Outlet />
              </Suspense>
            </ContentIsland>
          </div>
        </AppMain>
      </Sheet>
    </AppShell>
  );
}
