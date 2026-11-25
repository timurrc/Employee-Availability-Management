import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActionMenu from "./ActionMenu";

describe("ActionMenu", () => {
  it("стрелки, выбор пункта, Esc возвращает фокус на кнопку", async () => {
    const onCancel = vi.fn();
    const onDelete = vi.fn();
    render(
      <ActionMenu
        label="Действия"
        items={[
          { label: "Отменить заявку", onSelect: onCancel },
          { label: "Удалить", onSelect: onDelete, danger: true },
        ]}
      />,
    );
    const button = screen.getByRole("button", { name: "Действия" });
    await userEvent.click(button);
    expect(screen.getByRole("menuitem", { name: "Отменить заявку" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Удалить" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();

    await userEvent.click(button);
    await userEvent.click(screen.getByRole("menuitem", { name: "Удалить" }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("без пунктов не рендерится", () => {
    const { container } = render(<ActionMenu label="Действия" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
