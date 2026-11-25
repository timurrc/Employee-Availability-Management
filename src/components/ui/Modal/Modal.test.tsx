import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

const Harness = ({ onClose }: { onClose?: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Открыть
      </button>
      {open && (
        <Modal
          title="Заявка"
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
          footer={<button type="button">Отправить</button>}
        >
          <input aria-label="Поле" />
        </Modal>
      )}
    </>
  );
};

describe("Modal", () => {
  it("фокус внутри, Tab по кругу, Esc закрывает и возвращает фокус", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole("button", { name: "Открыть" });
    await userEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Заявка" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Закрыть" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText("Поле")).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Отправить" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Закрыть" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Отправить" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
