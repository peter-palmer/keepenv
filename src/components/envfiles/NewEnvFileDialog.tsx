import { useEffect, useState } from "react";

import { ENV_FILE_NAME_HINT, validateEnvFileName } from "@/lib/env/index.ts";
import { Button, Input, Modal } from "@/components/ui/index.ts";

export interface NewEnvFileDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly existingNames: readonly string[];
  readonly onCreate: (fileName: string) => void;
}

export function NewEnvFileDialog({
  open,
  onOpenChange,
  existingNames,
  onCreate,
}: NewEnvFileDialogProps) {
  const [name, setName] = useState(".env.");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName(".env.");
      setTouched(false);
    }
  }, [open]);

  const error = validateEnvFileName(name, existingNames);
  const submit = () => {
    setTouched(true);
    if (error === null) {
      onCreate(name);
      onOpenChange(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New environment file"
      description={ENV_FILE_NAME_HINT}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={error !== null} onClick={submit}>
            Create file
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        value={name}
        invalid={touched && error !== null}
        placeholder=".env.staging"
        className="font-mono"
        onChange={(event) => {
          setName(event.target.value);
          setTouched(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            submit();
          }
        }}
      />
      {touched && error !== null && (
        <p className="mt-2 text-[12px] text-danger">{error}</p>
      )}
    </Modal>
  );
}
