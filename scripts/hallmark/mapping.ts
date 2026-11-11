import type { CheckResult, Verdict } from '../../src/core/types';
import type { Label } from './common';
export const CONFIDENCE:Record<Verdict,number>={'Verified':0.95,'Details differ':0.80,'Identifier conflict':0.95,'No record found':0.70,'Could not check':0.50,'Retracted':0.50};
export function mapVerdict(result:CheckResult):{label:Label;confidence:number}{
 const v=result.verdict;return {label:v==='Verified'?'VALID':v==='Could not check'||v==='Retracted'?'UNCERTAIN':'HALLUCINATED',confidence:CONFIDENCE[v]};
}
