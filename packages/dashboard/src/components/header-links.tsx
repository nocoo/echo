import { Tooltip, TooltipContent, TooltipTrigger } from "@nocoo/basalt";
import { LinkButton } from "@nocoo/basalt/components/button";
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
      <LinkButton
        variant="ghost"
        size="icon"
        href="https://github.com/nocoo/echo"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub 仓库（在新标签页打开）"
      >
        <GitHubIcon className="size-[18px]" aria-hidden="true" />
        <span className="sr-only">GitHub 仓库（在新标签页打开）</span>
      </LinkButton>
    </HeaderTooltip>
  );
}

export function HexlyLink() {
  return (
    <HeaderTooltip label="echo on hexly.ai">
      <LinkButton
        variant="ghost"
        size="icon"
        href="https://hexly.ai/projects/echo"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="echo on hexly.ai（在新标签页打开）"
      >
        <HexagonIcon className="size-[18px]" aria-hidden="true" />
        <span className="sr-only">echo on hexly.ai（在新标签页打开）</span>
      </LinkButton>
    </HeaderTooltip>
  );
}
