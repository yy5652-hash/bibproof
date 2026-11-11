import {it,expect} from 'vitest';
import {verifyReference} from '../src/core/verify';
import {clientFor,crossrefItem} from './helpers';
const doi='10.1038/nature14539';
async function check(written:string,title='Deep learning') {
 const work=crossrefItem({doi,title,authors:[['Y.','LeCun'],['Y.','Bengio'],['G.','Hinton']],year:2015,venue:'Nature'});
 return verifyReference(`LeCun, Y., Bengio, Y., & Hinton, G. (2015). ${written}. Nat., 521, 436–444. https://doi.org/${doi}`,clientFor({crossrefWork:{[doi]:work}}).client);
}
it('rejects invented assertions appended to a real title, including the evidence field',async()=>{
 const r=await check('Deep learning proves astrology predicts student exam grades');
 expect(r.verdict).toBe('Details differ');expect(r.score?.fields[0].status).toBe('differ');
});
it.each([
 ['Deep learning','Deep learning: Methods and applications'],
 ['Deep learning: Methods and applications','Deep learning'],
 ['The Deep learning','Deep learning'],['A Deep learning','Deep learning'],
 ['Deep learning [Preprint]','Deep learning'],
 ['Deep learning — Methods and applications','Deep learning: Methods and applications'],
 ['Deep learning for colour modelling','Deep learning for color modeling'],
 ['Deep learning, second edition','Deep learning, second edition']
])('keeps benign title %s verified',async(a,b)=>expect((await check(a,b)).verdict).toBe('Verified'));

it.each(['Deep learning, 2nd edition','Deep learning, version 2'])('allows edition and version metadata: %s',async title=>{
 expect((await check(title)).verdict).toBe('Verified');
});
it('different subtitles on both sides still require review',async()=>{
 expect((await check('Deep learning: Astrology predicts student exam grades','Deep learning: Methods and applications')).verdict).toBe('Identifier conflict');
});
