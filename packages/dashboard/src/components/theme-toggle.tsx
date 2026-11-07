import { Button } from "@nocoo/basalt";
import { type BasaltTheme, useTheme } from "@nocoo/basalt/providers/theme";
import { Monitor, Moon, Sun } from "lucide-react";
import { HeaderTooltip } from "./header-links";

const NEXT_THEME: Record<BasaltTheme, BasaltTheme> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const NEXT_LABEL: Record<BasaltTheme, string> = {
  light: "切换为深色主题",
  dark: "切换为跟随系统主题",
  system: "切换为浅色主题",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;

  return (
    <HeaderTooltip label={NEXT_LABEL[theme]}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-basalt-muted-foreground hover:text-basalt-foreground"
        onClick={() => setTheme(NEXT_THEME[theme])}
        aria-label="切换主题"
      >
        <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </Button>
    </HeaderTooltip>
  );
}
