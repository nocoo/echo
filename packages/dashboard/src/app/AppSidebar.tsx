import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Link,
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarIconItem,
  SidebarItem,
  SidebarNav,
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

const SIDEBAR_MARK_SLOT_CLASS = "flex w-full items-center";

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
    <Avatar className="h-9 w-9 shrink-0">
      {user?.picture ? <AvatarImage src={user.picture} alt="" /> : null}
      <AvatarFallback className="text-basalt-sm">{display.initials}</AvatarFallback>
    </Avatar>
  );

  const logoutButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={onLogout}
      loading={loggingOut}
      aria-label="退出登录"
    >
      <LogOut aria-hidden="true" />
    </Button>
  );

  return (
    <Sidebar collapsed={collapsed}>
      <SidebarHeader>
        <div
          className={[
            SIDEBAR_MARK_SLOT_CLASS,
            collapsed ? "justify-center" : "justify-between pl-basalt-layout-sm",
          ].join(" ")}
        >
          <Link
            href="/"
            aria-label={SITE_NAME}
            className="flex min-w-0 items-center gap-basalt-space-lg text-basalt-foreground no-underline hover:no-underline"
          >
            <Logo size="sm" className="h-7 w-7 object-contain" />
            {collapsed ? null : (
              <>
                <span className="truncate text-basalt-xl font-semibold text-basalt-foreground">
                  {SITE_NAME}
                </span>
                <span className="shrink-0 rounded-basalt-md bg-basalt-secondary px-basalt-space-md py-basalt-space-xs text-basalt-sm leading-basalt-tight font-medium text-basalt-muted-foreground">
                  v{__ECHO_VERSION__}
                </span>
              </>
            )}
          </Link>
          {collapsed ? null : (
            <Button variant="ghost" size="icon" onClick={onToggle} aria-label="收起侧边栏">
              <PanelLeft aria-hidden="true" />
            </Button>
          )}
        </div>
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
                      active={isActivePath(location.pathname, item.href)}
                      onClick={() => navigate(item.href)}
                    >
                      <Icon strokeWidth={1.5} aria-hidden="true" />
                      {item.label}
                    </SidebarItem>
                  );
                })}
              </SidebarGroup>
            ))}
      </SidebarNav>

      <SidebarFooter>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{avatar}</TooltipTrigger>
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
