import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@nocoo/basalt";
import type { ReactElement } from "react";
import { GitHubIcon, HexagonIcon } from "./icons";

export function HeaderTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function GitHubLink() {
  return (
    <HeaderTooltip label="GitHub 仓库">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-basalt-muted-foreground hover:text-basalt-foreground"
        asChild
      >
        <a
          href="https://github.com/nocoo/echo"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub 仓库（在新标签页打开）"
        >
          <GitHubIcon className="size-[18px]" />
          <span className="sr-only">GitHub 仓库（在新标签页打开）</span>
        </a>
      </Button>
    </HeaderTooltip>
  );
}

export function HexlyLink() {
  return (
    <HeaderTooltip label="Echo on hexly.ai">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-basalt-muted-foreground hover:text-basalt-foreground"
        asChild
      >
        <a
          href="https://hexly.ai/projects/echo"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Echo on hexly.ai（在新标签页打开）"
        >
          <HexagonIcon className="size-[18px]" />
          <span className="sr-only">Echo on hexly.ai（在新标签页打开）</span>
        </a>
      </Button>
    </HeaderTooltip>
  );
}
