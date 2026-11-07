import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarIconItem,
  SidebarItem,
  SidebarNav,
  SidebarPartition,
  SidebarUser,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@nocoo/basalt";
import { Boxes, KeyRound, LogOut, PanelLeft, Search, Wrench } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { Logo } from "../components/Logo";
import type { MeResponse } from "../lib/api";
import {
  isActivePath,
  NAV_GROUPS,
  NAV_ITEMS,
  resolveDisplayUser,
  SITE_NAME,
} from "../lib/navigation";

const NAV_ICONS: Record<string, typeof Boxes> = {
  "/": Boxes,
  "/lookup": Search,
  "/tools": Wrench,
  "/keys": KeyRound,
};

function iconFor(href: string) {
  return NAV_ICONS[href] ?? Boxes;
}

export interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: MeResponse | null;
  onLogout: () => void;
  loggingOut: boolean;
}

export function AppSidebar({ collapsed, onToggle, user, onLogout, loggingOut }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const display = resolveDisplayUser(user?.name ?? null, user?.email ?? null);
  const name = display.label;
  const email = user?.email?.trim() ?? "";

  const avatar = (
    <Avatar className="h-8 w-8">
      {user?.picture ? <AvatarImage src={user.picture} alt="" /> : null}
      <AvatarFallback className="text-xs">{display.initials}</AvatarFallback>
    </Avatar>
  );

  const logoutButton = (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-basalt-muted-foreground hover:text-basalt-foreground"
          onClick={onLogout}
          loading={loggingOut}
          aria-label="退出登录"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        退出登录
      </TooltipContent>
    </Tooltip>
  );

  return (
    <Sidebar collapsed={collapsed}>
      <SidebarHeader>
        {collapsed ? (
          <Logo size="sm" />
        ) : (
          <div className="flex w-full items-center justify-between">
            <div className="flex min-w-0 items-center gap-basalt-space-lg">
              <Logo size="sm" />
              <span className="truncate text-lg font-semibold text-basalt-foreground md:text-xl">
                {SITE_NAME}
              </span>
              <span className="shrink-0 rounded-md bg-basalt-secondary px-basalt-space-md py-basalt-space-xs text-[11px] leading-none font-medium text-basalt-muted-foreground">
                v{__ECHO_VERSION__}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onToggle}
              aria-label="收起侧边栏"
            >
              <PanelLeft aria-hidden="true" />
            </Button>
          </div>
        )}
      </SidebarHeader>

      {collapsed ? (
        <Button
          variant="ghost"
          size="icon"
          className="mb-basalt-space-sm self-center"
          onClick={onToggle}
          aria-label="展开侧边栏"
        >
          <PanelLeft aria-hidden="true" />
        </Button>
      ) : null}

      <SidebarNav>
        {collapsed
          ? NAV_ITEMS.map((item) => {
              const Icon = iconFor(item.href);
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <SidebarIconItem
                      active={isActivePath(location.pathname, item.href)}
                      aria-label={item.label}
                      onClick={() => navigate(item.href)}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    </SidebarIconItem>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })
          : NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <SidebarPartition>{group.label}</SidebarPartition>
                <div className="flex flex-col gap-basalt-nav-gap">
                  {group.items.map((item) => {
                    const Icon = iconFor(item.href);
                    return (
                      <SidebarItem
                        key={item.href}
                        active={isActivePath(location.pathname, item.href)}
                        onClick={() => navigate(item.href)}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        <span className="flex-1 truncate text-left">{item.label}</span>
                      </SidebarItem>
                    );
                  })}
                </div>
              </div>
            ))}
      </SidebarNav>

      <SidebarFooter>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <span className="inline-flex">{avatar}</span>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {name}
            </TooltipContent>
          </Tooltip>
        ) : (
          <SidebarUser name={name} email={email} avatar={avatar} action={logoutButton} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
