#!/bin/zsh
# OpenAlex allows about 100 anonymous searches per IP per UTC day. The disk cache keeps
# everything already answered, so rerun after the budget resets until nothing abstains on it.
cd "${0:A:h}/.."
for attempt in 1 2 3 4; do
  npx tsx eval/run.ts > eval/cache/run-$attempt.log 2>&1
  left=$(python3 -c "
import json
r=json.load(open('eval/results.json')); o=r.get('optionalSet') or {}
print(r['metrics']['abstentions']+r['realisticGenuine']['abstentions']+o.get('counts',{}).get('Could not check',0))")
  echo "attempt $attempt: $left abstentions"
  budget=$(curl -s -m 20 -D - -o /dev/null 'https://api.openalex.org/works/W2741809807' | grep -i 'remaining-usd' | grep -iv prepaid | tr -d '\r' | awk '{print $2}')
  echo "budget left: $budget"
  [ "$left" -le 3 ] && break
  sleep $(( 86400 - $(date -u +%s) % 86400 + 300 ))
done
