"""Generate deterministic, entirely synthetic interview cases. Python 3 standard library only.
Run: python reproduce.py. Outputs CSV files and demo-data.js beside this script.
All currency fields use integer CNY cents. No real users or businesses are represented.
"""
import csv, json, random, math
from datetime import date, timedelta
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parent
RNG = random.Random(20261018)
def ds(d): return d.isoformat()
def csvout(name, rows):
    with (ROOT/name).open('w', newline='', encoding='utf-8-sig') as f:
        w=csv.DictWriter(f, fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def pctile(v,q):
    a=sorted(v);return a[min(len(a)-1, math.ceil(q*len(a))-1)]

# Independent case A: first-visit cohorts and ordered, 7-day conversion funnel.
events=[]; people=[]; eid=0
start=date(2025,1,1)
def event(uid,day,kind,channel,amount=0):
    global eid
    eid+=1
    hour={'view':9,'cart':10,'order':11,'pay':12,'visit':13}[kind]
    events.append(dict(event_id=f'E{eid:06}',user_id=uid,event_day=ds(day),event_time=f'{ds(day)}T{hour:02}:00:{eid%60:02}+08:00',event_type=kind,channel=channel,amount_cents=amount))
for i in range(6000):
    uid=f'F{i+1:05}';d=start+timedelta(days=RNG.randrange(181))
    ch=RNG.choices(['自然推荐','站内搜索','付费投放'],[.36,.25,.39])[0]
    cartp,payp,retp={'自然推荐':(.52,.65,.31),'站内搜索':(.67,.78,.39),'付费投放':(.42,.56,.22)}[ch]
    event(uid,d,'view',ch)
    for _ in range(RNG.randrange(1,5)):event(uid,d,'view',ch)
    cart=RNG.random()<cartp;order=cart and RNG.random()<.74;pay=order and RNG.random()<payp
    cd=d+timedelta(days=RNG.randrange(0,2));od=cd+timedelta(days=RNG.randrange(0,3));pd=od+timedelta(days=RNG.randrange(0,3))
    if cart:event(uid,cd,'cart',ch)
    if order:event(uid,od,'order',ch)
    amount=RNG.choice([9900,15900,23900,39900,59900]) if pay else 0
    if pay:event(uid,pd,'pay',ch,amount)
    active={ds(d)}
    for lag in [1,7,14,30]:
        if RNG.random()<retp*({1:1,7:.69,14:.52,30:.40}[lag]):
            active.add(ds(d+timedelta(days=lag)));event(uid,d+timedelta(days=lag),'visit',ch)
    people.append(dict(id=uid,cohort=ds(d),month=ds(d)[:7],channel=ch,cart=int(cart),order=int(order),pay=int(pay),amount=amount,active=sorted(active)))
raw=events+events[:30]+[dict(event_id=f'BAD{i}',user_id='',event_day='2025-01-01',event_time='2025-01-01T09:00:00+08:00',event_type='view',channel='自然推荐',amount_cents=0) for i in range(20)]
seen=set();clean=[]
for row in raw:
    if not row['user_id'] or row['event_id'] in seen:continue
    seen.add(row['event_id']);clean.append(row)
assert len(clean)==len(events)
grouped=defaultdict(list)
for e in clean:grouped[e['user_id']].append(e)
derived=[]
for uid,es in grouped.items():
    es.sort(key=lambda e:e['event_time']);v=next(e for e in es if e['event_type']=='view');d=date.fromisoformat(v['event_day']);limit=d+timedelta(days=7)
    last=v['event_time'];flags=[];amount=0
    for kind in ['cart','order','pay']:
        found=next((e for e in es if e['event_type']==kind and last is not None and e['event_time']>=last and date.fromisoformat(e['event_day'])<=limit),None)
        flags.append(int(found is not None));last=found['event_time'] if found else None
        if kind=='pay' and found:amount=found['amount_cents']
    derived.append(dict(id=uid,cohort=ds(d),month=ds(d)[:7],channel=v['channel'],cart=flags[0],order=flags[1],pay=flags[2],amount=amount,active=sorted({e['event_day'] for e in es if e['event_type'] in ['view','visit']})))
assert sorted(derived,key=lambda x:x['id'])==people
people=derived
assert all(x['pay']<=x['order']<=x['cart'] for x in people)
csvout('funnel-events.csv',clean)

# Independent case B: snapshot features precede the July validation window.
orders=[];memberrows=[];oid=0;snapshot=date(2025,6,30);cutoff=date(2025,7,31)
for i in range(1800):
    uid=f'M{i+1:05}';first=start+timedelta(days=RNG.randrange(181));days={first}
    latent=RNG.choices([.004,.012,.026],[.45,.36,.19])[0]
    for j in range(1,(cutoff-first).days+1):
        if RNG.random()<latent:days.add(first+timedelta(days=j))
    for day in sorted(days):
        oid+=1;paid=RNG.choice([8900,12900,19900,29900,49900,69900]);refund=0;rd=''
        if RNG.random()<.09:
            rday=day+timedelta(days=RNG.randrange(3,22))
            if rday<=cutoff:refund=paid if RNG.random()<.45 else paid//2;rd=ds(rday)
        orders.append(dict(order_id=f'MO{oid:06}',member_id=uid,paid_day=ds(day),paid_cents=paid,refund_day=rd,refund_cents=refund))
by=defaultdict(list)
for o in orders:by[o['member_id']].append(o)
for uid,os in by.items():
    def net(o,at):return o['paid_cents']-(o['refund_cents'] if o['refund_day'] and o['refund_day']<=ds(at) else 0)
    hist=[o for o in os if o['paid_day']<=ds(snapshot) and net(o,snapshot)>0]
    future=[o for o in os if ds(snapshot)<o['paid_day']<=ds(cutoff) and net(o,cutoff)>0]
    if not hist:continue
    first=min(o['paid_day'] for o in hist);r=(snapshot-date.fromisoformat(max(o['paid_day'] for o in hist))).days
    # Fixed-origin realized value: only payments/refunds observed by snapshot.
    memberrows.append(dict(id=uid,first=first,month=first[:7],r=r,f=len(hist),m=sum(net(o,snapshot) for o in hist),next=int(bool(future)),next_orders=len(future),next_net=sum(net(o,cutoff) for o in future),purchases=sorted(o['paid_day'] for o in os if net(o,cutoff)>0)))
r50=pctile([m['r'] for m in memberrows],.5);f75=pctile([m['f'] for m in memberrows],.75);m75=pctile([m['m'] for m in memberrows],.75)
for m in memberrows:
    if m['r']<=r50 and m['f']>=f75 and m['m']>=m75:s='高价值活跃'
    elif m['r']>r50 and m['f']>=f75:s='高频沉睡待核查'
    elif m['r']<=r50 and m['f']==1:s='近期首购待培育'
    elif m['r']>r50 and m['f']==1:s='首购后沉默'
    else:s='常规维护'
    m['segment']=s
assert all(o['paid_day']>'2025-06-30' for os in by.values() for o in os if o['paid_day'].startswith('2025-07'))
csvout('member-orders.csv',orders)

# Independent case C: one row per paid order item, requests within 30 days.
items=[];history=[];products={'轻量外套':24900,'徒步长裤':19900,'防晒上衣':15900,'日常运动鞋':29900,'保暖内搭':12900}
reasonmap={'尺码偏小':'尺码适配','尺码偏大':'尺码适配','色差与预期不符':'信息预期','面料触感不符':'信息预期','开线或破损':'质量问题','到货延迟':'履约问题','改变购买计划':'主观选择'}
for i in range(4000):
    paid_day=date(2025,6,1)+timedelta(days=RNG.randrange(45));orderid=f'RO{i+1:05}'
    for j in range(1 if RNG.random()<.75 else 2):
        p=RNG.choice(list(products));size=RNG.choice(['S','M','L','XL']);ch=RNG.choice(['内容引流','店铺搜索','会员回访']);paid=products[p]*RNG.choice([9,10])//10
        prob=.10+(.095 if p=='徒步长裤' else 0)+(.06 if size=='S' else 0)+(.035 if ch=='内容引流' else 0)
        apply=RNG.random()<prob;status='无申请';reason='';req='';finished='';ref=0;elapsed=0
        itemid=f'{orderid}-{j+1}'
        if apply:
            reason=RNG.choices(list(reasonmap),[32 if p=='徒步长裤' else 16,15,14,13,12,7,12])[0]
            status=RNG.choices(['退款成功','申请关闭','处理中'],[.85,.10,.05])[0]
            rday=paid_day+timedelta(days=RNG.randrange(1,31));req=ds(rday)
            history.append(dict(request_id=f'A{itemid}',item_id=itemid,status_day=req,status='已申请',refund_cents=0))
            if status!='处理中':
                elapsed=RNG.randrange(2,13);finished=ds(rday+timedelta(days=elapsed))
                if status=='退款成功':ref=paid if RNG.random()<.88 else paid//2
                history.append(dict(request_id=f'A{itemid}',item_id=itemid,status_day=finished,status=status,refund_cents=ref))
        items.append(dict(id=itemid,order=orderid,day=ds(paid_day),product=p,size=size,channel=ch,paid=paid,apply=int(apply),status=status,reason=reason,category=reasonmap.get(reason,''),request_day=req,finish_day=finished,refund=ref,days=elapsed))
assert max(x['day'] for x in items)<='2025-07-15'
assert all(0<=x['refund']<=x['paid'] for x in items)
csvout('refund-items.csv',[{**x} for x in items]);csvout('refund-status-history.csv',history)

DATA=dict(meta=dict(seed=20261018,synthetic=True,generated='2026-10-18',funnel_asof='2025-07-31',member_snapshot='2025-06-30',member_validation='2025-07-01—2025-07-31',refund_asof='2025-08-31',raw_events=len(raw),clean_events=len(clean),duplicate_events=30,invalid_events=20),funnel=people,members=memberrows,member_thresholds=dict(r50=r50,f75=f75,m75=m75,excluded=1800-len(memberrows)),refunds=items)
(ROOT/'demo-data.js').write_text('window.CASE_DATA='+json.dumps(DATA,ensure_ascii=False,separators=(',',':'))+';',encoding='utf-8')
(ROOT/'validation.json').write_text(json.dumps(dict(synthetic=True,funnel_users=len(people),raw_events=len(raw),clean_events=len(clean),paid_users=sum(x['pay'] for x in people),members=len(memberrows),orders=len(orders),thresholds=DATA['member_thresholds'],paid_items=len(items),paid_orders=len({x['order'] for x in items}),requested_items=sum(x['apply'] for x in items),successful_items=sum(x['status']=='退款成功' for x in items),paid_cents=sum(x['paid'] for x in items),refund_cents=sum(x['refund'] for x in items)),ensure_ascii=False,indent=2),encoding='utf-8')
print('Synthetic cases generated; consistency assertions passed.')
