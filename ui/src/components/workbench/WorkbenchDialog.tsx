/**
 * Modal dialog for the workbench (phase 36 §7): rename/delete confirms and
 * the narrow-viewport sidebar drawer all use this shell. `role="dialog"`
 * `aria-modal="true"`, focus trapped, Escape closes, focus returns to the
 * invoking element (recorded at open time by useFocusTrap).
 */

import { useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from './focus';

interface WorkbenchDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Action row rendered by the caller (Save/Delete + Cancel buttons). */
  footer: ReactNode;
  describedBy?: string;
}

export function WorkbenchDialog({ open, title, onClose, children, footer, describedBy }: WorkbenchDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useFocusTrap(open, panelRef, onClose);
  if (!open) return null;

  return (
    <div className="apx-dialog-backdrop">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className="apx-dialog"
        tabIndex={-1}
      >
        <h3 id={titleId} className="apx-dialog-title">
          {title}
        </h3>
        <div className="apx-dialog-body">{children}</div>
        <div className="apx-dialog-footer">{footer}</div>
      </div>
    </div>
  );
}
