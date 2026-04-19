import { useState, useCallback } from "react";
import { DEFAULT_FILTERS, type FilterState } from "./filter-types";

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: number;
}

const STORAGE_KEY = "portfolio-filter-presets";

function migrateFilters(raw: Partial<FilterState>): FilterState {
  return { ...DEFAULT_FILTERS, ...raw };
}

function loadPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Omit<FilterPreset, "filters"> & { filters: Partial<FilterState> }>;
    return parsed.map((p) => ({ ...p, filters: migrateFilters(p.filters) }));
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadPresets());

  const savePreset = useCallback((name: string, filters: FilterState) => {
    const newPreset: FilterPreset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      filters,
      createdAt: Date.now(),
    };
    setPresets((prev) => {
      const updated = [...prev, newPreset];
      savePresets(updated);
      return updated;
    });
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePresets(updated);
      return updated;
    });
  }, []);

  return { presets, savePreset, deletePreset };
}
