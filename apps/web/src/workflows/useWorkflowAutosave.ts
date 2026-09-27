import { useCallback, useEffect, useRef } from "react";

export function useSerializedWorkflowSave() {
  const queue = useRef<Map<string, Promise<void>>>(new Map());

  return useCallback(async (key: string, operation: () => Promise<void>) => {
    const previous = queue.current.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    queue.current.set(key, current);
    try {
      await current;
    } finally {
      if (queue.current.get(key) === current) queue.current.delete(key);
    }
  }, []);
}

type WorkflowAutosaveOptions = {
  revision: object;
  enabled: boolean;
  save: () => Promise<void>;
  onError: (message: string) => void;
  fallbackError: string;
  delay?: number;
};

export function useWorkflowAutosave({
  revision,
  enabled,
  save,
  onError,
  fallbackError,
  delay = 350,
}: WorkflowAutosaveOptions) {
  const saveRef = useRef(save);
  const errorRef = useRef(onError);
  saveRef.current = save;
  errorRef.current = onError;

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void saveRef.current().catch(problem => {
        errorRef.current(problem instanceof Error ? problem.message : fallbackError);
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [revision, enabled, fallbackError, delay]);
}
