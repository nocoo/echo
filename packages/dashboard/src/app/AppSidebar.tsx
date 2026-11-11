import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Sidebar,
  SidebarBrand,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarIconItem,
  SidebarItem,
  SidebarNav,
  SidebarProvider,
  SidebarToggle,
  SidebarUser,
} from "@nocoo/basalt";
import { useSidebar } from "@nocoo/basalt/components/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nocoo/basalt/components/tooltip";
import { Boxes, KeyRound, Search, Wrench } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { useLocation } from "react-router";
import { Logo } from "../components/Logo";
import type { MeResponse } from "../lib/api";
import {
  isActivePath,
  NAV_GROUPS,
  NAV_ITEMS,
  resolveDisplayUser,
  SITE_NAME,
} from "../lib/navigation";

const SIDEBAR_COLLAPSED_KEY = "echo:sidebar-collapsed";
type SidebarCollapsedPreference = "false" | "true";

const NAV_ICONS: Record<string, typeof Boxes> = {
  "/": Boxes,
  "/lookup": Search,
  "/tools": Wrench,
  "/keys": KeyRound,
};

function iconFor(href: string) {
  return NAV_ICONS[href] ?? Boxes;
}

function usePersistedSidebarCollapsed(
  key: string,
  defaultValue: SidebarCollapsedPreference,
): [SidebarCollapsedPreference, (value: SidebarCollapsedPreference) => void] {
  const [stored, setStored] = useState<SidebarCollapsedPreference>(() => {
    if (typeof window === "undefined") return defaultValue;
    const value = localStorage.getItem(key);
    return value === "true" || value === "false" ? value : defaultValue;
  });

  const setValue = useCallback(
    (next: SidebarCollapsedPreference) => {
      setStored(next);
      localStorage.setItem(key, next);
    },
    [key],
  );

  return [stored, setValue];
}

export function PersistedSidebarProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistedSidebarCollapsed(SIDEBAR_COLLAPSED_KEY, "false");
  const collapsed = stored === "true";
  const onCollapsedChange = useCallback(
    (next: boolean) => {
      setStored(next ? "true" : "false");
    },
    [setStored],
  );

  return (
    <SidebarProvider collapsed={collapsed} onCollapsedChange={onCollapsedChange} defaultWidth={260}>
      {children}
    </SidebarProvider>
  );
}

export interface AppSidebarProps {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
  onDismiss?: () => void;
  user: MeResponse | null;
  onSignOut: () => void;
}

function EchoSidebarBody({ variant, onNavigate, onDismiss, user, onSignOut }: AppSidebarProps) {
  const location = useLocation();
  const { collapsed, peek, peeking } = useSidebar();
  const railCollapsed = collapsed && !(peek && peeking);
  const display = resolveDisplayUser(user?.name ?? null, user?.email ?? null);
  const name = display.label;
  const email = user?.email?.trim() ?? "";

  const avatar = (
    <Avatar>
      {user?.picture ? <AvatarImage src={user.picture} alt="" /> : null}
      <AvatarFallback className="text-basalt-sm">{display.initials}</AvatarFallback>
    </Avatar>
  );

  return (
    <>
      <SidebarHeader>
        <SidebarBrand
          logo={<Logo size="sidebar" />}
          name={SITE_NAME}
          version={`v${__ECHO_VERSION__}`}
          action={
            variant === "mobile" ? (
              <SidebarToggle
                mode="dismiss"
                dismissLabel="关闭导航菜单"
                {...(onDismiss ? { onDismiss } : {})}
              />
            ) : (
              <SidebarToggle expandLabel="展开侧边栏" collapseLabel="收起侧边栏" />
            )
          }
        />
      </SidebarHeader>

      <SidebarNav aria-label="主导航">
        {railCollapsed
          ? NAV_ITEMS.map((item) => {
              const Icon = iconFor(item.href);
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <SidebarIconItem
                      href={item.href}
                      active={isActivePath(location.pathname, item.href)}
                      aria-label={item.label}
                      onClick={onNavigate}
                    >
                      <Icon strokeWidth={1.5} aria-hidden="true" />
                    </SidebarIconItem>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })
          : NAV_GROUPS.map((group) => (
              <SidebarGroup key={group.label} label={group.label}>
                {group.items.map((item) => {
                  const Icon = iconFor(item.href);
                  return (
                    <SidebarItem
                      key={item.href}
                      href={item.href}
                      active={isActivePath(location.pathname, item.href)}
                      onClick={onNavigate}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                    </SidebarItem>
                  );
                })}
              </SidebarGroup>
            ))}
      </SidebarNav>

      <SidebarFooter>
        <SidebarUser
          name={name}
          email={email || undefined}
          avatar={avatar}
          tooltip={name}
          onSignOut={onSignOut}
          signOutLabel="退出登录"
        />
      </SidebarFooter>
    </>
  );
}

export function AppSidebar({
  variant = "desktop",
  onNavigate,
  onDismiss,
  user,
  onSignOut,
}: AppSidebarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar aria-label={variant === "mobile" ? "导航抽屉" : "主导航"} resizable={false}>
        <EchoSidebarBody
          variant={variant}
          user={user}
          onSignOut={onSignOut}
          {...(onNavigate ? { onNavigate } : {})}
          {...(onDismiss ? { onDismiss } : {})}
        />
      </Sidebar>
    </TooltipProvider>
  );
}
