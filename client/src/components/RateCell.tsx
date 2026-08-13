import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

/**
 * The pay rate, edited in place on the crew table.
 *
 * Optional by design: empty means "we do not track what this person costs",
 * which is how plenty of small crews run and is the default. Empty is saved as
 * null rather than zero — zero would be a rate, and would quietly value their
 * hours at nothing in the cost figures.
 *
 * It saves on blur rather than behind a button because it is one number on a
 * row of many, and a save button per row would be a worse table.
 */
export function RateCell({
  path,
  value,
  onSaved,
}: {
  /** `/api/employees/:id` or `/api/subcontractors/:id`. */
  path: string;
  value: number | null;
  onSaved?: () => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(value === null ? "" : String(value));
  }, [value]);

  const save = async () => {
    const trimmed = text.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setText(value === null ? "" : String(value));
      return;
    }
    if (next === value) return;
    setSaving(true);
    try {
      await apiFetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate: next }),
      });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Input
      className="h-8 w-24 text-right"
      inputMode="decimal"
      value={text}
      placeholder="—"
      disabled={saving}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
