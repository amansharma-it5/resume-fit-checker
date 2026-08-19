import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RenameDialog } from "./RenameDialog";

function Harness({ onSave = vi.fn() }: { onSave?: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [returnFocus, setReturnFocus] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        onClick={(event) => {
          setReturnFocus(event.currentTarget);
          setOpen(true);
        }}
      >
        Rename
      </button>
      <RenameDialog
        open={open}
        currentName="Existing resume"
        returnFocus={returnFocus}
        onCancel={() => setOpen(false)}
        onSave={(name) => {
          onSave(name);
          setOpen(false);
        }}
      />
    </>
  );
}

describe("RenameDialog", () => {
  it("prefills the current name, takes focus, and saves a trimmed name", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const input = await screen.findByLabelText("Resume name");
    expect(input).toHaveValue("Existing resume");
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "  Targeted resume  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("Targeted resume");
  });

  it("cancels without saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows an inline error for an empty name", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("Resume name");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a resume name.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
  });

  it("submits with Enter and cancels with Escape", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("Resume name");
    await user.clear(input);
    await user.type(input, "Keyboard resume{Enter}");
    expect(onSave).toHaveBeenCalledWith("Keyboard resume");
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps focus and returns it to the Rename button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Rename" });
    await user.click(trigger);
    const input = screen.getByLabelText("Resume name");
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(trigger).toHaveFocus();
  });
});
