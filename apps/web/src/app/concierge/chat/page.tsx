// apps/web/src/app/concierge/chat/page.tsx
import { redirect } from "next/navigation";

export default function ConciergeChatPage() {
  // 旧URLへのブクマ・リンクを /concierge に統一
  redirect("/concierge");
}
