import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePlace } from "./places";

afterEach(() => vi.restoreAllMocks());

describe("resolvePlace", () => {
  it("trims the input and resolves the geocoded point", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ query: "Ciudad Real", coordinates: { lat: 38.9861, lon: -3.9292 } }),
        { status: 200 },
      ),
    );

    await expect(resolvePlace("  Ciudad Real  ")).resolves.toEqual({
      label: "Ciudad Real",
      lat: 38.9861,
      lon: -3.9292,
    });
  });

  it("geocodes the trimmed query", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ query: "Ciudad Real", coordinates: { lat: 38.9861, lon: -3.9292 } }),
        { status: 200 },
      ),
    );

    await resolvePlace("  Ciudad Real  ");

    expect(fetchMock).toHaveBeenCalledWith("/api/geocode?q=Ciudad%20Real");
  });

  it("returns null when the geocode call fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );

    await expect(resolvePlace("Ciudad Real")).resolves.toBeNull();
  });

  it("returns null when the geocode call has no results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ query: "Nowhere" }), { status: 200 }),
    );

    await expect(resolvePlace("Nowhere")).resolves.toBeNull();
  });

  it("returns null on blank input without calling the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(resolvePlace("   ")).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});