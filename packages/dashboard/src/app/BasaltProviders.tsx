import { LinkProvider, ThemeProvider, Toaster, TooltipProvider } from "@nocoo/basalt";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";

function AppRouterLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "to"> & { href: string }) {
  return <Link to={href} {...props} />;
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
