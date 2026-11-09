import { expect, it } from 'vitest';
import { citingSentences } from '../src/core/citing';
import { editsNeeded, manuscriptEdits } from '../src/core/repairs';
const entries = ['[1] Smith, J. (2020). First work.', '[2] Jones, K. (2021). Second work.', '[3] Lee, S. (2022). Third work.'];
const rows = entries.map((raw,id)=>({raw,id}));
it('tracks removal plus downstream numeric citation edits and each sentence choice', () => {
  const citing = citingSentences('First claim [1]. Second claim [2]. Third claim [3].',entries,true);
  const edits = manuscriptEdits(rows,{1:{kind:'remove'}},citing,{'1:0':'remove','2:0':'keep'});
  expect(edits).toHaveLength(2); expect(editsNeeded(edits)).toBe(2);
  expect(edits[1]).toMatchObject({old:'3',next:2,choice:'keep',renumber:true});
});
it('a replacement prompts claim review even without renumbering', () => {
  const citing = citingSentences('Smith (2020) supports this.', entries,true);
  const edits = manuscriptEdits(rows,{0:{kind:'record'}},citing,{});
  expect(edits).toHaveLength(1); expect(editsNeeded(edits)).toBe(1);
  expect(editsNeeded(manuscriptEdits(rows,{0:{kind:'record'}},citing,{'0:0':'keep'}))).toBe(0);
  expect(manuscriptEdits(rows,{},citing,{})).toEqual([]);
});
it('repair mode retains every citing sentence without clipping', () => {
  const body = Array.from({length:7},(_,i)=>`Sentence ${i} ${'long words '.repeat(40)} [2].`).join(' ');
  const citing = citingSentences(body,entries,true);
  expect(citing.byEntry[1]).toHaveLength(7); expect(citing.byEntry[1][0].length).toBeGreaterThan(320);
  expect(manuscriptEdits(rows,{1:{kind:'remove'}},citing,{})).toHaveLength(7);
});

import { retainSentenceReviews } from '../src/core/repairs';
it('retains unrelated sentence reviews but invalidates changed sources and shifted numbers', () => {
 const reviews={'0:0':'keep','1:0':'revise','2:0':'keep'} as const;
 expect(retainSentenceReviews(rows,{}, {1:{kind:'record'}},reviews)).toEqual({'0:0':'keep','2:0':'keep'});
 expect(retainSentenceReviews(rows,{}, {1:{kind:'remove'}},reviews)).toEqual({'0:0':'keep'});
});
