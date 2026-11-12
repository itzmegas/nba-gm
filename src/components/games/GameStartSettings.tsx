"use client";

import { useId } from "react";
import { useT } from "@/application/providers/I18nProvider";
import { GAME_START_MODE, type GameStartMode } from "@/domain/entities/GameStartSettings";

interface GameStartSettingsProps {
  value: GameStartMode;
  onChange: (mode: GameStartMode) => void;
}

export function GameStartSettings({ value, onChange }: GameStartSettingsProps) {
  const t = useT();
  const id = useId();

  return (
    <fieldset className="space-y-3" aria-describedby={`${id}-cutoff`}>
      <legend className="text-sm font-semibold">{t("games", "settings")}</legend>
      <p className="text-sm text-muted-foreground">{t("games", "startDate")}</p>
      <div className="flex flex-wrap gap-4">
        {Object.values(GAME_START_MODE).map((mode) => (
          <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${id}-start-mode`}
              value={mode}
              checked={value === mode}
              onChange={() => onChange(mode)}
              className="accent-primary"
            />
            {t("games", mode === GAME_START_MODE.TODAY ? "startToday" : "startSeason")}
          </label>
        ))}
      </div>
      <p id={`${id}-cutoff`} className="text-sm text-muted-foreground">
        {t("games", "startCutoffDescription")}
      </p>
    </fieldset>
  );
}
