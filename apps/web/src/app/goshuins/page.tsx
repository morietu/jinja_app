// apps/web/src/app/goshuins/page.tsx
import { redirect } from "next/navigation";

export default function GoshuinsPage() {
  // 御朱印の入口は「公開一覧」に寄せる（迷子防止）
  redirect("/goshuins/public");
}
