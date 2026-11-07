export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const SITE_NAME = "Echo";

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "数据",
    items: [
      { href: "/", label: "概览" },
      { href: "/lookup", label: "查询" },
      { href: "/tools", label: "工具" },
    ],
  },
  {
    label: "系统",
    items: [{ href: "/keys", label: "密钥" }],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export interface Breadcrumb {
  href?: string;
  label: string;
}

export interface PageContext {
  title: string;
  breadcrumbs: Breadcrumb[];
  documentTitle: string;
}

const LOGIN_TITLE = "登录";
const FALLBACK_TITLE = "管理台";

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function resolvePageContext(pathname: string): PageContext {
  if (pathname === "/login") {
    return pageContext(LOGIN_TITLE, []);
  }

  const group = NAV_GROUPS.find((entry) =>
    entry.items.some((item) => isActivePath(pathname, item.href)),
  );
  const item = group?.items.find((entry) => isActivePath(pathname, entry.href));

  if (!group || !item) {
    return pageContext(FALLBACK_TITLE, []);
  }

  return pageContext(item.label, item.href === "/" ? [] : [{ label: group.label }]);
}

export function userInitials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "";
  return source.length > 0 ? source.slice(0, 1).toUpperCase() : "?";
}

function pageContext(title: string, breadcrumbs: Breadcrumb[]): PageContext {
  return { title, breadcrumbs, documentTitle: `${title} · ${SITE_NAME}` };
}
