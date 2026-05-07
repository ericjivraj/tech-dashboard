import { useState, useCallback } from "react";
import type { ProjectStatus } from "@workspace/api-client-react";
import { DEFAULT_FILTERS, type FilterState } from "./filter-types";

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: number;
}

const STORAGE_KEY = "portfolio-filter-presets";

function migrateFilters(raw: Partial<FilterState> & { status?: unknown }): FilterState {
  // Old presets stored status as a string ("all" or a single status). Convert
  // to the new ProjectStatus[] shape so legacy presets keep working.
  let status: ProjectStatus[] = [];
  if (Array.isArray(raw.status)) {
    status = raw.status as ProjectStatus[];
  } else if (typeof raw.status === "string" && raw.status !== "all" && raw.status !== "") {
    status = [raw.status as ProjectStatus];
  }
  return { ...DEFAULT_FILTERS, ...raw, status };
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
