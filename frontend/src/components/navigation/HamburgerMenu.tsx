"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 border rounded-md">☰</button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-4 space-y-4">
        <h2 className="text-lg font-bold mb-4">メニュー</h2>
        <nav className="flex flex-col space-y-2">
          <Link href="/" onClick={() => setOpen(false)}>🏠 ホーム</Link>
          <Link href="/ranking" onClick={() => setOpen(false)}>🏆 ランキング</Link>
          <Link href="/routes" onClick={() => setOpen(false)}>🧭 ルート検索</Link>
          <Link href="/concierge" onClick={() => setOpen(false)}>🔮 コンシェルジュ</Link>
          <Link href="/mypage" onClick={() => setOpen(false)}>🙍 マイページ</Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
