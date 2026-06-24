import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ItemPresence } from "@/components/item/ItemPresence";

describe("ItemPresence", () => {
  it("shows roster labels and peer typing state", () => {
    render(
      <ItemPresence
        currentUserId="user-1"
        roster={[
          { userId: "user-1", clientKey: "client-a", at: 10 },
          { userId: "user-2", clientKey: "client-b", typing: true, at: 20 },
        ]}
        labelForUser={(userId) =>
          userId === "user-2" ? "editor@example.com" : undefined
        }
      />,
    );

    expect(screen.getByText("Here now")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("editor@example.com")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "editor@example.com is typing",
    );
  });
});
