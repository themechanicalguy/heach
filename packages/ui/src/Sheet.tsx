'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';

export interface SheetProps {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet on a native modal <dialog>: focus trap, Escape and backdrop handled by the browser. */
export function Sheet({ open, title, closeLabel, onClose, children }: Readonly<SheetProps>) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || typeof dialog.showModal !== 'function') return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="heach-sheet" aria-labelledby={titleId} onClose={onClose}>
      <div className="heach-sheet__header">
        <h2 id={titleId} className="heach-sheet__title">
          {title}
        </h2>
        <button type="button" className="heach-button heach-button--ghost" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
      {children}
    </dialog>
  );
}
