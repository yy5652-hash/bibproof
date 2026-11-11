#!/usr/bin/env python3
"""Cross-check JS results with exact pinned upstream Python metric functions.
Load only the named AST definitions, avoiding any package installs or API calls.
"""
import ast, collections, dataclasses, json, pathlib, types
root=pathlib.Path('eval/hallmark')
source=root/'data/upstream/hallmark/evaluation/metrics.py'
tree=ast.parse(source.read_text()); names={'ConfusionMatrix','is_answer','build_confusion_matrix','per_tier_metrics'}
module=ast.Module(body=[ast.ImportFrom(module='__future__',names=[ast.alias(name='annotations')],level=0)]+[node for node in tree.body if isinstance(node,(ast.ClassDef,ast.FunctionDef)) and node.name in names],type_ignores=[])
namespace={'dataclass':dataclasses.dataclass,'defaultdict':collections.defaultdict}
exec(compile(ast.fix_missing_locations(module),str(source),'exec'),namespace)
report=json.loads((root/'results-dev_public.json').read_text()); labels={x['bibtex_key']:x for x in map(json.loads,(root/'data/dev_public.jsonl').read_text().splitlines())}
entries=[types.SimpleNamespace(**labels[k]) for k in report['paired_keys']]
checks=[]
for comparison in report['comparisons']:
    predictions={x['bibtex_key']:types.SimpleNamespace(evaluated=x.get('evaluated',True),**{k:v for k,v in x.items() if k!='evaluated'}) for x in map(json.loads,pathlib.Path(comparison['source']).read_text().splitlines())}
    cm=namespace['build_confusion_matrix'](entries,predictions); tiers=namespace['per_tier_metrics'](entries,predictions);actual=comparison['metrics']
    expected=dict(tp=cm.tp,fp=cm.fp,tn=cm.tn,fn=cm.fn,detection_rate=cm.detection_rate,false_positive_rate=cm.false_positive_rate,f1=cm.f1,tier3_f1=tiers.get(3,{}).get('f1',0))
    for key,value in expected.items(): assert abs(actual[key]-value)<1e-12,(comparison['name'],key,actual[key],value)
    checks.append(dict(tool=comparison['name'],exact_upstream_metric_agreement=True,values=expected))
# Include UNCERTAIN and missing explicitly; the completed pilot itself had neither.
e=[types.SimpleNamespace(bibtex_key=str(i),label='VALID' if i<3 else 'HALLUCINATED',difficulty_tier=1 if i==4 else 3) for i in range(6)]
p={str(i):types.SimpleNamespace(label=label,evaluated=True) for i,label in enumerate(['HALLUCINATED','VALID','UNCERTAIN','HALLUCINATED','VALID','UNCERTAIN'])}
cm=namespace['build_confusion_matrix'](e,p);assert (cm.tp,cm.fp,cm.tn,cm.fn)==(1,1,1,1)
assert abs(namespace['per_tier_metrics'](e,p)[3]['f1']-2/3)<1e-12
del p['5']; cm=namespace['build_confusion_matrix'](e,p);assert (cm.tp,cm.fp,cm.tn,cm.fn)==(1,1,1,1)
out=dict(upstream_commit=report['upstream_commit'],method='Exact AST extraction of upstream ConfusionMatrix, is_answer, build_confusion_matrix and per_tier_metrics; no rewritten metric formulas.',checks=checks,uncertain_and_missing_fixture_passed=True)
(root/'official-metric-check.json').write_text(json.dumps(out,indent=2)+'\n');print('Official upstream metrics agree for all',len(checks),'pilot comparison rows; abstention fixture passed.')
