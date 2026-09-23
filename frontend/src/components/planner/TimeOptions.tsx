import { useState } from "react";
import { TIME_PRESETS, presetDeparture, type TimePresetId } from "../../lib/time";
import SegmentedControl from "../ui/SegmentedControl";
import AdvancedOptions from "./AdvancedOptions";

export type DepartureMode = TimePresetId | "custom";

export interface TimeOptionsProps {
  departure: string;
  onDepartureChange: (iso: string) => void;
  durationMax?: number | null;
  onDurationMaxChange?: (minutes: number | null) => void;
}

const CUSTOM_OPTION = { label: "Personalizar", value: "custom" };

export default function TimeOptions({
  departure,
  onDepartureChange,
  durationMax,
  onDurationMaxChange,
}: TimeOptionsProps) {
  const [selected, setSelected] = useState<DepartureMode>("now");

  function handleChange(value: string) {
    if (value === "custom") {
      setSelected("custom");
      return;
    }
    const preset = value as TimePresetId;
    setSelected(preset);
    onDepartureChange(presetDeparture(preset));
  }

  return (
    <div data-mode={selected} className="flex flex-col gap-3">
      <SegmentedControl
        options={[...TIME_PRESETS.map((p) => ({ label: p.label, value: p.id })), CUSTOM_OPTION]}
        value={selected}
        onChange={handleChange}
        ariaLabel="Momento de salida"
      />
      {selected === "custom" && (
        <AdvancedOptions
          value={departure}
          onDepartureChange={onDepartureChange}
          durationMax={durationMax}
          onDurationMaxChange={onDurationMaxChange}
        />
      )}
    </div>
  );
}