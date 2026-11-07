import {
  Button,
  ContentIsland,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarIconItem,
  SidebarItem,
  SidebarNav,
  SidebarPartition,
  SidebarUser,
  ThemeToggle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { BasaltMark } from "@nocoo/basalt/components/basalt-mark";
import { Boxes, KeyRound, PanelLeft, Search, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import type { MeResponse } from "../lib/api";
import { apiClient } from "../lib/api";

interface NavEntry {
  href: string;
  label: string;
  icon: typeof Boxes;
}

const NAV_ENTRIES: NavEntry[] = [
  { href: "/", label: "概览", icon: Boxes },
  { href: "/lookup", label: "查询", icon: Search },
  { href: "/tools", label: "工具", icon: Wrench },
  { href: "/keys", label: "密钥", icon: KeyRound },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "概览",
  "/lookup": "查询",
  "/tools": "工具",
  "/keys": "密钥",
};

export function AppFrame() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<MeResponse | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const title = PAGE_TITLES[location.pathname] ?? "Echo 管理台";
  const active = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  useEffect(() => {
    void apiClient
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const logout = () => {
    void apiClient.logout().finally(() => {
      setUser(null);
      navigate("/login");
    });
  };

  return (
    <AppShell>
      <AppSkipLink>跳到主内容</AppSkipLink>
      <Sidebar collapsed={collapsed}>
        <SidebarHeader>
          <div className="flex w-full items-center justify-between">
            {collapsed ? (
              <>
                <BasaltMark className="h-5 w-5 shrink-0" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="mb-basalt-space-sm self-center"
                  onClick={() => setCollapsed(false)}
                  aria-label="展开侧边栏"
                >
                  <PanelLeft aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-basalt-space-lg">
                  <BasaltMark className="h-5 w-5 shrink-0" />
                  <span className="truncate text-lg font-semibold text-basalt-foreground">
                    Echo
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setCollapsed(true)}
                  aria-label="收起侧边栏"
                >
                  <PanelLeft aria-hidden="true" />
                </Button>
              </>
            )}
          </div>
        </SidebarHeader>
        <SidebarNav>
          {collapsed ? (
            NAV_ENTRIES.map((entry) => (
              <Tooltip key={entry.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  <SidebarIconItem
                    active={active(entry.href)}
                    aria-label={entry.label}
                    onClick={() => navigate(entry.href)}
                  >
                    <entry.icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </SidebarIconItem>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {entry.label}
                </TooltipContent>
              </Tooltip>
            ))
          ) : (
            <>
              <SidebarPartition>管理</SidebarPartition>
              <div className="flex flex-col gap-basalt-nav-gap">
                {NAV_ENTRIES.map((entry) => (
                  <SidebarItem
                    key={entry.href}
                    active={active(entry.href)}
                    onClick={() => navigate(entry.href)}
                  >
                    <entry.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span className="flex-1 truncate text-left">{entry.label}</span>
                  </SidebarItem>
                ))}
              </div>
            </>
          )}
        </SidebarNav>
        <SidebarFooter>
          <SidebarUser
            name={user?.name ?? user?.email ?? "未登录"}
            email={user?.email ?? "—"}
            action={
              <Button variant="ghost" size="sm" onClick={logout}>
                退出
              </Button>
            }
          />
        </SidebarFooter>
      </Sidebar>
      <AppMain>
        <AppHeader
          title={title}
          actions={
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ThemeToggle aria-label="切换主题" />
                </span>
              </TooltipTrigger>
              <TooltipContent>切换主题</TooltipContent>
            </Tooltip>
          }
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:px-basalt-layout-sm md:pb-basalt-layout-sm">
          <ContentIsland>
            <Outlet />
          </ContentIsland>
        </div>
      </AppMain>
    </AppShell>
  );
}
