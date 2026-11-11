#!/usr/bin/env python3
"""Fetch only committed HALLMARK artifacts, pinned; no API/LLM baseline reruns."""
import argparse, collections, hashlib, json, pathlib, subprocess
PIN = 'c62d296d1d2e3e6f9cb325e37963b63350ab2ca4'
ROOT = pathlib.Path('eval/hallmark')
p = argparse.ArgumentParser(); p.add_argument('--repo', type=pathlib.Path, default=ROOT/'cache/upstream'); args=p.parse_args()
if not (args.repo/'.git').exists():
    args.repo.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['git','clone','--quiet','--filter=blob:none','--no-checkout','https://github.com/rpatrik96/hallmark.git',str(args.repo)],check=True)
def git(*argv): return subprocess.check_output(['git','-C',str(args.repo),*argv])
assert git('rev-parse','c62d296^{commit}').decode().strip() == PIN
paths=['LICENSE','README.md','pyproject.toml','hallmark/evaluation/metrics.py','hallmark/dataset/schema.py',
       'hallmark/evaluation/selective.py','results/relabel_delta/regenerate_cascade.py']
paths += ['data/v1.2/'+s+'.jsonl' for s in ['test_public_blind','test_public','dev_public','dev_public_blind','gptzero_neurips2025']]
paths += [x for x in git('ls-tree','-r','--name-only',PIN,'data/v1.2/baseline_results').decode().splitlines()
          if x.endswith(('_test_public.json','_dev_public.json')) or x.endswith('/manifest.json')]
# Released default cascade has no full per-key predictions. Preserve an explicitly
# named GPT-5.1 cascade variant instead; do not misrepresent it as that default.
paths += ['results/checkpoints/llm_openai/openai_gpt-5.1.jsonl']
paths += ['results/cascade_gpt51/gpt51_'+s+'_preds.jsonl' for s in ['dev_public','test_public']]
paths += ['results/cascade_gpt51/gpt51_'+s+'.json' for s in ['dev_public','test_public']]
files=[]
for path in sorted(paths):
    data=git('show',PIN+':'+path)
    dest=ROOT/'data'/(path.removeprefix('data/v1.2/') if path.startswith('data/v1.2/') else 'upstream/'+path)
    dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    files.append(dict(upstream_path=path,local_path=str(dest),sha256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
(ROOT/'data/manifest.json').write_text(json.dumps(dict(repository='https://github.com/rpatrik96/hallmark',commit=PIN,files=files),indent=2)+'\n')
for split in ['dev_public','test_public']:
    rows=[json.loads(x) for x in (ROOT/'data'/f'{split}.jsonl').read_text().splitlines()]
    print(split,len(rows),dict(collections.Counter(x['label'] for x in rows)))
print('commit',PIN,'files',len(files))
