import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, geocodePlace, reverseGeocode, searchPlaces } from "./api";
import type { GeocodeResult } from "../types";

afterEach(() => vi.restoreAllMocks());

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

describe("geocodePlace", () => {
  it("maps the geocode coordinates to { lat, lon } on an OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ query: "Ciudad Real", coordinates: { lat: 38.9861, lon: -3.9292 } }),
    );

    await expect(geocodePlace("Ciudad Real")).resolves.toEqual({
      lat: 38.9861,
      lon: -3.9292,
    });
  });

  it("URL-encodes the query", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ query: "Ciudad Real", coordinates: { lat: 38.9861, lon: -3.9292 } }),
    );

    await geocodePlace("Ciudad Real");

    expect(fetchMock).toHaveBeenCalledWith("/api/geocode?q=Ciudad%20Real");
  });

  it("returns null when the response has no coordinates", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ query: "Nowhere" }),
    );

    await expect(geocodePlace("Nowhere")).resolves.toBeNull();
  });

  it.each([404, 500])("throws ApiError(geocode_failed) on a %i response", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status }),
    );

    await expectGeocodeError(geocodePlace("Ciudad Real"));
  });

  it("throws ApiError(geocode_failed) when the body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("not json", { status: 200 }),
    );

    await expectGeocodeError(geocodePlace("Ciudad Real"));
  });

  it("throws ApiError(geocode_failed) when coordinates are malformed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ query: "Ciudad Real", coordinates: { lat: "38.9", lon: 1 } }),
    );

    await expectGeocodeError(geocodePlace("Ciudad Real"));
  });

  it("throws ApiError(geocode_failed) instead of a network error when fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expectGeocodeError(geocodePlace("Ciudad Real"));
  });
});

async function expectGeocodeError(promise: Promise<GeocodeResult | null>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("geocode_failed");
    return;
  }
  throw new Error("expected geocodePlace to reject");
}

describe("searchPlaces", () => {
  it("returns [] without calling fetch when the query is shorter than 2 characters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(searchPlaces("C")).resolves.toEqual([]);
    await expect(searchPlaces("  ")).resolves.toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps candidates to { label, lat, lon }", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        query: "Ciudad",
        candidates: [
          { label: "Ciudad Real, España", latitude: 38.9861, longitude: -3.9292 },
          { label: "Ciudad Rodrigo, España", latitude: 40.6, longitude: -6.53 },
        ],
      }),
    );

    await expect(searchPlaces("Ciudad")).resolves.toEqual([
      { label: "Ciudad Real, España", lat: 38.9861, lon: -3.9292 },
      { label: "Ciudad Rodrigo, España", lat: 40.6, lon: -6.53 },
    ]);
  });

  it("URL-encodes the query against /api/geocode/search", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ query: "Ciudad Real", candidates: [] }),
    );

    await searchPlaces("Ciudad Real");

    expect(fetchMock).toHaveBeenCalledWith("/api/geocode/search?q=Ciudad%20Real");
  });

  it.each([404, 500])("throws ApiError(search_failed) on a %i response", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status }));

    await expect(searchPlaces("Ciudad Real")).rejects.toMatchObject({ code: "search_failed" });
  });

  it("throws ApiError(search_failed) when fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(searchPlaces("Ciudad Real")).rejects.toMatchObject({ code: "search_failed" });
  });
});

describe("reverseGeocode", () => {
  it("returns the resolved label", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ label: "Ciudad Real, España" }),
    );

    await expect(reverseGeocode(38.9861, -3.9292)).resolves.toBe("Ciudad Real, España");
    expect(fetchMock).toHaveBeenCalledWith("/api/geocode/reverse?lat=38.9861&lon=-3.9292");
  });

  it("returns null when the label is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ label: null }));

    await expect(reverseGeocode(0, 0)).resolves.toBeNull();
  });

  it.each([404, 500])("throws ApiError(reverse_geocode_failed) on a %i response", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status }));

    await expect(reverseGeocode(0, 0)).rejects.toMatchObject({ code: "reverse_geocode_failed" });
  });
});