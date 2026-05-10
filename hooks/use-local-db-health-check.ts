"use client";

import { initializeLocalDbHealthMetadata } from "@/lib/local-db/metadata-repository";
import { useEffect } from "react";

export function useLocalDbHealthCheck(): void {
  useEffect(() => {
    void initializeLocalDbHealthMetadata();
  }, []);
}
