import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

type Props = {
  onRefetch?: () => void;
  suggestion?: string;
};

export function NearbyListEmpty({ onRefetch, suggestion }: Props) {
  return (
    <div role="status" aria-live="polite" className="text-center px-4 py-12">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <SearchX className="h-6 w-6" aria-hidden />
      </div>
      <p className="font-medium">見つかりませんでした</p>
      <p className="text-sm text-muted-foreground mt-1">
        {suggestion ?? "検索範囲を広げるか、条件を見直してください。"}
      </p>
      {onRefetch && (
        <Button className="mt-4" onClick={onRefetch}>
          再検索
        </Button>
      )}
    </div>
  );
}
