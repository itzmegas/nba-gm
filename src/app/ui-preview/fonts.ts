import localFont from "next/font/local";

export const body = localFont({
  src: [
    { path: "./fonts/Barlow-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Barlow-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-courtside-body",
  display: "swap",
  preload: false,
});

export const display = localFont({
  src: "./fonts/BarlowCondensed-SemiBold.ttf",
  weight: "600",
  style: "normal",
  variable: "--font-courtside-display",
  display: "swap",
  preload: false,
});
