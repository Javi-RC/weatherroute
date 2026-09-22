import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, geocodePlace } from "./api";
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