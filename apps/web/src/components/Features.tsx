// frontend/src/components/Features.tsx
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, User } from "lucide-react";

export default function Features() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Link href="/consultation" className="block">
        <Card className="cursor-pointer hover:shadow-xl transition-transform hover:scale-105">
          <CardHeader className="flex flex-col items-center text-center">
            <Sparkles className="w-10 h-10 mb-3" />
            <CardTitle>参拝コンシェルジュ</CardTitle>
            <CardDescription>相性の良い神社をレコメンド</CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/mypage" className="block">
        <Card className="cursor-pointer hover:shadow-xl transition-transform hover:scale-105">
          <CardHeader className="flex flex-col items-center text-center">
            <User className="w-10 h-10 mb-3" />
            <CardTitle>マイページ</CardTitle>
            <CardDescription>ご朱印・お気に入りを管理</CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
}
