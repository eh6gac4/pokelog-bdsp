import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SyncManager } from "@/components/SyncManager";
import "./globals.css";

const pixelMplus12 = localFont({
  src: [
    { path: "./fonts/PixelMplus12-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/PixelMplus12-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-pixelmplus12",
});

export const metadata: Metadata = {
  title: "ポケログBDSP",
  description: "Pokemon BDSP play log tracker",
  applicationName: "ポケログBDSP",
  appleWebApp: {
    capable: true,
    title: "ポケログBDSP",
    statusBarStyle: "default",
  },
};

// themeColor は metadata では非推奨のため viewport export を使う。
// 色は globals.css の @media (prefers-color-scheme) に一致させる。
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`h-full ${pixelMplus12.variable}`}>
      <body className={`${pixelMplus12.className} min-h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <ServiceWorkerRegister />
        <SyncManager />
        {children}
      </body>
    </html>
  );
}
