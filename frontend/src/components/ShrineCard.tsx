import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { Shrine } from "@/lib/api/shrines";

export default function ShrineCard({ shrine }: { shrine: Shrine }) {
  return (
    <Card className="hover:shadow-md transition">
      <CardHeader>
        <CardTitle>
          <Link
            href={`/shrines/${shrine.id}`}
            className="text-blue-600 hover:underline"
          >
            {shrine.name_jp}
          </Link>
        </CardTitle>
        <CardDescription>{shrine.address}</CardDescription>
      </CardHeader>
      

      {/* ご利益メモ */}
      {shrine.goriyaku && (
        <CardContent>
          <p className="text-sm">ご利益: {shrine.goriyaku}</p>
        </CardContent>
      )}

      {/* ご利益タグ */}
      {shrine.goriyaku_tags && shrine.goriyaku_tags.length > 0 && (
        <CardContent>
          <p className="text-sm text-gray-700">
            タグ:{" "}
            {shrine.goriyaku_tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-block bg-gray-200 rounded px-2 py-0.5 text-xs mr-1"
              >
                {tag.name}
              </span>
            ))}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

