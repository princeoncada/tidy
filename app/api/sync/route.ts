import { createClient } from "@/lib/supabase/server";
import {
  applySyncOperations,
  type SyncApplyOperationResult,
} from "@/lib/sync/server-apply";
import {
  validateSyncBatchRequest,
  type SyncBatchOperationDecision,
} from "@/lib/sync/sync-batch-contract";

type SyncRouteOperationResult = SyncApplyOperationResult | {
  operationId: string;
  status: "failed";
  errorMessage: string;
};

function isAcceptedDecision(
  decision: SyncBatchOperationDecision,
): decision is Extract<SyncBatchOperationDecision, { accepted: true }> {
  return decision.accepted;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "Sync batch apply failed.";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, errors: ["Unauthorized."] }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, errors: ["Request body must be valid JSON."] }, { status: 400 });
  }

  const validation = validateSyncBatchRequest(body, {
    authenticatedUserId: user.id,
  });

  if (!validation.ok) {
    return Response.json(
      { ok: false, errors: validation.errors },
      { status: 422 },
    );
  }

  const accepted = validation.decisions.filter(isAcceptedDecision);
  let appliedResults: SyncRouteOperationResult[];

  try {
    appliedResults = await applySyncOperations({
      userId: user.id,
      decisions: accepted,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    appliedResults = accepted.map((decision) => ({
      operationId: decision.operationId,
      status: "failed",
      errorMessage,
    }));
  }

  let acceptedResultIndex = 0;
  const results = validation.decisions.map<SyncRouteOperationResult>((decision) => {
    if (!decision.accepted) {
      return {
        operationId: decision.operationId,
        status: "rejected",
        errorMessage: decision.errors.join("; "),
      };
    }

    const applied = appliedResults[acceptedResultIndex];
    acceptedResultIndex += 1;

    return applied ?? {
      operationId: decision.operationId,
      status: "failed",
      errorMessage: "Sync apply did not return a result for this operation.",
    };
  });

  return Response.json({ ok: true, results }, { status: 200 });
}
