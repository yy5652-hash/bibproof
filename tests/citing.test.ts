import { describe, expect, it } from 'vitest';
import { citingSentences, splitSentences } from '../src/core/citing';

const numbered = [
  '[1] Smith, J. (2020). Graph sampling for tiny networks. Journal of Examples.',
  '[2] Garcia, M., & Lee, K. (2019). Second paper title here. Other Journal.',
  '[3] Okafor, N. (2018). Third paper about something. Venue.',
  '[4] Park, S. (2017). Fourth paper nobody cites. Venue.',
];
const plain = numbered.map(e => e.replace(/^\[\d\]\s*/, ''));

describe('splitSentences', () => {
  it('keeps et al., initials and e.g. inside their sentence, and splits Chinese full stops', () => {
    expect(splitSentences('Garcia et al. (2019) found this. A. Lee agrees, e.g. in tests [2]. Next one.')).toEqual(['Garcia et al. (2019) found this.', 'A. Lee agrees, e.g. in tests [2].', 'Next one.']);
    expect(splitSentences('前人研究表明[1]。我们进一步验证[2]。')).toHaveLength(2);
  });
});

describe('citingSentences', () => {
  it('numeric style: single numbers, lists and ranges map to the right entries', () => {
    const body = 'Sampling is cheap [1]. Two methods agree [2, 3]. Many cover it [1-3]. Nothing here.';
    const r = citingSentences(body, numbered);
    expect(r.style).toBe('numeric');
    expect(r.byEntry[0]).toEqual(['Sampling is cheap [1].', 'Many cover it [1-3].']);
    expect(r.byEntry[1]).toHaveLength(2);
    expect(r.byEntry[2]).toHaveLength(2);
    expect(r.byEntry[3]).toEqual([]);
    expect(r.counts).toEqual([2, 2, 2, 0]);
  });
  it('author-year style: surname and year, with et al. and ampersand forms, and suffixes must match', () => {
    const body = 'Smith (2020) showed this. Garcia & Lee, 2019 agree, as do Okafor et al. (2018). Park (2016) is unrelated.';
    const r = citingSentences(body, plain);
    expect(r.style).toBe('author-year');
    expect(r.byEntry[0]).toEqual(['Smith (2020) showed this.']);
    expect(r.byEntry[1]).toEqual(['Garcia & Lee, 2019 agree, as do Okafor et al. (2018).']);
    expect(r.byEntry[2]).toEqual(['Garcia & Lee, 2019 agree, as do Okafor et al. (2018).']);
    expect(r.byEntry[3]).toEqual([]);
  });
  it('says nothing was detected when the body has no supported citations', () => {
    const r = citingSentences('This text cites nobody in a supported way.', numbered);
    expect(r.detected).toBe(false);
    expect(r.style).toBe('none');
    expect(r.byEntry.every(x => x.length === 0)).toBe(true);
  });
  it('caps the sentences kept per entry but still counts all of them', () => {
    const body = Array.from({ length: 7 }, (_, i) => `Claim number ${i} rests on [1].`).join(' ');
    const r = citingSentences(body, numbered);
    expect(r.byEntry[0]).toHaveLength(4);
    expect(r.counts[0]).toBe(7);
  });
  it('clips very long sentences around the marker', () => {
    const body = `${'word '.repeat(150)}as shown in [2] ${'tail '.repeat(150)}.`;
    const [s] = citingSentences(body, numbered).byEntry[1];
    expect(s.length).toBeLessThan(340);
    expect(s).toContain('[2]');
  });
});
