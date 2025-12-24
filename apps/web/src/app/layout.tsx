import localFont from "next/font/local";
import "./globals.css";

import Link from "next/link";

import ClientBootstrap from "./providers/ClientBootstrap";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";

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

export const metadata = {
  title: "Shrine Map",
  description: "Map preview",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <AuthProvider>
          <ClientBootstrap />

          {/* 共通ヘッダー */}
          <header className="border-b bg-white">
            <nav className="mx-auto flex max-w-5xl items-center gap-4 p-3">
              {/* 左：ホーム（Jinja） */}
              <Link href="/" className="text-base font-bold">
                Jinja
              </Link>

              <div className="ml-auto flex items-center gap-4">
                {/* 検索 */}
                <Link
                  href="/search"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm shadow-sm"
                  aria-label="神社を検索"
                >
                  <span aria-hidden>🔍</span>
                </Link>

                {/* みんなの公開御朱印 */}
                <Link href="/goshuins/public" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  みんなの御朱印
                </Link>

                {/* 御朱印帳 */}
                <Link
                  href="/mypage?tab=goshuin"
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
                >
                  御朱印帳
                </Link>
              </div>
            </nav>
          </header>

          {/* ページ内容 */}
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
