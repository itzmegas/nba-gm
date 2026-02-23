"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTeamStore } from "@/application/stores/useTeamStore";
import {
  DashboardHeader,
  DashboardSidebar,
} from "@/components/dashboard/layout-components";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const selectedTeamId = useTeamStore((state) => state.selectedTeamId);

  useEffect(() => {
    if (selectedTeamId === null) {
      router.push("/select-team");
    }
  }, [selectedTeamId, router]);

  if (selectedTeamId === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <DashboardSidebar />

      <div className="flex flex-col flex-1 overflow-hidden relative">
        <DashboardHeader />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
