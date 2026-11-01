import { describe, expect, it } from 'vitest';
import { parseReference } from '../src/core/parse';
import { containment, scoreCandidate, strongMatch } from '../src/core/score';
import type { Work } from '../src/core/types';

const work = (o: Partial<Work> = {}): Work => ({ id: 'w', title: 'Graph sampling for tiny networks', authors: [{ family: 'Smith', given: 'Jane' }, { family: 'Jones', given: 'Kim' }], year: 2020, venue: 'Journal of Examples', url: 'https://doi.org/10.1000/x', source: 'Crossref', ...o });
const REF = 'Smith, J., & Jones, K. (2020). Graph sampling for tiny networks. Journal of Examples, 12, 1–10.';

describe('scoreCandidate', () => {
  it('agrees on every field for the right record', () => {
    const s = scoreCandidate(parseReference(REF), work());
    expect(strongMatch(s)).toBe(true);
    expect(s.fields.filter(f => ['Title', 'Authors', 'Year'].includes(f.field)).every(f => f.status === 'agree')).toBe(true);
  });
  it('allows one year of online-first drift but flags two', () => {
    expect(scoreCandidate(parseReference(REF), work({ year: 2021 })).fields.find(f => f.field === 'Year')!.status).toBe('agree');
    expect(scoreCandidate(parseReference(REF), work({ year: 2023 })).fields.find(f => f.field === 'Year')!.status).toBe('differ');
  });
  it('is not strong when the title is real but the authors belong to another paper (chimera)', () => {
    const s = scoreCandidate(parseReference(REF), work({ authors: [{ family: 'Okafor' }, { family: 'Lindqvist' }] }));
    expect(s.title).toBeGreaterThan(.9); expect(s.authors).toBe(0); expect(strongMatch(s)).toBe(false);
  });
  it('is not strong when the authors are right but the title is different (invented title)', () => {
    const s = scoreCandidate(parseReference('Smith, J., & Jones, K. (2020). Quantum bananas orbit sparse medieval ledgers. Journal of Examples.'), work());
    expect(s.authors).toBe(1); expect(s.title).toBeLessThan(.5); expect(strongMatch(s)).toBe(false);
  });
  it('accepts a truncated author list when the first author agrees', () => {
    const many = work({ authors: ['Smith', 'Jones', 'Lee', 'Park', 'Wu', 'Diaz'].map(family => ({ family })) });
    expect(scoreCandidate(parseReference('Smith, J., et al. (2020). Graph sampling for tiny networks. Journal of Examples.'), many).authors).toBe(1);
  });
  it('compares against the raw string, so an IEEE-style entry scores as well as APA', () => {
    const s = scoreCandidate(parseReference('J. Smith and K. Jones, "Graph sampling for tiny networks," Journal of Examples, vol. 12, 2020.'), work());
    expect(strongMatch(s)).toBe(true);
  });
});
describe('containment', () => {
  it('ignores stop words and order', () => { expect(containment('The Theory of Tiny Networks', 'tiny networks theory')).toBe(1); });
  it('is zero for an empty needle rather than dividing by zero', () => { expect(containment('', 'anything')).toBe(0); });
});
