import { LinkProvider, ThemeProvider, Toaster, TooltipProvider } from "@nocoo/basalt";
import type { ReactNode } from "react";
import { Link } from "react-router";

function AppRouterLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

export function BasaltProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <LinkProvider render={AppRouterLink}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </LinkProvider>
    </ThemeProvider>
  );
}
