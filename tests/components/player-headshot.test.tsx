// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerHeadshot } from "@/components/players/player-headshot";

const FALLBACK_SRC = "/player-silhouette.svg";

describe("PlayerHeadshot", () => {
  it("uses the local silhouette when the headshot URL is absent", () => {
    render(<PlayerHeadshot alt="Player without photo" />);

    expect(screen.getByRole("img", { name: "Player without photo" }).getAttribute("src")).toBe(
      FALLBACK_SRC
    );
  });

  it("replaces a failed remote headshot with the local silhouette", () => {
    render(<PlayerHeadshot src="https://example.com/missing.png" alt="Player with broken photo" />);
    const image = screen.getByRole("img", { name: "Player with broken photo" });

    fireEvent.error(image);

    expect(image.getAttribute("src")).toBe(FALLBACK_SRC);
  });
});
