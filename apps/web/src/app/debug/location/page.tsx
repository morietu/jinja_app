"use client";
import { useState } from "react";
import { webLocator } from "@/lib/location.web";

export default function DebugLocationPage() {
  const [text, setText] = useState("未取得");
  const getLoc = async () => {
    setText("取得中…");
    try {
      const p = await webLocator.current();
      setText(`lat=${p.lat}, lng=${p.lng}`);
    } catch (e:any) {
      setText(`エラー: ${e?.message ?? e}`);
    }
  };
  return (
    <main style={{ padding: 16 }}>
      <h1>Location Debug</h1>
      <button onClick={getLoc}>現在地を取得</button>
      <p>{text}</p>
    </main>
  );
}
