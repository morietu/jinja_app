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
      {shrine.goriyaku && (
        <CardContent>
          <p className="text-sm">ご利益: {shrine.goriyaku}</p>
        </CardContent>
      )}
    </Card>
  );
}
