"use client";

import { Button } from "./Button";
import { Sheet } from "./Sheet";

export type ConfirmSheetProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
};

export function ConfirmSheet({ open, onClose, onConfirm, title, message, confirmLabel, danger, pending }: ConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-4 text-muted-foreground">{message}</p>
      <div className="flex flex-col gap-2">
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} pending={pending}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
