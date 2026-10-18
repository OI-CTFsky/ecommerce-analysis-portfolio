'use strict';
const D=window.CASE_DATA,$=id=>document.getElementById(id),N=n=>Number(n).toLocaleString('zh-CN'),M=n=>(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}),P=(a,b)=>b?(a/b*100).toFixed(2)+'%':'—',S=(a,k)=>a.reduce((t,x)=>t+Number(x[k]||0),0),U=(a,k)=>new Set(a.map(x=>x[k])).size,E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kind=location.pathname.includes('funnel')?'funnel':location.pathname.includes('members')?'members':'refunds';
const inputIds=kind==='funnel'?['channel']:kind==='members'?['segment']:['product','size','channel'];
let selected=[],csvRows=[],page=0,query='';
function groups(a,k){const g={};for(const x of a)(g[x[k]]??=[]).push(x);return Object.entries(g);}
function dt(s){return new Date(s+'T00:00:00Z');}function day(s,k){let d=dt(s);d.setUTCDate(d.getUTCDate()+k);return d.toISOString().slice(0,10);}function age(a,b){return Math.round((dt(b)-dt(a))/86400000);}
function ci(a,b){if(!b)return '—';const z=1.96,p=a/b,w=1+z*z/b,c=(p+z*z/(2*b))/w,h=z*Math.sqrt(p*(1-p)/b+z*z/(4*b*b))/w;return `${((c-h)*100).toFixed(1)}%—${((c+h)*100).toFixed(1)}%`;}
function table(h,r){return '<div class="table-wrap"><table><thead><tr>'+h.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+r.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function cards(rows){return '<div class="kpis">'+rows.map(([a,b,c])=>`<div class="kpi"><span>${a}</span><strong>${b}</strong><small>${c}</small></div>`).join('')+'</div>';}
function panel(title,body,note=''){return `<section class="chart-panel"><h3>${title}</h3>${body}${note?`<p class="note">${note}</p>`:''}</section>`;}
function bars(rows,max,unit=''){return rows.map(([name,val,note,act])=>`<div class="bar-row"><div>${act?`<button class="bar-button" data-filter="${E(act)}">${E(name)}</button>`:E(name)}<small>${note||''}</small></div><div class="bar-track"><i style="width:${max?Math.min(100,val/max*100):0}%"></i></div><div class="bar-value">${unit==='%'?val.toFixed(2):N(val)}${unit}</div></div>`).join('');}
function heat(a,b){return `<span class="heat" style="background:rgba(23,102,81,${b?.08+.68*a/b:.04});color:${b&&a/b>.65?'white':'#19352f'}">${P(a,b)}${b>0&&b<30?'<small> · 小样本</small>':''} <small style="color:inherit">(${N(a)}/${N(b)})</small></span>`;}
function render(){
  const from=$('from').value,to=$('to').value;
  if(!from||!to||from>to){$('filter-error').textContent='请选择有效日期，开始日期不能晚于结束日期。';$('dynamic').innerHTML='';selected=[];csvRows=[];return;}
  $('filter-error').textContent='';
  const field=kind==='funnel'?'cohort':kind==='members'?'first':'day';
  selected=D[kind].filter(x=>x[field]>=from&&x[field]<=to&&inputIds.every(id=>!$(id).value||x[id]===$(id).value));page=0;query='';
  if(!selected.length){$('dynamic').innerHTML='<div class="empty">当前条件下没有样本，请调整筛选。</div>';csvRows=[];return;}
  let out=kind==='funnel'?funnel(selected):kind==='members'?members(selected):refunds(selected);
  $('dynamic').innerHTML=`<p><span class="tag">模拟样本</span> 当前 ${N(selected.length)} ${kind==='refunds'?'支付商品行':'位用户'} · ${from}—${to}</p>`+out+panel(kind==='refunds'?'支付商品行明细':'匿名样本明细',`<label>按匿名编号搜索<input type="search" id="row-search" placeholder="${kind==='funnel'?'例如 F00001':kind==='members'?'例如 M00001':'例如 RO00001'}"></label><div id="sample-table"></div><div class="pager"><button id="prev">上一页</button><span id="page-label"></span><button id="next">下一页</button></div>`)+`<section id="detail"></section>`;
  $('row-search').addEventListener('input',e=>{query=e.target.value.trim().toUpperCase();page=0;rows();});
  $('prev').onclick=()=>{page--;rows();};$('next').onclick=()=>{page++;rows();};rows();
  document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>{$(kind==='funnel'?'channel':kind==='members'?'segment':'product').value=el.dataset.filter;render();});
}
function funnel(a){
  const counts=[a.length,S(a,'cart'),S(a,'order'),S(a,'pay')],labels=['首访浏览','加购','下单','支付'];
  let out=cards([['首访用户',N(a.length),'首访渠道固定归属'],['7天支付用户',N(counts[3]),'完整有序链路'],['首访→支付',P(counts[3],a.length),'整体转化率'],['支付客单价',counts[3]?M(S(a,'amount')/counts[3]):'—','元 / 订单；一位用户最多一单']]);
  out+=panel('7天有序转化漏斗',bars(counts.map((v,i)=>[labels[i],v,i?'相邻转化 '+P(v,counts[i-1]):'起点 100%']),a.length), '每位用户每步最多计1次；先浏览，再加购、下单、支付。首访日到第7日结束，包含跨日行为。');
  const cr=groups(a,'channel').map(([ch,r])=>{const p=S(r,'pay');return [ch,r.length,S(r,'cart'),S(r,'order'),p];});
  csvRows=cr.map(([ch,v,c,o,p])=>({首访渠道:ch,首访UV:v,加购UV:c,下单UV:o,支付UV:p,整体转化率:P(p,v),支付率95区间:ci(p,v)}));
  out+=panel('渠道比较 / 点击渠道下钻',table(['首访渠道','首访UV','加购UV','下单UV','支付UV','首访→支付','Wilson 95%区间'],cr.map(([ch,v,c,o,p])=>[`<button class="drill" data-filter="${E(ch)}">${E(ch)}</button>`,N(v),N(c),N(o),N(p),P(p,v),ci(p,v)])),'区间刻画二项比例抽样不确定性；模拟渠道设定与人群结构仍会影响结果。');
  const cohorts=groups(a,'month').sort().map(([m,r])=>[m,N(r.length),...[1,7,30].map(k=>{const elig=r.filter(x=>day(x.cohort,k)<=D.meta.funnel_asof);return heat(elig.filter(x=>x.active.includes(day(x.cohort,k))).length,elig.length);})]);
  out+=panel('首访队列 / 当天访问留存',table(['首访月份','用户数','D1','D7','D30'],cohorts),'格内为百分比（回访用户/可观察用户）；只统计第k天的view/visit访问，不是k天内累计回访。观察截止2025-07-31，当前所有首访用户窗口完整。');
  return out;
}
function members(a){
  const next=S(a,'next'),th=D.member_thresholds;
  let out=cards([['快照会员',N(a.length),'分层只用6月30日前特征'],['历史净销售',M(S(a,'m')),'元 / 已实现价值'],['次月再购率',P(next,a.length),'7月有有效支付订单'],['次月客均净销售',M(S(a,'next_net')/a.length),'元 / 含未再购会员']]);
  const gs=groups(a,'segment').sort((a,b)=>b[1].length-a[1].length);
  const rr=gs.map(([s,r])=>[s,r.length,S(r,'f'),S(r,'m'),S(r,'next'),S(r,'next_net')]);
  csvRows=rr.map(([s,num,f,m,next,v])=>({快照标签:s,会员数:num,历史有效订单:f,历史净销售元:(m/100).toFixed(2),次月再购会员:next,次月再购率:P(next,num),次月净销售元:(v/100).toFixed(2)}));
  out+=panel('快照分层结构',bars(gs.map(([s,r])=>[s,r.length,'点击查看本层',s]),Math.max(...gs.map(x=>x[1].length))),`阈值固定：R中位数${th.r50}天，F75分位${th.f75}单，M75分位${M(th.m75)}元；匹配优先级见报告。`);
  out+=panel('后续验证 / 次月再购和净销售',table(['标签','会员数','历史净销售/元','次月再购率','再购率95%区间','次月客均净销售/元'],rr.map(([s,num,f,m,next,v])=>[`<button class="drill" data-filter="${E(s)}">${E(s)}</button>`,N(num),M(m),P(next,num),ci(next,num),M(v/num)])),'同一会员可能在7月购买多单，但再购人数只计1次。分层差异不是触达增量效果，客均净销售也不是利润LTV。');
  const cohort=groups(a,'month').sort().map(([mo,r])=>[mo,N(r.length),...[30,60].map(k=>{const elig=r.filter(x=>day(x.first,k)<=D.meta.funnel_asof);const yes=elig.filter(x=>x.purchases.some(d=>d>x.first&&d<=day(x.first,k))).length;return heat(yes,elig.length);})]);
  out+=panel('样本内首购队列 / 30与60天内二购',table(['首购月份','快照会员数','D30累计二购','D60累计二购'],cohort),'每格只纳入截至7月31日已完整观察该窗口的会员，显示（已二购/成熟会员）。二购为首购后另一自然日的有效购买；同日多单不算本队列二购，RFM的F仍按去重订单。');
  return out;
}
function refunds(a){
  const req=S(a,'apply'),ok=a.filter(x=>x.status==='退款成功').length,ref=S(a,'refund'),paid=S(a,'paid'),orders=U(a,'order'),rqorders=U(a.filter(x=>x.apply),'order');
  let out=cards([['商品行申请率',P(req,a.length),`${N(req)} / ${N(a.length)} 支付商品行`],['商品行成功退款率',P(ok,a.length),`${N(ok)} 行退款成功`],['退款金额率',P(ref,paid),`${M(ref)} / ${M(paid)} 元`],['范围内订单申请率',P(rqorders,orders),`${N(rqorders)} / ${N(orders)} 笔订单`]]);
  const gs=groups(a,'product'),pr=gs.map(([p,r])=>[p,r.length,S(r,'apply'),r.filter(x=>x.status==='退款成功').length,S(r,'refund'),S(r,'paid')]).sort((x,y)=>y[4]-x[4]);
  csvRows=pr.map(([p,num,r,ok,rf,pd])=>({商品:p,支付商品行:num,申请商品行:r,成功商品行:ok,申请率:P(r,num),成功退款率:P(ok,num),支付金额元:(pd/100).toFixed(2),退款金额元:(rf/100).toFixed(2),退款金额率:P(rf,pd)}));
  out+=panel('商品对比 / 先核查比例与金额的组合',table(['商品','支付商品行','申请率','成功退款率','申请率95%区间','成功退款额/元','金额率'],pr.map(([p,num,r,ok,rf,pd])=>[`<button class="drill" data-filter="${E(p)}">${E(p)}</button>`,N(num),P(r,num),P(ok,num),ci(r,num),M(rf),P(rf,pd)])),'订单指标仅覆盖筛选命中的商品行：同订单的其他未命中商品不进入本范围。商品行概率相关性可能使普通二项区间偏窄，区间仅作描述。');
  const reasons=groups(a.filter(x=>x.apply),'category').sort((x,y)=>y[1].length-x[1].length);
  out+=panel('申请原因构成 / 分母为申请商品行',bars(reasons.map(([c,r])=>[c,r.length,`占申请 ${P(r.length,req)}`]),Math.max(1,...reasons.map(x=>x[1].length))),'来自模拟用户填报的单一主理由；分类是归因线索，不等于已证实原因。');
  out+=panel('尺码与处理状态',table(['尺码','支付商品行','申请商品行','申请率','退款金额/元'],groups(a,'size').sort().map(([s,r])=>[s,N(r.length),N(S(r,'apply')),P(S(r,'apply'),r.length),M(S(r,'refund'))]))+table(['最新状态','商品行数','占申请'],['退款成功','申请关闭','处理中'].map(s=>[s,N(a.filter(x=>x.status===s).length),P(a.filter(x=>x.status===s).length,req)])),`申请转成功率 ${P(ok,req)}；成功退款平均耗时 ${ok?(S(a.filter(x=>x.status==='退款成功'),'days')/ok).toFixed(1):'—'} 天。未完成申请不进入完成时长均值；快照为2025-08-31。`);
  return out;
}
function rows(){
  const a=selected.filter(x=>x.id.includes(query));const count=Math.max(1,Math.ceil(a.length/12));page=Math.max(0,Math.min(page,count-1));
  const slice=a.slice(page*12,page*12+12),btn=x=>`<button class="drill" data-id="${E(x.id)}">${E(x.id)}</button>`;
  if(kind==='funnel')$('sample-table').innerHTML=table(['匿名用户','首访日','首访渠道','加购','下单','支付'],slice.map(x=>[btn(x),x.cohort,x.channel,x.cart?'是':'否',x.order?'是':'否',x.pay?'是':'否']));
  if(kind==='members')$('sample-table').innerHTML=table(['匿名会员','快照分层','R/天','F/单','M/元','次月再购'],slice.map(x=>[btn(x),x.segment,x.r,x.f,M(x.m),x.next?'是':'否']));
  if(kind==='refunds')$('sample-table').innerHTML=table(['商品行ID','支付日','商品 / 尺码','最新售后状态','用户主理由','退款/元'],slice.map(x=>[btn(x),x.day,x.product+' / '+x.size,x.status,x.reason||'—',M(x.refund)]));
  $('page-label').textContent=`${N(a.length)}条 · 第${page+1}/${count}页`;$('prev').disabled=page===0;$('next').disabled=page>=count-1;
  document.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>drill(el.dataset.id));
}
function drill(id){
  const x=selected.find(x=>x.id===id);let body='';
  if(kind==='funnel')body=table(['字段','值'],[['首访日 / 渠道',x.cohort+' / '+x.channel],['7天有序步骤',`浏览 → ${x.cart?'加购':'未加购'} → ${x.order?'下单':'未下单'} → ${x.pay?'支付':'未支付'}`],['支付金额/元',M(x.amount)],['访问日期',x.active.join('、')],['复核方式','下载事件CSV，按此匿名用户筛选；时间带UTC+8时区']]);
  if(kind==='members')body=table(['字段','值'],[['6月30日快照标签',x.segment],['样本内首笔快照有效支付',x.first],['R / F / M',`${x.r}天 / ${x.f}单 / ${M(x.m)}元`],['7月有效订单 / 净销售',`${x.next_orders}单 / ${M(x.next_net)}元`],['截至7月31日有效购买日期',x.purchases.join('、')],['边界','已实现净销售不扣商品成本或触达费用，不等于利润LTV']]);
  if(kind==='refunds')body=table(['字段','值'],[['订单 / 商品行',x.order+' / '+x.id],['商品 / 尺码 / 来源',`${x.product} / ${x.size} / ${x.channel}`],['支付日 / 金额',`${x.day} / ${M(x.paid)}元`],['申请日 / 完成日',`${x.request_day||'—'} / ${x.finish_day||'—'}`],['最新状态 / 主理由',`${x.status} / ${x.reason||'—'}`],['成功退款金额',M(x.refund)+'元'],['原因归类',x.category||'无申请'],['边界','每个商品行在本演示最多一个售后请求；关闭申请不计成功退款']]);
  $('detail').innerHTML=panel(`匿名样本档案 / ${E(id)}`,body);$('detail').scrollIntoView({behavior:'smooth',block:'start'});
}
function exportCSV(){if(!csvRows.length){$('filter-error').textContent='当前无可导出的样本。';return;}const ks=Object.keys(csvRows[0]),quote=v=>'"'+String(v).replace(/"/g,'""')+'"';const content='\ufeff'+[ks.map(quote).join(','),...csvRows.map(x=>ks.map(k=>quote(x[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`模拟案例_${kind}_${$('from').value}_${$('to').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('filters').addEventListener('submit',e=>e.preventDefault());$('filters').addEventListener('change',render);$('filters').addEventListener('reset',()=>setTimeout(render,0));$('export').onclick=exportCSV;render();
