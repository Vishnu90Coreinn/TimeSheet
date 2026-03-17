/**
 * useConfirm.ts — Reusable inline confirmation hook (Cross-cutting fix)
 * Use for irreversible actions (Approve, Reject) that require a confirmation step.
 * Low-risk actions (Remind, Refresh) do not need this.
 */
import { useState, useCallback } from "react";

interface ConfirmState<T> {
  open: boolean;
  payload: T | null;
}

export interface UseConfirmReturn<T> {
  confirming: boolean;
  payload: T | null;
  request: (payload: T) => void;
  confirm: () => T | null;
  cancel: () => void;
}

export function useConfirm<T = unknown>(): UseConfirmReturn<T> {
  const [state, setState] = useState<ConfirmState<T>>({ open: false, payload: null });

  const request = useCallback((payload: T) => {
    setState({ open: true, payload });
  }, []);

  const confirm = useCallback((): T | null => {
    const { payload } = state;
    setState({ open: false, payload: null });
    return payload;
  }, [state]);

  const cancel = useCallback(() => {
    setState({ open: false, payload: null });
  }, []);

  return {
    confirming: state.open,
    payload: state.payload,
    request,
    confirm,
    cancel,
  };
}
