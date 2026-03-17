import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useConfirm } from "./useConfirm";

describe("useConfirm", () => {
  it("starts in a non-confirming state", () => {
    const { result } = renderHook(() => useConfirm<{ id: string }>());
    expect(result.current.confirming).toBe(false);
    expect(result.current.payload).toBeNull();
  });

  it("opens confirmation dialog with the given payload", () => {
    const { result } = renderHook(() => useConfirm<{ id: string }>());
    act(() => { result.current.request({ id: "abc" }); });
    expect(result.current.confirming).toBe(true);
    expect(result.current.payload).toEqual({ id: "abc" });
  });

  it("confirm() closes dialog and returns the payload", () => {
    const { result } = renderHook(() => useConfirm<{ id: string }>());
    act(() => { result.current.request({ id: "abc" }); });
    let returned: { id: string } | null = null;
    act(() => { returned = result.current.confirm(); });
    expect(result.current.confirming).toBe(false);
    expect(result.current.payload).toBeNull();
    expect(returned).toEqual({ id: "abc" });
  });

  it("cancel() closes dialog without returning payload", () => {
    const { result } = renderHook(() => useConfirm<string>());
    act(() => { result.current.request("some-action"); });
    act(() => { result.current.cancel(); });
    expect(result.current.confirming).toBe(false);
    expect(result.current.payload).toBeNull();
  });

  it("can handle multiple sequential requests", () => {
    const { result } = renderHook(() => useConfirm<number>());
    act(() => { result.current.request(1); });
    act(() => { result.current.cancel(); });
    act(() => { result.current.request(2); });
    expect(result.current.confirming).toBe(true);
    expect(result.current.payload).toBe(2);
  });
});
