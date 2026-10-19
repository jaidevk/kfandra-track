import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHydrated } from "./use-hydrated";

function Probe() {
  return createElement("span", { "data-hydrated": useHydrated() });
}

describe("useHydrated", () => {
  it("is false in the server render", () => {
    expect(renderToString(createElement(Probe))).toContain('data-hydrated="false"');
  });

  it("is true once rendered on the client", () => {
    const { result } = renderHook(() => useHydrated());
    expect(result.current).toBe(true);
  });
});
