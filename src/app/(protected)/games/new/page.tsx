import { CreateGameForm } from "@/components/games/CreateGameForm";

export default function NewGamePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tighter text-primary">GM</span>
            <span className="text-xs font-medium bg-muted px-2 py-1 rounded-full text-muted-foreground hidden sm:inline-block">
              BETA
            </span>
          </div>
          <div className="text-sm font-medium text-muted-foreground">Nueva Partida</div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 flex flex-col gap-8">
        <div className="space-y-2 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Crear nueva simulación</h1>
          <p className="text-muted-foreground">
            Seleccioná la franquicia y empezá tu carrera como General Manager.
          </p>
        </div>

        <CreateGameForm />
      </main>
    </div>
  );
}
