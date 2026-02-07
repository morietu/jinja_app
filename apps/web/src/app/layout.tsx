// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { ClientToaster } from "./ClientToaster";
import HomeLogoLink from "@/components/layout/HomeLogoLink";

import Link from "next/link";

import ClientBootstrap from "./providers/ClientBootstrap";

import { AuthProvider } from "@/lib/auth/AuthProvider";

import { HeaderAuthButtons } from "@/components/layout/HeaderAuthButtons";

const geistSans = localFont({
  src: [
    { path: "../fonts/Geist-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/Geist-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Geist-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Geist-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: [
    { path: "../fonts/GeistMono-Light.woff2", weight: "300", style: "normal" },
    {
      path: "../fonts/GeistMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    { path: "../fonts/GeistMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/GeistMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Shrine Map",
  description: "Map preview",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh flex flex-col">
        <AuthProvider>
          <ClientBootstrap />

          <header className="sticky top-0 z-[100] bg-white">
            <nav className="mx-auto flex max-w-5xl items-center gap-4 p-3">
              <HomeLogoLink />

              <div className="ml-auto flex items-center gap-4">
                <Link
                  href="/map"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm shadow-sm"
                  aria-label="神社を検索"
                >
                  <span aria-hidden>🔍</span>
                </Link>

                <Suspense fallback={null}>
                  <HeaderAuthButtons />
                </Suspense>
              </div>
            </nav>
          </header>

          {/* ページ内容 */}
          <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>

          {/* ここに置く */}
          <ClientToaster />
        </AuthProvider>
      </body>
    </html>
  );
}
