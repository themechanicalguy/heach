import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePendingAction, useRetryAfterCode } from './use-pending-action.js';

const describeFailure = (caught: unknown) => (caught instanceof Error ? caught.message : 'failed');
const NEEDS_CODE = new Error('code needed');
const needsCode = (caught: unknown) => caught === NEEDS_CODE;

describe('usePendingAction', () => {
  it('runs one action at a time and keeps the failure as described', async () => {
    const { result } = renderHook(() => usePendingAction(describeFailure));
    const gate: { open?: () => void } = {};
    const slow = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          gate.open = resolve;
        }),
    );
    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.run(slow);
    });
    expect(result.current.pending).toBe(true);
    await act(() => result.current.run(slow));
    expect(slow).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.open?.();
      await first;
    });
    expect(result.current.pending).toBe(false);
    await act(() => result.current.run(() => Promise.reject(new Error('offline'))));
    expect(result.current.error).toBe('offline');
  });

  it('keeps the same run between renders', () => {
    const { result, rerender } = renderHook(() => usePendingAction(describeFailure));
    const before = result.current.run;
    rerender();
    expect(result.current.run).toBe(before);
  });
});

describe('useRetryAfterCode (AC-05)', () => {
  const setUp = () =>
    renderHook(() => {
      const { run, error } = usePendingAction(describeFailure);
      return { error, ...useRetryAfterCode(run, needsCode) };
    });

  it('waits for the code, then runs the same action again', async () => {
    const action = vi.fn().mockRejectedValueOnce(NEEDS_CODE).mockResolvedValueOnce(undefined);
    const { result } = setUp();
    await act(() => result.current.attempt(action));
    expect(result.current.verifying).toBe(true);
    expect(result.current.error).toBeUndefined();
    await act(async () => {
      result.current.verified();
      await Promise.resolve();
    });
    expect(action).toHaveBeenCalledTimes(2);
    expect(result.current.verifying).toBe(false);
  });

  it('drops the action when the sheet is closed, and passes other failures on', async () => {
    const action = vi.fn().mockRejectedValue(NEEDS_CODE);
    const { result } = setUp();
    await act(() => result.current.attempt(action));
    act(() => {
      result.current.cancel();
      result.current.verified();
    });
    expect(action).toHaveBeenCalledTimes(1);
    await act(() => result.current.attempt(() => Promise.reject(new Error('refused'))));
    expect(result.current.error).toBe('refused');
    expect(result.current.verifying).toBe(false);
  });
});
