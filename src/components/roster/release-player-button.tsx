"use client";

import { useState } from "react";
import { useReleasePlayer } from "@/application/hooks/roster/useReleasePlayer";
import type { RosterPlayer } from "@/application/hooks/roster/useRoster";
import { useT } from "@/application/providers/I18nProvider";
import { useBatchSimulationStore } from "@/application/stores/useBatchSimulationStore";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ReleasePlayerButton({
  gameId,
  rosterPlayer,
}: {
  gameId: string;
  rosterPlayer: RosterPlayer;
}) {
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState("");
  const release = useReleasePlayer();
  const isSimulating = useBatchSimulationStore((state) => state.isActive);
  const t = useT();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!release.isPending) setOpen(value);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isSimulating || release.isPending}
          aria-label={`${t("dashboard", "releasePlayer")} ${rosterPlayer.player.fullName}`}
          onClick={(event) => {
            event.stopPropagation();
            release.reset();
            setRequestId(crypto.randomUUID());
          }}
        >
          {t("dashboard", "releasePlayer")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("dashboard", "releasePlayer")} — {rosterPlayer.player.fullName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("dashboard", "releasePlayerDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {release.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("dashboard", "releasePlayerFailed")} {release.error.message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={release.isPending}>
            {t("common", "cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isSimulating || release.isPending}
            onClick={() =>
              release.mutate(
                {
                  gameId,
                  playerId: rosterPlayer.player.id,
                  contractId:
                    rosterPlayer.contract?.id ?? rosterPlayer.gameContract?.agreement?.id ?? null,
                  requestId,
                },
                { onSuccess: () => setOpen(false) }
              )
            }
          >
            {t("dashboard", release.isPending ? "releasingPlayer" : "confirmReleasePlayer")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
