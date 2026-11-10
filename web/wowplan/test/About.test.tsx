import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { About, AboutLink } from "../src/components/About";

const page = () => render(<><AboutLink /><About /></>);
const dialog = () => screen.queryByRole("dialog");

afterEach(() => window.history.replaceState(null, "", "/"));

describe("About this demo", () => {
  it("stays shut on load and opens only from the link at the foot of the page", async () => {
    window.history.replaceState(null, "", "/p/k3Fq9xZ");
    page();
    expect(dialog()).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "About this demo" }));
    expect(dialog()).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("wow-plan.com");
    expect(window.location.pathname).toBe("/about");

    fireEvent.click(screen.getByRole("button", { name: "Back to the planner" }));
    expect(dialog()).toBeNull();
    await waitFor(() => expect(window.location.pathname).toBe("/p/k3Fq9xZ"));
  });

  it("closes on Escape", () => {
    page();
    fireEvent.click(screen.getByRole("link", { name: "About this demo" }));
    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(dialog()).toBeNull();
  });

  it("opens at /about, and closing it goes to the intro page", () => {
    window.history.replaceState(null, "", "/about");
    page();
    expect(dialog()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to the planner" }));
    expect(dialog()).toBeNull();
    expect(window.location.pathname).toBe("/");
  });
});
