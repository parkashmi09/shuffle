import { Switch } from "@headlessui/react";
import clsx from "clsx";

export default function BoolSwitch({
  checked, label, onChange
}: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onChange={onChange}
        className={clsx(
          "relative h-6 w-11 rounded-full transition",
          checked ? "bg-emerald-600" : "bg-[#1E2D55]"
        )}
      >
        <span
          className={clsx(
            "inline-block h-4 w-4 rounded-full bg-white transition",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </Switch>
      <span className="capitalize text-sm">{label}</span>
    </div>
  );
}
