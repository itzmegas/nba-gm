import { notFound } from "next/navigation";
import { body, display } from "@/app/ui-preview/fonts";
import { UiPreview } from "@/components/design/ui-preview";

export default function UiPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <UiPreview fontClassName={`${body.variable} ${display.variable}`} />;
}
