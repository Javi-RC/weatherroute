import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedCallback } from "./useDebouncedCallback";

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("returns a stable callback across re-renders", () => {
    const { result, rerender } = renderHook(
      ({ fn }: { fn: () => void }) => useDebouncedCallback(fn),
      { initialProps: { fn: vi.fn() } },
    );
    const first = result.current;
    rerender({ fn: vi.fn() });
    expect(result.current).toBe(first);
  });

  it("fires once with the last arguments after rapid invocations within the delay", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 400));
    const debounced = result.current;

    act(() => {
      debounced("a");
      debounced("b");
      debounced("c");
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(399));
    expect(fn).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("uses a 400ms default delay", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn));

    act(() => result.current());
    act(() => vi.advanceTimersByTime(399));
    expect(fn).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancels pending invocations on unmount", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn));

    act(() => result.current());
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(fn).not.toHaveBeenCalled();
  });

  it("invokes the latest callback when it changes before the delay elapses", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ fn }: { fn: () => void }) => useDebouncedCallback(fn),
      { initialProps: { fn: first } },
    );

    act(() => result.current());
    rerender({ fn: second });
    act(() => vi.advanceTimersByTime(400));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});