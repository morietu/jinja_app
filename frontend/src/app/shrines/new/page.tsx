"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createShrine } from "@/lib/api/shrines";

export default function NewShrinePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name_jp: "",
    address: "",
    latitude: 0,
    longitude: 0,
    goriyaku: "",
    sajin: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const shrine = await createShrine(form);
      router.push(`/shrines/${shrine.id}`);
    } catch (err) {
      setError("登録に失敗しました。入力内容を確認してください。");
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">神社新規登録</h1>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-2">
        <input name="name_jp" placeholder="神社名" onChange={handleChange} className="border p-2 w-full" />
        <input name="address" placeholder="住所" onChange={handleChange} className="border p-2 w-full" />
        <input name="latitude" placeholder="緯度" type="number" onChange={handleChange} className="border p-2 w-full" />
        <input name="longitude" placeholder="経度" type="number" onChange={handleChange} className="border p-2 w-full" />
        <input name="goriyaku" placeholder="ご利益" onChange={handleChange} className="border p-2 w-full" />
        <input name="sajin" placeholder="祭神" onChange={handleChange} className="border p-2 w-full" />
        <button type="submit" className="bg-blue-500 text-white p-2 w-full rounded">登録する</button>
      </form>
    </div>
  );
}
