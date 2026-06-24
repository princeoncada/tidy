"use client";

import { Users } from "lucide-react";

import type {
  PresenceCursor,
} from "@/lib/realtime/use-presence-rooms";
import type { PresenceMember } from "@/lib/realtime/presence-client";
import { cn } from "@/lib/utils";

function shortUserLabel(userId: string) {
  return `User ${userId.slice(0, 6)}`;
}

export function BoardPresenceBar({
  currentUserId,
  roster,
}: {
  currentUserId: string | null;
  roster: ReadonlyArray<PresenceMember>;
}) {
  const peers = roster.filter((member) => member.userId !== currentUserId);
  const typingCount = peers.filter((member) => member.typing).length;

  return (
    <div
      className="flex min-h-9 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted"
      data-testid="board-presence-bar"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Users className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="font-medium text-text">Here now</span>
        <span>{roster.length}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {roster.length === 0 ? (
          <span>No one connected</span>
        ) : (
          roster.slice(0, 4).map((member) => (
            <span
              key={member.userId}
              className={cn(
                "max-w-32 truncate rounded-md border border-border px-2 py-0.5",
                member.userId === currentUserId && "border-border-strong",
              )}
            >
              {member.userId === currentUserId
                ? "You"
                : shortUserLabel(member.userId)}
            </span>
          ))
        )}
        {roster.length > 4 && <span>+{roster.length - 4}</span>}
        {typingCount > 0 && (
          <span className="text-text">
            {typingCount === 1 ? "1 typing" : `${typingCount} typing`}
          </span>
        )}
      </div>
    </div>
  );
}

export function BoardPresenceCursors({
  cursors,
}: {
  cursors: ReadonlyArray<PresenceCursor>;
}) {
  if (cursors.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      data-testid="board-presence-cursors"
    >
      {cursors.map((cursor) => {
        const left = Math.max(0, Math.min(1, cursor.cursorX ?? 0));
        const top = Math.max(0, Math.min(1, cursor.cursorY ?? 0));

        return (
          <div
            key={`${cursor.roomId}:${cursor.userId}`}
            className="absolute flex items-center gap-1 text-xs text-accent-role"
            style={{
              left: `${left * 100}%`,
              top: `${top * 100}%`,
              transform: "translate(6px, 6px)",
            }}
          >
            <span className="size-2 rounded-full bg-accent-role" />
            <span className="max-w-28 truncate rounded-md border border-border bg-surface-raised px-1.5 py-0.5 shadow-sm">
              {shortUserLabel(cursor.userId)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
