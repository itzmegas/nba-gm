"use client";

import { CheckCircle2, ChevronRight, MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { useTeamStore } from "@/application/stores/useTeamStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function TeamSelector() {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);

  // SERVER STATE
  const { data: teams, isLoading, error } = useTeams();

  // CLIENT STATE
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
  const searchQuery = useTeamStore((state) => state.searchQuery);
  const conferenceFilter = useTeamStore((state) => state.conferenceFilter);
  const selectTeam = useTeamStore((state) => state.selectTeam);
  const setSearchQuery = useTeamStore((state) => state.setSearchQuery);
  const setConferenceFilter = useTeamStore(
    (state) => state.setConferenceFilter,
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground animate-pulse">
          Cargando franquicias NBA...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-center">
        <h3 className="font-bold mb-2">Error de Conexión</h3>
        <p>{error.message}</p>
        <p className="text-sm mt-2 opacity-80">
          Chequeá que Supabase esté configurado y corriendo con data.
        </p>
      </div>
    );
  }

  // Derived state (Filtrado local)
  const filteredTeams =
    teams?.filter((team) => {
      // Por nombre/ciudad
      const matchesSearch =
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.abbreviation.toLowerCase().includes(searchQuery.toLowerCase());

      // Por conferencia
      const matchesConference =
        conferenceFilter === "all" ||
        team.conference?.toLowerCase() === conferenceFilter;

      return matchesSearch && matchesConference;
    }) ?? [];

  console.log("🚀 ~ TeamSelector ~ filteredTeams:", filteredTeams);

  const handleConfirm = () => {
    if (!selectedTeamId) return;
    setIsConfirming(true);
    // Acá simulamos una pequeña carga antes de ir al dashboard
    setTimeout(() => {
      router.push("/dashboard");
    }, 500);
  };

  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar franquicia (ej. Lakers, NYK)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* TEAMS GRID */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          No se encontraron franquicias con esos filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTeams.map((team) => {
            const isSelected = selectedTeamId === team.id;

            return (
              <Card
                key={team.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 group ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border"
                }`}
                onClick={() => selectTeam(team.id)}
              >
                <CardContent className="p-6 relative">
                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <CheckCircle2 className="h-5 w-5 text-primary animate-in zoom-in" />
                    </div>
                  )}

                  <div className="flex flex-col items-center text-center space-y-4">
                    {/* Placeholder para logo - reemplazaremos src con team.logoUrl cuando exista */}
                    <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-background shadow-sm group-hover:scale-105 transition-transform">
                      {team.logoUrl ? (
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
                      <h3 className="font-bold text-lg leading-none">
                        {team.name}
                      </h3>
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>{team.city}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {team.conference && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          {team.conference}
                        </Badge>
                      )}
                      {team.division && (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal opacity-70"
                        >
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

      {/* FLOATING ACTION BAR (Sólo visible si hay un equipo seleccionado) */}
      <div
        className={`fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t shadow-lg transition-transform duration-300 z-50 flex justify-center ${
          selectedTeamId ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="max-w-6xl w-full flex items-center justify-between">
          <div className="hidden sm:block">
            <p className="text-sm text-muted-foreground">
              Franquicia seleccionada
            </p>
            <p className="font-bold">
              {teams?.find((t) => t.id === selectedTeamId)?.city}{" "}
              {teams?.find((t) => t.id === selectedTeamId)?.name}
            </p>
          </div>

          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={isConfirming || !selectedTeamId}
            className="w-full sm:w-auto px-8"
          >
            {isConfirming ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></span>
                Iniciando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Asumir como GM
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
