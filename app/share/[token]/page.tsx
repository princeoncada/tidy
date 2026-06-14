import { redirect } from "next/navigation";

import { ReplicacheProvider } from "@/components/ReplicacheProvider";
import { ShareRedeemer } from "@/components/sharing/ShareRedeemer";
import { createClient } from "@/lib/supabase/server";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/share/${token}`)}`);
  }

  return (
    <ReplicacheProvider userId={user.id}>
      <ShareRedeemer token={token} />
    </ReplicacheProvider>
  );
}
