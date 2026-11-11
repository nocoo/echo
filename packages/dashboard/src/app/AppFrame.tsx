import { ContentIsland, SidebarProvider, toast } from "@nocoo/basalt";
import { AppHeader, AppHeaderMenuButton, ProjectLinks } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { LoadingScreen } from "@nocoo/basalt/components/loading-screen";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nocoo/basalt/components/sheet";
import { ThemeToggle } from "@nocoo/basalt/components/theme-toggle";
import { Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { IslandSkeleton } from "../components/island-skeleton";
import { Logo } from "../components/Logo";
import type { MeResponse } from "../lib/api";
import { apiClient, describeError } from "../lib/api";
import { resolvePageContext } from "../lib/navigation";
import { useIsMobile } from "../lib/use-is-mobile";
import { AppSidebar, PersistedSidebarProvider } from "./AppSidebar";
import { MobileNavProvider, useMobileNav } from "./mobile-nav-context";

type AuthState = "loading" | "anonymous" | "authenticated";

function AppFrameShell() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const { mobileOpen, setMobileOpen } = useMobileNav();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const menuButton = useRef<HTMLButtonElement>(null);
  const page = resolvePageContext(location.pathname);

  const allBreadcrumbs = [{ label: "首页", href: "/" }, ...page.breadcrumbs];
  const headerBreadcrumbs = isMobile ? allBreadcrumbs.slice(-1) : allBreadcrumbs;

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
  }, [isMobile, setMobileOpen]);

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

  const handleSignOut = () => {
    if (!loggingOut) void logout();
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
        <PersistedSidebarProvider>
          <AppSidebar user={user} onSignOut={handleSignOut} />
        </PersistedSidebarProvider>
      ) : null}

      {isMobile ? (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[260px] max-w-[260px] border-0 bg-basalt-background p-0 sm:max-w-[260px] sm:p-0"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              menuButton.current?.focus();
            }}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>导航菜单</SheetTitle>
              <SheetDescription>浏览 Echo 管理台页面</SheetDescription>
            </SheetHeader>
            <SidebarProvider collapsed={false} defaultWidth={260}>
              <AppSidebar
                variant="mobile"
                user={user}
                onSignOut={handleSignOut}
                onNavigate={() => setMobileOpen(false)}
                onDismiss={() => setMobileOpen(false)}
              />
            </SidebarProvider>
          </SheetContent>
        </Sheet>
      ) : null}

      <AppMain>
        <AppHeader
          density={isMobile ? "compact" : "comfortable"}
          leading={
            isMobile ? (
              <AppHeaderMenuButton
                ref={menuButton}
                label="打开导航菜单"
                onClick={() => setMobileOpen(true)}
              />
            ) : null
          }
          breadcrumbs={headerBreadcrumbs}
          breadcrumbsLabel="面包屑导航"
          title={page.title}
          actions={
            <>
              <ProjectLinks github="nocoo/echo" hexly="echo" name="Echo" />
              <ThemeToggle
                aria-label="切换主题"
                labels={{
                  light: "切换为浅色主题",
                  dark: "切换为深色主题",
                  system: "切换为跟随系统主题",
                }}
              />
            </>
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
    </AppShell>
  );
}

export function AppFrame() {
  return (
    <MobileNavProvider>
      <AppFrameShell />
    </MobileNavProvider>
  );
}
