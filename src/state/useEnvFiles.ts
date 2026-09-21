import { useCallback, useEffect, useState } from "react";

import { sortEnvFileNames } from "@/lib/env/index.ts";
import {
  createEnvFile,
  listEnvFiles,
  trashEnvFile,
} from "@/services/index.ts";
import type { EnvFileInfo } from "@/services/index.ts";

export interface EnvFilesController {
  readonly files: EnvFileInfo[];
  readonly loaded: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly create: (fileName: string) => Promise<boolean>;
  /** Moves a file to the Trash. Never deletes permanently. */
  readonly trash: (fileName: string) => Promise<boolean>;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

/** Discovers the environment files in a project root, in display order. */
export function useEnvFiles(projectId: string | null): EnvFilesController {
  const [files, setFiles] = useState<EnvFileInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    try {
      setFiles(sortEnvFileNames(await listEnvFiles(id)));
      setError(null);
    } catch (cause) {
      setFiles([]);
      setError(messageOf(cause));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (projectId === null) {
      setFiles([]);
      setLoaded(true);
      setError(null);
      return;
    }
    setLoaded(false);
    void load(projectId);
  }, [projectId, load]);

  const refresh = useCallback(async () => {
    if (projectId !== null) {
      await load(projectId);
    }
  }, [projectId, load]);

  const create = useCallback(
    async (fileName: string): Promise<boolean> => {
      if (projectId === null) {
        return false;
      }
      try {
        await createEnvFile(projectId, fileName);
        await load(projectId);
        return true;
      } catch (cause) {
        setError(messageOf(cause));
        return false;
      }
    },
    [projectId, load],
  );

  const trash = useCallback(
    async (fileName: string): Promise<boolean> => {
      if (projectId === null) {
        return false;
      }
      try {
        await trashEnvFile(projectId, fileName);
        await load(projectId);
        return true;
      } catch (cause) {
        setError(messageOf(cause));
        return false;
      }
    },
    [projectId, load],
  );

  return { files, loaded, error, refresh, create, trash };
}
