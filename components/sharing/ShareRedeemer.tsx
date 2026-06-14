"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { useTidyReplicache } from "@/components/ReplicacheProvider";
import { useTRPC } from "@/trpc/client";

export function ShareRedeemer({ token }: { token: string }) {
  const started = useRef(false);
  const trpc = useTRPC();
  const router = useRouter();
  const { rep } = useTidyReplicache();
  const redeem = useMutation(
    trpc.share.redeemShareLink.mutationOptions(),
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void redeem
      .mutateAsync({ token })
      .then(async () => {
        await rep?.pull();
        router.replace("/dashboard");
      });
  }, [redeem, rep, router, token]);

  return (
    <MaxWidthWrapper singleItemPage>
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {redeem.isError ? (
          <>
            <h1 className="text-lg font-semibold">Unable to accept invite</h1>
            <p className="text-sm text-muted-foreground">
              {redeem.error.message}
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
