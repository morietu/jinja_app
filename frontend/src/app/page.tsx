import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function Home() {
  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">神社アプリ MVP</h1>

      <Card>
        <CardHeader>
          <CardTitle>検索フォーム</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="神社名で検索" />
          <Button>検索</Button>
        </CardContent>
      </Card>
    </main>
  )
}
