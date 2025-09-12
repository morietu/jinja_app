"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="py-10 text-center bg-gray-50 rounded">
      <h2 className="text-3xl font-bold mb-2">神社ポータル</h2>
      <p className="text-gray-600 mb-4">探す・相談する・お気に入りを管理する</p>
      <a href="/shrines/search" className="inline-block px-4 py-2 bg-blue-600 text-white rounded">
        今すぐ探す
      </a>
    </section>
  );
}
