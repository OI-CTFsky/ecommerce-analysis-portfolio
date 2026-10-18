"""Independently reconcile CSV + SQLite calculations to browser datasets.
Run after reproduce.py: python verify.py. Uses only Python standard library.
"""
import csv,json,re,sqlite3
from pathlib import Path
from collections import defaultdict
R=Path(__file__).resolve().parent
D=json.loads((R/'demo-data.js').read_text(encoding='utf-8').removeprefix('window.CASE_DATA=').removesuffix(';'))
db=sqlite3.connect(':memory:')
ints={'amount_cents','paid_cents','refund_cents','paid','refund','apply','days'}
for name in ['funnel-events','member-orders','refund-items','refund-status-history']:
    rows=list(csv.DictReader((R/(name+'.csv')).open(encoding='utf-8-sig',newline='')))
    keys=list(rows[0]);tb=name.replace('-','_')
    db.execute(f'CREATE TABLE {tb} ('+','.join('"'+k+'" '+('INTEGER' if k in ints else 'TEXT') for k in keys)+')')
    db.executemany(f'INSERT INTO {tb} VALUES ('+','.join('?' for k in keys)+')',[[int(row[k]) if k in ints else row[k] for k in keys] for row in rows])
queries=dict(re.findall(r'-- QUERY: (\w+)\s*\n(.*?)(?=\n-- QUERY:|\Z)',(R/'analysis.sql').read_text(encoding='utf-8'),re.S))
expected={}
g=defaultdict(list)
for x in D['funnel']:g[x['channel']].append(x)
expected['funnel']=sorted((k,len(v),sum(x['cart'] for x in v),sum(x['order'] for x in v),sum(x['pay'] for x in v)) for k,v in g.items())
g=defaultdict(list)
for x in D['members']:g[x['segment']].append(x)
expected['members']=sorted((k,len(v),sum(x['f'] for x in v),sum(x['m'] for x in v),sum(x['next'] for x in v),sum(x['next_net'] for x in v)) for k,v in g.items())
g=defaultdict(list)
for x in D['refunds']:g[x['product']].append(x)
expected['refunds']=sorted((k,len(v),sum(x['apply'] for x in v),sum(x['status']=='退款成功' for x in v),sum(x['paid'] for x in v),sum(x['refund'] for x in v)) for k,v in g.items())
from datetime import date,timedelta
ret=[]
for mo in sorted({x['month'] for x in D['funnel']}):
    for k in [1,7,30]:
        a=[x for x in D['funnel'] if x['month']==mo and date.fromisoformat(x['cohort'])+timedelta(days=k)<=date(2025,7,31)]
        ret.append((mo,k,len(a),sum((date.fromisoformat(x['cohort'])+timedelta(days=k)).isoformat() in x['active'] for x in a)))
expected['retention']=ret
for name,sql in queries.items():
    actual=db.execute(sql).fetchall();assert actual==expected[name],(name,actual,expected[name]);print(name+': CSV / SQL / browser data reconciled')
assert len({x['id'] for x in D['members']})==len(D['members'])
assert all(x['pay']<=x['order']<=x['cart'] for x in D['funnel'])
assert sum(x['apply'] for x in D['refunds'])>=sum(x['status']=='退款成功' for x in D['refunds'])
print('All reconciliations passed. No business impact claims are validated by these synthetic samples.')
