import { Home, SearchX } from "lucide-react";
import Link from "next/link";
import { createT } from "@/application/i18n/createT";
import { Button } from "@/components/ui/button";
import { resolveLocale } from "@/infrastructure/i18n/request";

export default async function NotFound() {
  const locale = await resolveLocale();
  const t = createT(locale);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t("dashboard", "notFound")}</h1>
        <p className="text-muted-foreground">{t("dashboard", "notFoundDescription")}</p>
      </div>
      <Button asChild variant="outline">
        <Link href="..">
          <Home className="h-4 w-4" />
          {t("dashboard", "backToDashboard")}
        </Link>
      </Button>
    </div>
  );
}
