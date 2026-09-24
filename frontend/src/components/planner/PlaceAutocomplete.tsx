import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import { searchPlaces } from "../../services/api";
import type { PlaceCandidate } from "../../types";
import TextInput, { type TextInputProps } from "../ui/TextInput";

export interface PlaceAutocompleteProps
  extends Omit<TextInputProps, "value" | "onChange" | "onSelect"> {
  value: string;
  onChange: (value: string) => void;
  onSelect: (candidate: PlaceCandidate) => void;
  onSearchError?: () => void;
}

const SEARCH_DEBOUNCE_MS = 250;
const NOT_FOUND_MESSAGE = "No encontramos ese lugar";

export default function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  onSearchError,
  onBlur,
  ...inputProps
}: PlaceAutocompleteProps) {
  const listboxId = useId();
  const [options, setOptions] = useState<PlaceCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestIdRef = useRef(0);

  const runSearch = useDebouncedCallback(async (query: string) => {
    const requestId = ++requestIdRef.current;
    try {
      const results = await searchPlaces(query);
      if (requestIdRef.current !== requestId) return;
      setOptions(results);
      setSearched(true);
      setOpen(true);
      setActiveIndex(-1);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setOptions([]);
      setSearched(false);
      setOpen(false);
      onSearchError?.();
    }
  }, SEARCH_DEBOUNCE_MS);

  function close() {
    setOpen(false);
    setSearched(false);
    setActiveIndex(-1);
    requestIdRef.current += 1;
  }

  function handleChange(next: string) {
    onChange(next);
    if (next.trim().length < 2) {
      close();
      return;
    }
    runSearch(next);
  }

  function select(candidate: PlaceCandidate) {
    onSelect(candidate);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      if (activeIndex >= 0) {
        event.preventDefault();
        select(options[activeIndex]);
      }
    } else if (event.key === "Escape") {
      close();
    }
  }

  const showEmptyMessage = open && searched && options.length === 0;

  return (
    <div className="relative">
      <TextInput
        {...inputProps}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          close();
          onBlur?.(event);
        }}
        autoComplete="off"
      />
      {open && options.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-sand-200 bg-white py-1 shadow-raise"
        >
          {options.map((option, index) => (
            <li
              key={`${option.lat}-${option.lon}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={[
                "cursor-pointer px-3 py-2 text-sm text-sand-800",
                index === activeIndex ? "bg-ocean-50" : "",
              ].join(" ")}
              onMouseDown={(event) => {
                event.preventDefault();
                select(option);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
      {showEmptyMessage && (
        <p className="absolute z-10 mt-1 w-full rounded-md border border-sand-200 bg-white px-3 py-2 text-sm text-sand-500 shadow-raise">
          {NOT_FOUND_MESSAGE}
        </p>
      )}
    </div>
  );
}
