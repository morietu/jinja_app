"use client";
import { useEffect } from "react";
// 旧: import { install401Retry } from "@/lib/axios";
// 何もせずにマウントだけ（client.ts の interceptors が有効）

export default function ClientBootstrap() {
  useEffect(() => {
    // no-op: api interceptors are defined in "@/lib/api/client"
  }, []);
  return null;
}
