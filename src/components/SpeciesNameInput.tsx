"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SPECIES_PICKLIST, lookupSpeciesId } from "@/lib/pokedex";

interface SpeciesNameInputProps {
  value: string;
  onChange: (name: string, speciesId: number | undefined) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  listId?: string;
}

export function SpeciesNameInput(props: SpeciesNameInputProps) {
  const listId = props.listId ?? "species-name-list";
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionIdPrefix = useId();

  const query = props.value.trim();
  const options = useMemo(() => {
    if (query === "") return SPECIES_PICKLIST;
    return SPECIES_PICKLIST.filter((e) => e.name.includes(query));
  }, [query]);

  // Close when clicking/tapping outside the component.
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open]);

  const select = (entry: { id: number; name: string }) => {
    props.onChange(entry.name, entry.id);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={props.value}
        placeholder={props.placeholder ?? "ポッチャマ"}
        required={props.required === true ? true : undefined}
        className={props.className}
        onChange={(e) => {
          const name = e.target.value;
          props.onChange(name, lookupSpeciesId(name));
          setOpen(true);
          // Typing changes the filtered option set; clear keyboard highlight.
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          // Delay so an option's click can register before we close.
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (open) {
              e.preventDefault();
              setOpen(false);
              setHighlight(-1);
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            setHighlight((h) =>
              options.length === 0 ? -1 : (h + 1) % options.length,
            );
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            setHighlight((h) =>
              options.length === 0
                ? -1
                : (h <= 0 ? options.length : h) - 1,
            );
            return;
          }
          if (e.key === "Enter") {
            // Only intercept Enter when the dropdown is open AND an option
            // is highlighted; otherwise let Enter submit the form normally.
            if (open && highlight >= 0 && highlight < options.length) {
              e.preventDefault();
              select(options[highlight]);
            }
            return;
          }
        }}
      />
      {open && options.length > 0 && (
        <ul
          role="listbox"
          id={listId}
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
        >
          {options.map((entry, idx) => {
            const active = idx === highlight;
            return (
              <li
                key={entry.id}
                id={`${optionIdPrefix}-opt-${entry.id}`}
                role="option"
                aria-selected={active}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                  active
                    ? "bg-blue-500 text-white"
                    : "hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
                // onMouseDown fires before input blur, so selection wins
                // the blur-vs-click race without relying solely on the
                // blur timeout.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(entry);
                }}
                onMouseEnter={() => setHighlight(idx)}
              >
                <span>{entry.name}</span>
                <span
                  className={`ml-3 font-mono text-xs ${
                    active ? "text-blue-100" : "text-gray-400"
                  }`}
                  aria-hidden="true"
                >
                  #{String(entry.id).padStart(3, "0")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
