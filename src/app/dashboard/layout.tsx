import { redirect } from "next/navigation";

export default function DashboardLayout({ children: _children }: { children: React.ReactNode }) {
  redirect("/");
}
