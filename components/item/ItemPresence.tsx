"use client";

import { Users } from "lucide-react";

import type { PresenceMember } from "@/lib/realtime/presence-client";

function fallbackLabel(userId: string) {
  return `User ${userId.slice(0, 6)}`;
}

export function ItemPresence({
  currentUserId,
  roster,
  labelForUser,
}: {
  currentUserId: string | null;
  roster: ReadonlyArray<PresenceMember>;
  labelForUser: (userId: string) => string | undefined;
}) {
  const peers = roster.filter((member) => member.userId !== currentUserId);
  const typingPeers = peers.filter((member) => member.typing);

  return (
    <section
      aria-label="Presence"
      className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-text-muted"
      data-testid="item-presence"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="font-medium text-text">Here now</span>
        </div>
        <span>{roster.length}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {roster.length === 0 ? (
          <span>No one connected</span>
        ) : (
          roster.map((member) => (
            <span
              key={member.userId}
              className="max-w-40 truncate rounded-md border border-border bg-surface px-2 py-0.5"
            >
              {member.userId === currentUserId
                ? "You"
                : labelForUser(member.userId) ?? fallbackLabel(member.userId)}
            </span>
          ))
        )}
      </div>
      {typingPeers.length > 0 && (
        <p className="mt-2 text-text" role="status">
          {typingPeers.length === 1
            ? `${labelForUser(typingPeers[0].userId) ?? fallbackLabel(typingPeers[0].userId)} is typing`
            : `${typingPeers.length} people are typing`}
        </p>
      )}
    </section>
  );
}
