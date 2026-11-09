import { expect, it, vi } from 'vitest';
import { failedProviders, retryUnavailable } from '../src/core/retry';
import { parseReference } from '../src/core/parse';
import type { RowState } from '../src/useChecker';
const rows: RowState[] = [0,1,2].map(id=>({id,raw:`ref ${id}`,state:'done',result:{reference:parseReference(`ref ${id}`),verdict:id===0?'Verified':'Could not check',explanation:'',checkedAt:'2026-11-09',evidence:id===1?[{index:'OpenAlex',status:'failed',url:'https://api.openalex.org',count:0}]:[]}}));
it('retries only unavailable indexes, preserves completed results, and reports the provider', async () => {
 const verify = vi.fn(async () => rows[0].result!); const patch = vi.fn();
 await retryUnavailable(rows,undefined,verify,patch,()=>true);
 expect(verify).toHaveBeenCalledExactlyOnceWith('ref 1'); expect(patch).toHaveBeenCalledWith(1,rows[0].result);
 expect(failedProviders(rows[1].result)).toEqual(['OpenAlex']);
});
it('supports row targeting and ignores stale completions after cancel', async () => {
 const patch = vi.fn(); let active = true;
 await retryUnavailable(rows,[2],async()=>rows[0].result!,patch,()=>active); expect(patch).not.toHaveBeenCalled();
 await retryUnavailable(rows,[1],async()=>{active=false; return rows[0].result!;},patch,()=>active); expect(patch).not.toHaveBeenCalled();
});
