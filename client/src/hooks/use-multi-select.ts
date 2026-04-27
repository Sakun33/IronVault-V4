import { useCallback, useEffect, useMemo, useState } from 'react';

export interface UseMultiSelectResult<T extends { id: string }> {
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: () => void;
  clear: () => void;
  enterSelectionMode: (firstId?: string) => void;
  exitSelectionMode: () => void;
  allSelected: boolean;
  someSelected: boolean;
  selectedItems: T[];
}

/**
 * Multi-select hook for list pages. Items must have a stable `id` field.
 *
 * - `enterSelectionMode(id?)` — turns on selection UI; optional first selection
 * - `toggle(id)` — flips selection
 * - `selectAll()` / `clear()` — header checkbox helpers
 * - Auto-exits selection mode if the visible list becomes empty or all selected
 *   items disappear (e.g. after a bulk delete)
 */
export function useMultiSelect<T extends { id: string }>(items: T[]): UseMultiSelectResult<T> {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drop selections whose items no longer exist (after delete / filter change)
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visibleIds = new Set(items.map(i => i.id));
    let changed = false;
    const next = new Set<string>();
    selectedIds.forEach(id => {
      if (visibleIds.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) setSelectedIds(next);
  }, [items, selectedIds]);

  // Auto-exit selection mode when nothing is selected (e.g. after bulk delete)
  useEffect(() => {
    if (isSelectionMode && selectedIds.size === 0 && items.length === 0) {
      setIsSelectionMode(false);
    }
  }, [isSelectionMode, selectedIds.size, items.length]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(i => i.id)));
  }, [items]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback((firstId?: string) => {
    setIsSelectionMode(true);
    if (firstId) setSelectedIds(new Set([firstId]));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  const selectedItems = useMemo(
    () => items.filter(i => selectedIds.has(i.id)),
    [items, selectedIds],
  );

  return {
    isSelectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggle,
    selectAll,
    clear,
    enterSelectionMode,
    exitSelectionMode,
    allSelected,
    someSelected,
    selectedItems,
  };
}
