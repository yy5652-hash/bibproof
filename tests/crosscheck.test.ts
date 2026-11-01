import { describe, expect, it } from 'vitest';
import { crossCheck } from '../src/core/crosscheck';

const entries = [
  '[1] Smith, J. (2020). Graph sampling for tiny networks. Journal of Examples.',
  '[2] Garcia, M., & Lee, K. (2019). Second paper title here. Other Journal.',
  '[3] Okafor, N. (2018). Third paper about something. Venue.',
  '[4] Park, S. (2017). Fourth paper nobody cites. Venue.',
];
describe('crossCheck', () => {
  it('numeric style: expands ranges, finds a missing number and the entries never cited', () => {
    const r = crossCheck('We build on [1], and on [2–3]. A claim without a source [9].', entries);
    expect(r.style).toBe('Numeric');
    expect(r.missing).toEqual(['[9]']);
    expect(r.uncited).toEqual([4]);
  });
  it('author-year style: matches by surname and year, including et al. and & forms, and lists the gaps', () => {
    const body = 'Smith (2020) showed this. Garcia & Lee, 2019 agree, as do Okafor et al. (2018). Nobody (2015) said otherwise.';
    const r = crossCheck(body, entries.map(e => e.replace(/^\[\d\]\s*/, '')));
    expect(r.style).toBe('Author–year');
    expect(r.missing).toContain('Nobody, 2015');
    expect(r.uncited).toEqual([4]);
  });
  it('does not infer unused entries when no in-text citations are detected', () => {
    const r = crossCheck('A body without any citation markers at all.', entries);
    expect(r.style).toBe('Not detected');
    expect(r.uncited).toEqual([]);
  });
  it('a year suffix must agree: Smith 2020b is not Smith 2020', () => {
    const r = crossCheck('As in Smith (2020b).', ['Smith, J. (2020a). One. V.', 'Smith, J. (2020b). Two. V.']);
    expect(r.missing).toEqual([]);
    expect(r.uncited).toEqual([1]);
  });
});
