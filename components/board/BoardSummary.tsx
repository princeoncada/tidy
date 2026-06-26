"use client";

import { BOARD_COLUMNS } from "@/lib/board/board-order";
import type { BoardRollup } from "@/lib/board/board-rollup";

type BoardSummaryProps = {
  rollup: BoardRollup;
};

export function BoardSummary({ rollup }: BoardSummaryProps) {
  return (
    <section
      aria-label="Board progress"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-text">Progress</span>
          <span className="text-sm font-semibold text-text">
            {rollup.completionPercent}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Board completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rollup.completionPercent}
          aria-valuetext={
            rollup.completionPercent +
            "% complete, " +
            rollup.counts.DONE +
            " of " +
            rollup.total +
            " done"
          }
          className="h-2 w-full overflow-hidden rounded-full border border-border bg-surface-muted"
        >
          <div
            className="h-full rounded-full bg-success"
            style={{ width: rollup.completionPercent + "%" }}
          />
        </div>
      </div>
      <dl className="flex flex-wrap items-center gap-2">
        {BOARD_COLUMNS.map((column) => (
          <div
            key={column.status}
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs text-text-muted"
          >
            <dt>{column.label}</dt>
            <dd className="font-semibold text-text">
              {rollup.counts[column.status]}
            </dd>
          </div>
        ))}
        <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs text-text-muted">
          <dt>Total</dt>
          <dd className="font-semibold text-text">{rollup.total}</dd>
        </div>
      </dl>
    </section>
  );
}
