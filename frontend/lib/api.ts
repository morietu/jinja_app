export type Shrine = {
  id: number
  name_jp: string
  name_romaji?: string
  address: string
  latitude: number
  longitude: number
  goriyaku?: string
  sajin?: string
}

export async function fetchShrines(): Promise<Shrine[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/shrines/`)
  if (!res.ok) {
    throw new Error("Failed to fetch shrines")
  }
  return res.json()
}
