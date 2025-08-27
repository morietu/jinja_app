// src/components/ShrineCard.tsx
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

      <CardContent>
        {shrine.goriyaku && (
          <p className="text-sm mb-2">ご利益: {shrine.goriyaku}</p>
        )}

        {shrine.goriyaku_tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shrine.goriyaku_tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
