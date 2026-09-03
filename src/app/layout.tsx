import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ReactQueryProvider } from "@/application/providers/ReactQueryProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nRuntime } from "@/infrastructure/i18n/I18nRuntime";
import { resolveLocale } from "@/infrastructure/i18n/request";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NBA GM Simulator",
  description: "Advanced NBA General Manager Simulator. Take control of your franchise.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveLocale();

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nRuntime locale={locale}>
            <ReactQueryProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </ReactQueryProvider>
          </I18nRuntime>
        </ThemeProvider>
      </body>
    </html>
  );
}
