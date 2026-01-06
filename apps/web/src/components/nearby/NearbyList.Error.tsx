"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function NearbyListError({ message, onRetry }: Props) {
  return (
    <div role="alert" aria-live="assertive" className="px-4 py-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </div>
      <p className="font-medium">取得に失敗しました</p>
      <p className="text-sm text-muted-foreground mt-1">
        {message ?? "ネットワーク状況をご確認のうえ、もう一度お試しください。"}
      </p>
      {onRetry && (
        <Button variant="default" className="mt-4" onClick={onRetry}>
          再試行
        </Button>
      )}
    </div>
  );
}
