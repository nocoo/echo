export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export type PageVariant = "overview" | "lookup" | "tools" | "keys" | "default";

export interface Breadcrumb {
  href?: string;
  label: string;
}

export interface PageContext {
  title: string;
  breadcrumbs: Breadcrumb[];
  documentTitle: string;
  variant: PageVariant;
}

export interface DisplayUser {
  label: string;
  initials: string;
}

export const SITE_NAME = "echo";

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

const LOGIN_TITLE = "登录";
const FALLBACK_TITLE = "管理台";
const UNKNOWN_USER = "已登录";

const VARIANTS: Record<string, PageVariant> = {
  "/": "overview",
  "/lookup": "lookup",
  "/tools": "tools",
  "/keys": "keys",
};

export function normalizePath(pathname: string): string {
  const normalized = pathname.trim().toLowerCase().replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

export function isActivePath(pathname: string, href: string): boolean {
  return normalizePath(pathname) === normalizePath(href);
}

export function pageVariant(pathname: string): PageVariant {
  return VARIANTS[normalizePath(pathname)] ?? "default";
}

export function resolvePageContext(pathname: string): PageContext {
  const path = normalizePath(pathname);
  const variant = pageVariant(path);

  if (path === "/login") {
    return pageContext(LOGIN_TITLE, variant, []);
  }

  const group = NAV_GROUPS.find((entry) =>
    entry.items.some((item) => isActivePath(path, item.href)),
  );
  const item = group?.items.find((entry) => isActivePath(path, entry.href));

  if (!group || !item) {
    return pageContext(FALLBACK_TITLE, variant, []);
  }

  return pageContext(item.label, variant, item.href === "/" ? [] : [{ label: group.label }]);
}

export function resolveDisplayUser(
  name: string | null,
  email: string | null,
  fallback: string = UNKNOWN_USER,
): DisplayUser {
  const label = firstNonBlank([name, email]) ?? fallback;
  return { label, initials: userInitials(label) };
}

export function userInitials(source: string): string {
  const first = firstGrapheme(source);
  return first ? first.toLocaleUpperCase() : "?";
}

function pageContext(title: string, variant: PageVariant, breadcrumbs: Breadcrumb[]): PageContext {
  return { title, breadcrumbs, documentTitle: `${title} · ${SITE_NAME}`, variant };
}

function firstNonBlank(values: (string | null)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function firstGrapheme(value: string): string {
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
    value.trim(),
  )) {
    return segment;
  }
  return "";
}
