"use client";

import { CheckCircle2, ChevronRight, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateGame } from "@/application/hooks/games/useCreateGame";
import { useTeams } from "@/application/hooks/teams/useTeams";
import {
  selectCreateError,
  selectIsCreating,
  selectPendingGameName,
  selectPendingSelectedTeamId,
  useGameStore,
} from "@/application/stores/useGameStore";
import {
  selectConferenceFilter,
  selectSearchQuery,
  useTeamStore,
} from "@/application/stores/useTeamStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULT_SEASON_YEAR = 2025;

export function CreateGameForm() {
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);

  const pendingSelectedTeamId = useGameStore(selectPendingSelectedTeamId);
  const pendingGameName = useGameStore(selectPendingGameName);
  const createError = useGameStore(selectCreateError);
  const isCreating = useGameStore(selectIsCreating);

  const setPendingSelectedTeamId = useGameStore((state) => state.setPendingSelectedTeamId);
  const setPendingGameName = useGameStore((state) => state.setPendingGameName);
  const startCreate = useGameStore((state) => state.startCreate);
  const finishCreate = useGameStore((state) => state.finishCreate);
  const failCreate = useGameStore((state) => state.failCreate);
  const resetCreateFlow = useGameStore((state) => state.resetCreateFlow);

  const searchQuery = useTeamStore(selectSearchQuery);
  const conferenceFilter = useTeamStore(selectConferenceFilter);
  const setSearchQuery = useTeamStore((state) => state.setSearchQuery);
  const setConferenceFilter = useTeamStore((state) => state.setConferenceFilter);

  const { data: teams, isLoading, error } = useTeams();
  const createGameMutation = useCreateGame();

  const filteredTeams =
    teams?.filter((team) => {
      const matchesSearch =
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.abbreviation.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesConference =
        conferenceFilter === "all" || team.conference?.toLowerCase() === conferenceFilter;

      return matchesSearch && matchesConference;
    }) ?? [];

  const selectedTeam = teams?.find((team) => team.id === pendingSelectedTeamId);

  const handleCreateGame = async () => {
    if (!pendingSelectedTeamId) {
      setLocalError("Seleccioná una franquicia para crear una partida.");
      return;
    }

    setLocalError(null);
    startCreate();

    try {
      const createdGame = await createGameMutation.mutateAsync({
        name: pendingGameName.trim() || `${selectedTeam?.name ?? "Franchise"} Franchise Save`,
        selectedTeamId: pendingSelectedTeamId,
        seasonYear: DEFAULT_SEASON_YEAR,
        currentDate: new Date(`${DEFAULT_SEASON_YEAR}-10-22T00:00:00.000Z`),
      });

      finishCreate(createdGame.id);
      router.push(`/games/${createdGame.id}/dashboard`);
      router.refresh();
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : "No se pudo crear la partida.";
      failCreate(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-muted-foreground animate-pulse">Cargando franquicias NBA...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-center">
        <h3 className="font-bold mb-2">Error de Conexión</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500 pb-28">
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Configuración de Partida</h2>
            <p className="text-sm text-muted-foreground">
              Elegí un nombre opcional para identificar este universo de simulación.
            </p>
          </div>

          <Input
            type="text"
            value={pendingGameName}
            onChange={(event) => setPendingGameName(event.target.value)}
            placeholder={selectedTeam ? `${selectedTeam.name} Dynasty Save` : "Mi partida NBA"}
            maxLength={80}
          />

          {(localError || createError) && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError || createError}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar franquicia (ej. Lakers, NYK)..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <Button
            variant={conferenceFilter === "all" ? "default" : "outline"}
            onClick={() => setConferenceFilter("all")}
            size="sm"
            className="rounded-full"
          >
            Toda la Liga
          </Button>
          <Button
            variant={conferenceFilter === "east" ? "default" : "outline"}
            onClick={() => setConferenceFilter("east")}
            size="sm"
            className="rounded-full"
          >
            Este
          </Button>
          <Button
            variant={conferenceFilter === "west" ? "default" : "outline"}
            onClick={() => setConferenceFilter("west")}
            size="sm"
            className="rounded-full"
          >
            Oeste
          </Button>
        </div>
      </div>

      {filteredTeams.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          No se encontraron franquicias con esos filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTeams.map((team) => {
            const isSelected = pendingSelectedTeamId === team.id;

            return (
              <Card
                key={team.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 group ${isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border"}`}
                onClick={() => setPendingSelectedTeamId(team.id)}
              >
                <CardContent className="p-6 relative">
                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <CheckCircle2 className="h-5 w-5 text-primary animate-in zoom-in" />
                    </div>
                  )}

                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="h-40 w-40 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-background shadow-sm group-hover:scale-105 transition-transform">
                      {team.logoUrl ? (
                        // biome-ignore lint/performance/noImgElement: no config next.config.js for remote patterns
                        <img
                          src={team.logoUrl}
                          alt={`Logo ${team.name}`}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-2xl font-black text-muted-foreground opacity-50">
                          {team.abbreviation}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-lg leading-none">{team.name}</h3>
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>{team.city}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {team.conference && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {team.conference}
                        </Badge>
                      )}
                      {team.division && (
                        <Badge variant="outline" className="text-xs font-normal opacity-70">
                          {team.division}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t shadow-lg transition-transform duration-300 z-50 flex justify-center ${pendingSelectedTeamId ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="max-w-6xl w-full flex items-center justify-between">
          <div className="hidden sm:block">
            <p className="text-sm text-muted-foreground">Franquicia seleccionada</p>
            <p className="font-bold">
              {selectedTeam?.city} {selectedTeam?.name}
            </p>
          </div>

          <Button
            size="lg"
            onClick={handleCreateGame}
            disabled={isCreating || !pendingSelectedTeamId}
            className="w-full sm:w-auto px-8"
          >
            {isCreating ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-background" />
                Creando partida...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Crear Partida
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </div>

      <Button
        variant="ghost"
        className="mx-auto"
        onClick={() => {
          resetCreateFlow();
          router.push("/");
        }}
      >
        Volver al menú
      </Button>
    </div>
  );
}
