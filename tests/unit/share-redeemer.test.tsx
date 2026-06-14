import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShareRedeemer } from "@/components/sharing/ShareRedeemer";

const {
  mutateAsyncMock,
  pullMock,
  replaceMock,
  useMutationMock,
} = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn(),
  pullMock: vi.fn(),
  replaceMock: vi.fn(),
  useMutationMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/components/ReplicacheProvider", () => ({
  useTidyReplicache: () => ({ rep: { pull: pullMock } }),
}));

vi.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    share: {
      redeemShareLink: {
        mutationOptions: () => ({}),
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: useMutationMock,
}));

function flushMacrotask() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("share redeemer", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    pullMock.mockReset();
    pullMock.mockResolvedValue(undefined);
    replaceMock.mockReset();
    useMutationMock.mockReset();
    useMutationMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isError: false,
      error: null,
    });
  });

  it("pulls shared data and redirects after a successful redemption", async () => {
    mutateAsyncMock.mockResolvedValue(undefined);

    render(<ShareRedeemer token="tok" />);

    await act(async () => {
      await flushMacrotask();
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith({ token: "tok" });
    expect(pullMock).toHaveBeenCalledOnce();
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders a revoked-link error without an unhandled rejection", async () => {
    const error = new Error("This share link has been revoked.");
    const unhandledRejections: unknown[] = [];
    const handleProcessRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    const handleWindowRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      unhandledRejections.push(event.reason);
    };

    mutateAsyncMock.mockRejectedValue(error);
    useMutationMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isError: true,
      error,
    });
    process.on("unhandledRejection", handleProcessRejection);
    window.addEventListener("unhandledrejection", handleWindowRejection);

    try {
      render(<ShareRedeemer token="tok" />);

      await act(async () => {
        await flushMacrotask();
      });

      expect(screen.getByText("Unable to accept invite")).toBeInTheDocument();
      expect(
        screen.getByText("This share link has been revoked."),
      ).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", handleProcessRejection);
      window.removeEventListener(
        "unhandledrejection",
        handleWindowRejection,
      );
    }
  });
});
