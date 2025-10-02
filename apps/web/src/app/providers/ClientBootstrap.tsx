"use client";
import { useEffect } from "react";
import { install401Retry } from "@/lib/axios";

export default function ClientBootstrap() {
  useEffect(() => {
    install401Retry(); // 1回だけ
  }, []);
  return null;
}
