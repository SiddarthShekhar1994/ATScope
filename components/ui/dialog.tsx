'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './button';

/**
 * Native <dialog> for confirmations. Native semantics first: focus trapping,
 * Escape and backdrop come from the platform.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="panel m-auto w-[min(92vw,440px)] p-0 text-fg backdrop:bg-[rgba(0,0,0,0.6)] backdrop:backdrop-blur-[2px] open:animate-[dlg_200ms_var(--ease-out)]"
    >
      <div className="p-5">
        <h2 className="text-md font-semibold">{title}</h2>
        {description ? <p className="mt-2 text-sm text-fg-1">{description}</p> : null}
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
      <style>{`@keyframes dlg{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}`}</style>
    </dialog>
  );
}
