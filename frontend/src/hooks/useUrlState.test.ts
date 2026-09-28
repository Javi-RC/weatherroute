import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUrlState } from "./useUrlState";

function readQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

describe("useUrlState", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("round-trips a full state", () => {
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.update({
        origin: { latitude: 40.4168, longitude: -3.7038 },
        originLabel: "Madrid",
        destination: { latitude: 39.8628, longitude: -4.0273 },
        destinationLabel: "Toledo",
        activity: "Cycling",
        departureTime: "2026-09-28T08:00:00Z",
        selectedRouteIndex: 1,
      });
    });

    const query = readQuery();
    expect(query.get("o")).toBe("40.4168,-3.7038");
    expect(query.get("ol")).toBe("Madrid");
    expect(query.get("d")).toBe("39.8628,-4.0273");
    expect(query.get("a")).toBeNull();
    expect(query.get("r")).toBe("1");
  });

  it("writes a non-default activity", () => {
    const { result } = renderHook(() => useUrlState());

    act(() => result.current.update({ activity: "Walking" }));

    expect(readQuery().get("a")).toBe("Walking");
  });

  it("restores state from the query string on mount", () => {
    window.history.replaceState(
      null,
      "",
      "/?o=40.4168,-3.7038&ol=Madrid&d=39.8628,-4.0273&dl=Toledo&a=Walking&r=2",
    );

    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.origin).toEqual({ latitude: 40.4168, longitude: -3.7038 });
    expect(result.current.state.originLabel).toBe("Madrid");
    expect(result.current.state.destination).toEqual({ latitude: 39.8628, longitude: -4.0273 });
    expect(result.current.state.destinationLabel).toBe("Toledo");
    expect(result.current.state.activity).toBe("Walking");
    expect(result.current.state.selectedRouteIndex).toBe(2);
  });

  it("ignores malformed coordinates", () => {
    window.history.replaceState(null, "", "/?o=not-a-point&d=");

    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.origin).toBeNull();
    expect(result.current.state.destination).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    window.history.replaceState(null, "", "/?o=999,999");

    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.origin).toBeNull();
  });

  it("rejects an unknown activity", () => {
    window.history.replaceState(null, "", "/?a=Teleportation");

    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.activity).toBe("Cycling");
  });

  it("rejects a negative selected route index and a non-positive max", () => {
    window.history.replaceState(null, "", "/?r=-1&max=0");

    const { result } = renderHook(() => useUrlState());

    expect(result.current.state.selectedRouteIndex).toBeNull();
    expect(result.current.state.maxDurationMinutes).toBeNull();
  });

  it("clears the query string when the state is emptied", () => {
    const { result } = renderHook(() => useUrlState());

    act(() => {
      result.current.update({ originLabel: "Madrid", selectedRouteIndex: 0 });
    });
    expect(readQuery().get("ol")).toBe("Madrid");

    act(() => result.current.update({ originLabel: "", selectedRouteIndex: null }));

    expect(window.location.search).toBe("");
  });

  it("uses replaceState so the back button is not flooded", () => {
    const spy = vi.spyOn(window.history, "replaceState");

    const { result } = renderHook(() => useUrlState());
    act(() => result.current.update({ originLabel: "Madrid" }));

    expect(spy).toHaveBeenCalled();
  });

  it("re-reads the query string on popstate", () => {
    const { result } = renderHook(() => useUrlState());

    act(() => {
      window.history.replaceState(null, "", "/?ol=Segovia");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.state.originLabel).toBe("Segovia");
  });
});
