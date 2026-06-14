"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { useTRPC } from "@/trpc/client";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "This share link could not be accepted.";
}

export function ShareRedeemer({ token }: { token: string }) {
  const started = useRef(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const trpc = useTRPC();
  const router = useRouter();
  const redeem = useMutation(
    trpc.share.redeemShareLink.mutationOptions(),
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void redeem
      .mutateAsync({ token })
      .then(() => {
        router.replace("/dashboard");
      })
      .catch((error) => {
        setRedeemError(errorMessage(error));
      });
  }, [redeem, router, token]);

  const displayedError = redeemError ??
    (redeem.isError ? redeem.error.message : null);

  return (
    <MaxWidthWrapper singleItemPage>
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {displayedError ? (
          <>
            <h1 className="text-lg font-semibold">Unable to accept invite</h1>
            <p className="text-sm text-muted-foreground">
              {displayedError}
            </p>
          </>
        ) : (
          <>
            <Loader2 className="size-5 animate-spin" />
            <p className="text-sm text-muted-foreground">
              Adding the shared resource...
            </p>
          </>
        )}
      </div>
    </MaxWidthWrapper>
  );
}
