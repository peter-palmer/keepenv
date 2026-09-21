import { Button, Modal } from "@/components/ui/index.ts";

export interface ConflictDialogProps {
  readonly open: boolean;
  readonly fileName: string;
  readonly onReload: () => void;
  readonly onReview: () => void;
  readonly onOverwrite: () => void;
}

/**
 * Shown when the file changed on disk after Keepenv loaded it.
 *
 * Deliberately not a merge editor: the three outcomes are keep theirs, keep
 * looking, or keep mine, and each one is explicit.
 */
export function ConflictDialog({
  open,
  fileName,
  onReload,
  onReview,
  onOverwrite,
}: ConflictDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onReview();
        }
      }}
      title="This file changed outside Keepenv"
      tone="warning"
      size="wide"
      description={
        <>
          <span className="font-mono text-ink">{fileName}</span> was modified on
          disk after Keepenv opened it — by an editor, a script or a branch
          switch. Keepenv did not save, so nothing has been overwritten.
        </>
      }
      footer={
        <>
          <Button onClick={onReview}>Review my changes</Button>
          <Button onClick={onOverwrite} variant="danger">
            Overwrite anyway
          </Button>
          <Button onClick={onReload} variant="primary">
            Reload from disk
          </Button>
        </>
      }
    >
      <ul className="space-y-1.5 text-[12.5px] text-ink-muted">
        <li>
          <span className="font-medium text-ink">Reload from disk</span> discards
          your unsaved edits and shows the current file.
        </li>
        <li>
          <span className="font-medium text-ink">Review my changes</span> closes
          this dialog and leaves your edits untouched.
        </li>
        <li>
          <span className="font-medium text-ink">Overwrite anyway</span> replaces
          the file on disk with what Keepenv has.
        </li>
      </ul>
    </Modal>
  );
}
