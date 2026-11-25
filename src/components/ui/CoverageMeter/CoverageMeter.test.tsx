import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CoverageMeter from "./CoverageMeter";

describe("CoverageMeter", () => {
  it("подпись «4 из 6 · 67%» и порог для скринридера", () => {
    render(<CoverageMeter available={4} total={6} threshold={60} label="Покрытие ИТ-отдела" />);
    expect(screen.getByText("4 из 6 · 67% · у порога")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Покрытие ИТ-отдела" })).toHaveAttribute(
      "aria-valuetext",
      "4 из 6, 67%. Порог 60%, у порога",
    );
  });

  it("ниже порога называет риск словами, не только цветом", () => {
    render(<CoverageMeter available={2} total={6} threshold={60} label="Покрытие" />);
    expect(screen.getByText("2 из 6 · 33% · ниже порога")).toBeInTheDocument();
  });
});
