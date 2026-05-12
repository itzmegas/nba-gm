import { Home, SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Página no encontrada</h1>
        <p className="text-muted-foreground">
          La sección que buscás no existe o todavía no está disponible.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="..">
          <Home className="h-4 w-4" />
          Volver al Dashboard
        </Link>
      </Button>
    </div>
  );
}
