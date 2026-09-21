import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parse, serialize } from "@/lib/env/index.ts";
import type { EnvDocument } from "@/lib/env/index.ts";
import { KeepenvError, readEnvFile, writeEnvFile } from "@/services/index.ts";

/**
 * Editing state for one environment file.
 *
 * The file *text* is the single source of truth; the parsed document is
 * derived. That means the Variables and Raw views cannot drift apart: an edit
 * in either one produces new text, and the other renders from it.
 *
 * Unsaved edits are kept per file in memory, so switching tabs never discards
 * work. Nothing here is written to Keepenv's store — drafts live only for the
 * lifetime of the window.
 */

export type EditorStatus = "idle" | "loading" | "ready" | "error";

interface Draft {
  readonly text: string;
  /** The text as it was last read from, or written to, disk. */
  readonly baseline: string;
  /** Fingerprint of the bytes on disk when this draft was based on them. */
  readonly digest: string | null;
}

interface EditorState extends Draft {
  readonly status: EditorStatus;
  readonly error: string | null;
}

const IDLE: EditorState = {
  status: "idle",
  text: "",
  baseline: "",
  digest: null,
  error: null,
};

export interface EnvEditor {
  readonly status: EditorStatus;
  readonly text: string;
  readonly document: EnvDocument;
  readonly isDirty: boolean;
  readonly error: string | null;
  readonly saving: boolean;
  /** Set when the file changed on disk since Keepenv loaded it. */
  readonly hasConflict: boolean;
  /** Files in the current project with unsaved edits. */
  readonly dirtyFileNames: ReadonlySet<string>;
  /** True when any file in any project has unsaved edits. */
  readonly hasUnsavedWork: boolean;
  readonly setText: (text: string) => void;
  readonly applyEdit: (edit: (document: EnvDocument) => EnvDocument) => void;
  readonly save: () => Promise<void>;
  /** Writes over whatever is on disk. Only for an explicit user choice. */
  readonly forceSave: () => Promise<void>;
  readonly reload: () => Promise<void>;
  readonly dismissConflict: () => void;
  readonly dismissError: () => void;
  /** Increments on every successful save, for dependents like Git status. */
  readonly revision: number;
}

/** Neither a project id nor a validated file name can contain "::". */
function draftKey(projectId: string, fileName: string): string {
  return `${projectId}::${fileName}`;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Could not read the file.";
}

export function useEnvEditor(
  projectId: string | null,
  fileName: string | null,
): EnvEditor {
  const [state, setState] = useState<EditorState>(IDLE);
  const [saving, setSaving] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [revision, setRevision] = useState(0);
  const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const drafts = useRef(new Map<string, Draft>());
  const stateRef = useRef(state);
  stateRef.current = state;

  const key =
    projectId !== null && fileName !== null
      ? draftKey(projectId, fileName)
      : null;
  const keyRef = useRef<string | null>(key);
  keyRef.current = key;

  const markDirty = useCallback((target: string, dirty: boolean) => {
    setDirtyKeys((previous) => {
      if (previous.has(target) === dirty) {
        return previous;
      }
      const next = new Set(previous);
      if (dirty) {
        next.add(target);
      } else {
        next.delete(target);
      }
      return next;
    });
  }, []);

  /** Stores a draft so switching tabs preserves unsaved edits. */
  const remember = useCallback(
    (target: string, draft: Draft) => {
      drafts.current.set(target, draft);
      markDirty(target, draft.text !== draft.baseline);
    },
    [markDirty],
  );

  useEffect(() => {
    if (projectId === null || fileName === null || key === null) {
      setState(IDLE);
      setHasConflict(false);
      return () => {};
    }

    const cached = drafts.current.get(key);
    if (cached !== undefined) {
      setState({ ...cached, status: "ready", error: null });
      setHasConflict(false);
      return () => {};
    }

    let active = true;
    setState({ ...IDLE, status: "loading" });
    setHasConflict(false);

    void readEnvFile(projectId, fileName)
      .then((file) => {
        if (!active) {
          return;
        }
        const draft: Draft = {
          text: file.content,
          baseline: file.content,
          digest: file.digest,
        };
        remember(key, draft);
        setState({ ...draft, status: "ready", error: null });
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({ ...IDLE, status: "error", error: messageOf(cause) });
        }
      });

    return () => {
      active = false;
    };
  }, [projectId, fileName, key, remember]);

  const commitText = useCallback(
    (text: string) => {
      const current = stateRef.current;
      if (current.status !== "ready" || text === current.text) {
        return;
      }
      const target = keyRef.current;
      if (target !== null) {
        remember(target, {
          text,
          baseline: current.baseline,
          digest: current.digest,
        });
      }
      setState({ ...current, text });
    },
    [remember],
  );

  const setText = useCallback(
    (text: string) => commitText(text),
    [commitText],
  );

  const applyEdit = useCallback(
    (edit: (document: EnvDocument) => EnvDocument) => {
      const current = stateRef.current;
      if (current.status !== "ready") {
        return;
      }
      commitText(serialize(edit(parse(current.text))));
    },
    [commitText],
  );

  const write = useCallback(
    async (force: boolean) => {
      const current = stateRef.current;
      if (projectId === null || fileName === null || key === null) {
        return;
      }
      if (current.status !== "ready") {
        return;
      }
      if (!force && current.text === current.baseline) {
        return;
      }

      setSaving(true);
      const saved = current.text;
      try {
        const result = await writeEnvFile(
          projectId,
          fileName,
          saved,
          force ? null : current.digest,
        );
        // `stateRef` is current as of the last render, which is what we want:
        // if the user kept typing during the write, those edits stay unsaved.
        const latest = stateRef.current;
        remember(key, {
          text: latest.text,
          baseline: saved,
          digest: result.digest,
        });
        setState({
          ...latest,
          baseline: saved,
          digest: result.digest,
          error: null,
        });
        setHasConflict(false);
        setRevision((value) => value + 1);
      } catch (cause) {
        if (cause instanceof KeepenvError && cause.kind === "conflict") {
          setHasConflict(true);
        } else {
          setState((previous) => ({ ...previous, error: messageOf(cause) }));
        }
      } finally {
        setSaving(false);
      }
    },
    [projectId, fileName, key, remember],
  );

  const save = useCallback(() => write(false), [write]);
  const forceSave = useCallback(() => write(true), [write]);

  const reload = useCallback(async () => {
    if (projectId === null || fileName === null || key === null) {
      return;
    }
    setState((previous) => ({ ...previous, status: "loading" }));
    try {
      const file = await readEnvFile(projectId, fileName);
      const draft: Draft = {
        text: file.content,
        baseline: file.content,
        digest: file.digest,
      };
      remember(key, draft);
      setState({ ...draft, status: "ready", error: null });
      setHasConflict(false);
      setRevision((value) => value + 1);
    } catch (cause) {
      setState({ ...IDLE, status: "error", error: messageOf(cause) });
    }
  }, [projectId, fileName, key, remember]);

  const dismissConflict = useCallback(() => setHasConflict(false), []);
  const dismissError = useCallback(
    () => setState((previous) => ({ ...previous, error: null })),
    [],
  );

  const document = useMemo(() => parse(state.text), [state.text]);

  const dirtyFileNames = useMemo(() => {
    const names = new Set<string>();
    if (projectId !== null) {
      const prefix = `${projectId}::`;
      for (const candidate of dirtyKeys) {
        if (candidate.startsWith(prefix)) {
          names.add(candidate.slice(prefix.length));
        }
      }
    }
    return names;
  }, [dirtyKeys, projectId]);

  return {
    status: state.status,
    text: state.text,
    document,
    isDirty: state.status === "ready" && state.text !== state.baseline,
    error: state.error,
    saving,
    hasConflict,
    dirtyFileNames,
    hasUnsavedWork: dirtyKeys.size > 0,
    setText,
    applyEdit,
    save,
    forceSave,
    reload,
    dismissConflict,
    dismissError,
    revision,
  };
}
