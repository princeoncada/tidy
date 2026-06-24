import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BoardPresenceBar,
  BoardPresenceCursors,
} from "@/components/board/BoardPresence";

describe("BoardPresence", () => {
  it("shows the current roster and peer typing state", () => {
    render(
      <BoardPresenceBar
        currentUserId="user-1"
        roster={[
          { userId: "user-1", clientKey: "client-a", at: 10 },
          { userId: "user-2", clientKey: "client-b", typing: true, at: 20 },
        ]}
      />,
    );

    expect(screen.getByText("Here now")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("User user-2")).toBeInTheDocument();
    expect(screen.getByText("1 typing")).toBeInTheDocument();
  });

  it("renders peer cursors from normalized board coordinates", () => {
    render(
      <BoardPresenceCursors
        cursors={[
          {
            type: "cursor",
            roomId: "list-1",
            userId: "user-2",
            clientKey: "client-b",
            cursorX: 0.25,
            cursorY: 0.75,
            at: 20,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("board-presence-cursors")).toBeInTheDocument();
    expect(screen.getByText("User user-2")).toBeInTheDocument();
  });
});
