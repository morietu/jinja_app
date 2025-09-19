// src/app/api/probe/route.ts
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET() {
  return NextResponse.json({ ok: true, via: 'next' })
}
