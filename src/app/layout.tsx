import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const k8x12s = localFont({
  src: "./fonts/k8x12S.ttf",
  display: "swap",
  variable: "--font-k8x12s",
});

export const metadata: Metadata = {
  title: "pokelog-bdsp",
  description: "Pokemon BDSP play log tracker",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`h-full ${k8x12s.variable}`}>
      <body className={`${k8x12s.className} min-h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
