import type { CheckResult } from './types';
import type { RowState } from '../useChecker';
export const failedProviders = (r?: CheckResult) => [...new Set(r?.evidence.filter(e => e.status === 'failed').map(e => e.index) ?? [])];
export const retryable = (r?: CheckResult) => r?.verdict === 'Could not check' && failedProviders(r).length > 0;
/** Only retry index failures. Other rows and all user decisions remain untouched. */
export async function retryUnavailable(rows: RowState[], ids: number[] | undefined, verify: (raw: string) => Promise<CheckResult>, patch: (id: number, result: CheckResult) => void, active: () => boolean) {
  const pending = rows.filter(r => retryable(r.result) && (!ids || ids.includes(r.id)));
  let next = 0;
  await Promise.all(Array.from({length:Math.min(3,pending.length)}, async () => {
    while (active()) {
      const row = pending[next++]; if (!row) return;
      const result = await verify(row.raw);
      if (active()) patch(row.id,result);
    }
  }));
}
