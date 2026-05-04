import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckSquare, Square, Trash2, X } from 'lucide-react';

interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  itemLabel: string; // e.g. "password", "note"
  onSelectAll: () => void;
  onClear: () => void;
  onExit: () => void;
  onBulkDelete: () => Promise<void> | void;
  /** Optional confirmation copy override */
  confirmDescription?: string;
}

/**
 * Floating action bar for multi-select list views.
 * Renders fixed at the bottom of the viewport when at least one item is
 * selected. Includes select-all/clear toggle, "X selected" count, and a
 * delete-with-confirmation button.
 */
export function SelectionBar({
  selectedCount,
  totalCount,
  allSelected,
  itemLabel,
  onSelectAll,
  onClear,
  onExit,
  onBulkDelete,
  confirmDescription,
}: SelectionBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const plural = selectedCount === 1 ? itemLabel : `${itemLabel}s`;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onBulkDelete();
      setShowConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        data-testid="selection-bar"
        // On mobile we lift the bar above the bottom-tabs gutter (~96px +
        // iOS safe-area inset) so the Delete button is never trapped behind
        // the nav. lg:bottom-6 collapses back to a normal floating bar on
        // desktop where the nav is on the left side instead.
        className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] lg:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md
                   rounded-2xl border border-border/60 bg-background/95 backdrop-blur
                   shadow-2xl px-2.5 py-2 flex items-center gap-1.5"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={allSelected ? onClear : onSelectAll}
          className="rounded-xl gap-1.5 text-xs px-2 h-9 flex-shrink-0"
          data-testid="button-toggle-select-all"
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{allSelected ? 'Deselect all' : 'Select all'}</span>
        </Button>

        <span className="text-xs sm:text-sm font-medium flex-1 text-center truncate">
          {selectedCount} selected
        </span>

        <Button
          variant="destructive"
          size="sm"
          disabled={selectedCount === 0}
          onClick={() => setShowConfirm(true)}
          className="rounded-xl gap-1.5 text-xs h-9 px-3 flex-shrink-0 font-semibold"
          data-testid="button-bulk-delete"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="rounded-xl h-9 w-9 p-0 flex-shrink-0"
          aria-label="Exit selection"
          data-testid="button-exit-selection"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={open => !isDeleting && setShowConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} {plural}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription
                ?? `This will permanently delete ${selectedCount} ${plural}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              {isDeleting ? 'Deleting…' : `Delete ${selectedCount}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SelectionCheckboxProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
}

/**
 * Compact circular checkbox used in list rows. Stops click propagation so the
 * underlying row click (open detail) doesn't fire.
 */
export function SelectionCheckbox({ checked, onChange, label }: SelectionCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? 'Select item'}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
                  ${checked
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/30 hover:border-primary/60 bg-transparent'}`}
      data-testid="selection-checkbox"
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M3 8.5L6.5 12L13 5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
