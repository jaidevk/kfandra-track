import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DayNutritionCard, MealSummarySheet } from "./nutrition-ui";
import type { NutritionSummary } from "@/lib/diet/nutrition";

const summary: NutritionSummary = {
  totals: { kcal: 241.6, protein: 11.04, carbs: 54, fat: 2.2 },
  counted: 2,
  total: 3,
  flagged: [{ foodKey: "white-bread", name: "White bread", verdict: "watch", note: "High GI" }],
};

describe("DayNutritionCard", () => {
  it("shows kcal, macros and the counted ratio", () => {
    render(<DayNutritionCard summary={summary} />);
    expect(screen.getByText("242 kcal")).toBeInTheDocument();
    expect(screen.getByText("P 11.0 g")).toBeInTheDocument();
    expect(screen.getByText("2 of 3 items counted")).toBeInTheDocument();
  });
  it("renders nothing when nothing is logged", () => {
    const { container } = render(<DayNutritionCard summary={{ ...summary, counted: 0, total: 0, flagged: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("MealSummarySheet", () => {
  it("shows the meal title, flags and calls onDone", () => {
    const onDone = vi.fn();
    render(<MealSummarySheet slotName="Breakfast" summary={summary} onDone={onDone} />);
    expect(screen.getByText("Breakfast · 242 kcal")).toBeInTheDocument();
    expect(screen.getByText("High GI")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalled();
  });
});
