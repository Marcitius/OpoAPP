"use client";
import { useState } from "react";
import type { HierarchyItem } from "../../lib/study/hierarchy";
import { orderedChildren } from "../../lib/study/hierarchy";
import {
  hierarchyPath,
  selectionRoots,
  searchText,
} from "../../lib/study/selection";
import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";
export type PickerNode = HierarchyItem & { name: string };
const summary = (items: PickerNode[], ids: string[], fallback: string) =>
  ids.length
    ? ids
        .slice(0, 2)
        .map((id) => items.find((n) => n.id === id)?.name ?? "Seleccionar")
        .join(" · ") + (ids.length > 2 ? ` · +${ids.length - 2}` : "")
    : fallback;
export function HierarchyPicker({
  items,
  value,
  onChange,
  multiple = false,
  rootLabel = "Todo",
  allowRoot = true,
  blocked = new Set<string>(),
  onDone,
}: {
  items: PickerNode[];
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  rootLabel?: string;
  allowRoot?: boolean;
  blocked?: Set<string>;
  onDone?: () => void;
}) {
  const [parent, setParent] = useState<string | null>(null),
    [query, setQuery] = useState("");
  const current = items.find((n) => n.id === parent),
    path = parent ? hierarchyPath(items, parent) : [];
  const shown = query.trim()
    ? items.filter((n) => searchText(n.name).includes(searchText(query)))
    : orderedChildren(items, parent);
  const choose = (id: string) => {
    if (multiple)
      onChange(
        selectionRoots(
          items,
          value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
        ),
      );
    else {
      onChange([id]);
      onDone?.();
    }
  };
  return (
    <div className="hierarchy-picker">
      <div className="picker-location">
        <button
          type="button"
          className="ux-link"
          disabled={!parent && !query}
          onClick={() =>
            query ? setQuery("") : setParent(current?.parentId ?? null)
          }
        >
          <Icon name="back" size={18} />
          Atrás
        </button>
        <span>{path.map((n) => n.name).join(" › ") || rootLabel}</span>
      </div>
      <div className="ux-search">
        <Icon name="search" size={18} />
        <input
          aria-label="Buscar tema o apartado"
          placeholder="Buscar por nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {allowRoot && (
        <button
          type="button"
          className="sheet-action"
          onClick={() => {
            onChange([]);
            if (!multiple) onDone?.();
          }}
        >
          {rootLabel}
          {!value.length ? " ✓" : ""}
        </button>
      )}
      {multiple && (
        <div className="picker-selection">
          <span>{summary(items, value, rootLabel)}</span>
          <button
            type="button"
            className="ux-link"
            onClick={() => onChange([])}
          >
            Limpiar
          </button>
        </div>
      )}
      <div className="simple-list">
        {shown.map((n) => {
          const checked = value.includes(n.id),
            covered = hierarchyPath(items, n.id)
              .slice(0, -1)
              .some((p) => value.includes(p.id)),
            children = items.some((c) => c.parentId === n.id),
            disabled = blocked.has(n.id);
          return (
            <div className="picker-row" key={n.id}>
              <button
                type="button"
                className="picker-choose"
                aria-label={`Seleccionar ${n.name}`}
                aria-pressed={checked || covered}
                disabled={disabled || covered}
                onClick={() => choose(n.id)}
              >
                <span
                  className={`selection-check ${checked || covered ? "selected" : ""}`}
                  aria-hidden="true"
                >
                  {checked || covered ? "✓" : ""}
                </span>
                <span>
                  <strong>{n.name}</strong>
                  {query && (
                    <small>
                      {hierarchyPath(items, n.id)
                        .slice(0, -1)
                        .map((n) => n.name)
                        .join(" › ") || rootLabel}
                    </small>
                  )}
                </span>
              </button>
              {children && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Entrar en ${n.name}`}
                  disabled={disabled}
                  onClick={() => {
                    setParent(n.id);
                    setQuery("");
                  }}
                >
                  <Icon name="chevron" />
                </button>
              )}
            </div>
          );
        })}
        {!shown.length && (
          <p className="empty-inline">
            {query
              ? "No hay coincidencias."
              : "No hay subapartados en este nivel."}
          </p>
        )}
      </div>
    </div>
  );
}
export default function HierarchyField({
  items,
  value,
  onChange,
  label,
  rootLabel = "Todo",
  multiple = false,
  allowRoot = true,
  blocked,
}: {
  items: PickerNode[];
  value: string | string[];
  onChange: (value: any) => void;
  label: string;
  rootLabel?: string;
  multiple?: boolean;
  allowRoot?: boolean;
  blocked?: Set<string>;
}) {
  const [open, setOpen] = useState(false),
    ids = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="hierarchy-field">
      <button
        type="button"
        className="hierarchy-field-button"
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <span>
          <small>{label}</small>
          <strong>{summary(items, ids, rootLabel)}</strong>
        </span>
        <Icon name="chevron" />
      </button>
      {open && (
        <BottomSheet title={label} onClose={() => setOpen(false)}>
          <HierarchyPicker
            items={items}
            value={ids}
            onChange={(ids) => onChange(multiple ? ids : (ids[0] ?? ""))}
            multiple={multiple}
            rootLabel={rootLabel}
            allowRoot={allowRoot}
            blocked={blocked}
            onDone={() => setOpen(false)}
          />
          {multiple && (
            <button
              type="button"
              className="primary-button full"
              onClick={() => setOpen(false)}
            >
              Aplicar selección
            </button>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
