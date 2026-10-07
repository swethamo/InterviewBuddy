// Prep hook: owns the backend-backed saved setup list and local import safeguards.
import { useCallback, useEffect, useState } from "react";
import { loadPrepSetups } from "../services/prepSetupStorage";
import {
  createPrepSetup,
  deletePrepSetup,
  listPrepSetups,
  updatePrepSetup,
} from "../services/prepSetupApi";
import type { InterviewSetup } from "../types/interviewSetup";

const IMPORTED_LOCAL_IDS_KEY = "interview-prep-imported-local-ids";

function readImportedLocalIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(IMPORTED_LOCAL_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeImportedLocalIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(IMPORTED_LOCAL_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // The import cache may be unavailable, but the local setup data remains recoverable.
  }
}

export function usePrepSetups() {
  const [setups, setSetups] = useState<InterviewSetup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [localImportMessage, setLocalImportMessage] = useState("");

  const refreshSetups = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const nextSetups = await listPrepSetups();
      setSetups(nextSetups);

      const localState = loadPrepSetups();
      const importedIds = readImportedLocalIds();
      const remainingLocalSetups =
        localState.status === "ready"
          ? localState.setups.filter((setup) => !importedIds.has(setup.id))
          : [];

      setLocalImportMessage(
        remainingLocalSetups.length > 0
          ? `You have ${remainingLocalSetups.length} local saved setup(s) ready to import.`
          : "",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The server could not load saved setups.";
      setErrorMessage(message);
      const localState = loadPrepSetups();
      const importedIds = readImportedLocalIds();
      const remainingLocalSetups =
        localState.status === "ready"
          ? localState.setups.filter((setup) => !importedIds.has(setup.id))
          : [];

      if (remainingLocalSetups.length > 0) {
        setLocalImportMessage(
          `${remainingLocalSetups.length} local saved setup(s) are available to import to the backend.`,
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadSetups = async () => {
      await refreshSetups();
    };
    void loadSetups();
  }, [refreshSetups]);

  const saveSetup = useCallback(
    async (setup: InterviewSetup) => {
      setIsSaving(true);
      setErrorMessage("");

      try {
        const existingSetup = setups.find((item) => item.id === setup.id);
        const savedSetup = existingSetup
          ? await updatePrepSetup(setup.id, setup)
          : await createPrepSetup(setup);

        setSetups((currentSetups) => {
          const nextSetups = currentSetups.some((item) => item.id === savedSetup.id)
            ? currentSetups.map((item) =>
                item.id === savedSetup.id ? savedSetup : item,
              )
            : [savedSetup, ...currentSetups];
          return nextSetups;
        });

        setLocalImportMessage("");
        return { status: "saved" as const, setup: savedSetup };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The setup could not be saved.";
        setErrorMessage(message);
        return { status: "failed" as const, error: message };
      } finally {
        setIsSaving(false);
      }
    },
    [setups],
  );

  const deleteSetup = useCallback(
    async (setup: InterviewSetup) => {
      setIsSaving(true);
      setErrorMessage("");

      try {
        await deletePrepSetup(setup.id);
        setSetups((currentSetups) =>
          currentSetups.filter((item) => item.id !== setup.id),
        );
        setLocalImportMessage("");
        return { status: "deleted" as const };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The setup could not be deleted.";
        setErrorMessage(message);
        return { status: "failed" as const, error: message };
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const importLocalSetups = useCallback(async () => {
    const localState = loadPrepSetups();
    if (localState.status !== "ready") {
      setErrorMessage(localState.error);
      return { status: "failed" as const, error: localState.error };
    }

    const importedIds = readImportedLocalIds();
    const importCandidates = localState.setups.filter(
      (setup) => !importedIds.has(setup.id),
    );

    if (importCandidates.length === 0) {
      setLocalImportMessage("All local saved setups were already imported.");
      return { status: "skipped" as const, count: 0 };
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      for (const localSetup of importCandidates) {
        const importedSetup = await createPrepSetup(localSetup);
        importedIds.add(localSetup.id);
        setSetups((currentSetups) =>
          currentSetups.some((item) => item.id === importedSetup.id)
            ? currentSetups.map((item) =>
                item.id === importedSetup.id ? importedSetup : item,
              )
            : [importedSetup, ...currentSetups],
        );
      }

      writeImportedLocalIds(importedIds);
      setLocalImportMessage(
        `Imported ${importCandidates.length} local saved setup(s) into the backend.`,
      );
      return { status: "imported" as const, count: importCandidates.length };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Some local setups could not be imported.";
      setErrorMessage(message);
      return { status: "failed" as const, error: message };
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    setups,
    isLoading,
    isSaving,
    errorMessage,
    localImportMessage,
    saveSetup,
    deleteSetup,
    importLocalSetups,
    retryLoad: refreshSetups,
    setErrorMessage,
  };
}
