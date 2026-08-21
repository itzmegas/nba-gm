"use client";

import { AuthGuard } from "@/application/auth/AuthGuard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
