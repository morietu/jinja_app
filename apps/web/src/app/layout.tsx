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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {


  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        {/* Auth をアプリ全体に適用 */}
        <AuthProvider>
          <ClientBootstrap />

          {/* 共通ヘッダー */}
          <header className="border-b bg-white">
            <nav className="max-w-5xl mx-auto flex items-center gap-4 p-3">
              <Link href="/" className="font-bold">
                Jinja
              </Link>
              <Link href="/search" className="hover:underline">
                検索
              </Link>
              <Link href="/ranking" className="hover:underline">
                ランキング
              </Link>
              <div className="ml-auto flex items-center gap-3">
                <Link
                  href="/mypage?tab=goshuin"
                  className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
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
