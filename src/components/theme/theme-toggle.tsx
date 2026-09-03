"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useT } from "@/application/providers/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_OPTIONS = [
  { value: "light", icon: Sun, labelKey: "themeLight" },
  { value: "dark", icon: Moon, labelKey: "themeDark" },
  { value: "system", icon: Monitor, labelKey: "themeSystem" },
] as const;

/**
 * Cycles between light / dark / system color schemes via next-themes.
 * Renders a stable placeholder until mounted to avoid hydration mismatches.
 */
export function ThemeToggle() {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("dashboard", "themeToggle")}
          disabled={!mounted}
        >
          {/* Stable placeholder icon until mounted; resolvedTheme is client-only. */}
          {mounted && resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Sun className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon className="h-4 w-4" />
            {t("dashboard", labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
