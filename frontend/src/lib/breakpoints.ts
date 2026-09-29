import { useMediaQuery } from "./useMediaQuery";

export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
