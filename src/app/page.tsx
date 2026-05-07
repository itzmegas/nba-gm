import { redirect } from "next/navigation";

export default function Page() {
  // const savedGameId = localStorage.getItem("selectedGameId");

  //return redirect("/select-team");

  return (
    <div>
      <h1 className="text-2xl font-bold">Bienvenido a NBA Manager</h1>

      <button>Comenzar nueva partida</button>
      <button>Cargar partida</button>
    </div>
  );
}
