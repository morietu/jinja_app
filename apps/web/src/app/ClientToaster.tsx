"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";

export function ClientToaster() {
  useEffect(() => {
    console.log("[Toaster mounted]");
  }, []);
  return <Toaster richColors />;
}
