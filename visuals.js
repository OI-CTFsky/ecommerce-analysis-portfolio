/* Dependency-free, accessible SVG visuals shared by the three customer cases. */
window.Viz=(()=>{
 const palette=['#176651','#4a83ac','#ba8b35','#a65c51','#80966a'],esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:1});
 const wrap=(name,s)=>`<div class="svg-frame"><svg role="img" aria-label="${esc(name)}" viewBox="0 0 780 350">${s}</svg></div>`;
 const legend=names=>'<div class="viz-legend">'+names.map((n,i)=>`<span><i style="background:${palette[i%5]}"></i>${esc(n)}</span>`).join('')+'</div>';
 function funnel(labels,values){let s='';const max=Math.max(1,...values);
  values.forEach((v,i)=>{const y=22+i*76,w=620*v/max,wn=i===values.length-1?w:620*values[i+1]/max,x=390-w/2,xn=390-wn/2;
   s+=`<polygon points="${x},${y} ${x+w},${y} ${xn+wn},${y+55} ${xn},${y+55}" fill="${palette[i%5]}" opacity=".92"><title>${esc(labels[i])}：${num(v)}人</title></polygon><text x="15" y="${y+25}" class="axis-label">${esc(labels[i])}</text><text x="${Math.max(390,x+w+14)}" y="${y+31}" text-anchor="${w>400?'middle':'start'}" fill="${w>400?'white':'#19352f'}" font-size="17" font-weight="600">${num(v)}人</text>`;
   if(i<values.length-1)s+=`<text x="758" y="${y+54}" text-anchor="end" class="axis-label">下一步 ${(v?values[i+1]/v*100:0).toFixed(1)}%</text>`;
  });return wrap('有序用户转化漏斗',s);
 }
 function lines(labels,series,unit='%'){
  const vals=series.flatMap(x=>x.values.filter(x=>x!==null)),max=Math.max(1,...vals)*1.15,X=i=>65+i*655/Math.max(1,labels.length-1),Y=v=>295-v/max*245;
  let s='';for(let j=0;j<=4;j++){const v=max*j/4,y=Y(v);s+=`<line x1="65" x2="735" y1="${y}" y2="${y}" stroke="#e1e8de"/><text x="54" y="${y+4}" text-anchor="end" class="axis-label">${num(v)}${unit}</text>`;}
  labels.forEach((l,i)=>s+=`<text x="${X(i)}" y="322" text-anchor="middle" class="axis-label">${esc(l)}</text>`);
  series.forEach((r,j)=>{let d='';r.values.forEach((v,i)=>{if(v===null)return;d+=(d?' L':'M')+X(i)+' '+Y(v);});s+=`<path d="${d}" fill="none" stroke="${palette[j%5]}" stroke-width="3"/>`;r.values.forEach((v,i)=>{if(v!==null)s+=`<circle cx="${X(i)}" cy="${Y(v)}" r="5" fill="${palette[j%5]}"><title>${esc(r.name)} / ${esc(labels[i])}：${num(v)}${unit}</title></circle>`;});});
  return wrap('按月份比较指标趋势',s)+legend(series.map(x=>x.name));
 }
 function donut(rows){const total=rows.reduce((s,x)=>s+x.value,0),r=102,c=2*Math.PI*r;let off=0,s='';rows.forEach((x,i)=>{const len=total?x.value/total*c:0;s+=`<circle cx="235" cy="173" r="${r}" fill="none" stroke="${palette[i%5]}" stroke-width="47" stroke-dasharray="${len} ${c-len}" stroke-dashoffset="${-off}" transform="rotate(-90 235 173)"><title>${esc(x.name)}：${num(x.value)}，${total?(x.value/total*100).toFixed(1):0}%</title></circle>`;off+=len;s+=`<rect x="430" y="${65+i*45}" width="11" height="11" rx="2" fill="${palette[i%5]}"/><text x="452" y="${76+i*45}" class="axis-label">${esc(x.name)}</text><text x="735" y="${76+i*45}" text-anchor="end" class="axis-label">${num(x.value)} · ${total?(x.value/total*100).toFixed(1):0}%</text>`;});s+=`<text x="235" y="170" text-anchor="middle" font-size="31" fill="#19352f">${num(total)}</text><text x="235" y="198" text-anchor="middle" class="axis-label">当前样本</text>`;return wrap('分组数量与构成比例',s);}
 function scatter(rows){const names=[...new Set(rows.map(x=>x.segment))],xm=Math.max(1,...rows.map(x=>x.r)),ym=Math.max(1,...rows.map(x=>x.m/100)),X=v=>65+v/xm*650,Y=v=>285-v/ym*235;let s='';
  for(let i=0;i<=4;i++){const y=285-i*235/4;s+=`<line x1="65" x2="720" y1="${y}" y2="${y}" stroke="#e1e8de"/><text x="55" y="${y+4}" text-anchor="end" class="axis-label">${num(ym*i/4)}</text><text x="${65+i*650/4}" y="307" text-anchor="middle" class="axis-label">${num(xm*i/4)}</text>`;}
  const stride=Math.max(1,Math.ceil(rows.length/600));rows.filter((_,i)=>i%stride===0).forEach(x=>s+=`<circle class="viz-point" tabindex="0" role="button" aria-label="查看会员${esc(x.id)}" data-id="${esc(x.id)}" cx="${X(x.r)}" cy="${Y(x.m/100)}" r="${Math.min(10,3+Math.sqrt(x.f))}" fill="${palette[names.indexOf(x.segment)%5]}" opacity=".68"><title>${esc(x.id)} / ${esc(x.segment)}：R=${x.r}天，F=${x.f}单，净销售${num(x.m/100)}元</title></circle>`);
  s+='<text x="390" y="340" text-anchor="middle" class="axis-label">购买近度 R / 天（越小越近期）</text><text x="65" y="20" class="axis-label">历史净销售 M / 元 · 点大小为 F</text>';return wrap('会员RFM分层散点，点击查看会员',s)+legend(names)+'<p class="note">散点等间隔抽样最多600位用于展示；所有卡片、汇总与导出仍使用完整筛选样本。</p>';
 }
 function compare(rows){const max=Math.max(1,...rows.flatMap(x=>[x.a,x.b])),W=570;let s='';rows.forEach((x,i)=>{const y=35+i*56;s+=`<text x="8" y="${y+15}" class="axis-label">${esc(x.name)}</text><rect x="145" y="${y}" width="${x.a/max*W}" height="13" rx="3" fill="${palette[0]}"><title>${esc(x.name)} / 申请率 ${num(x.a)}%</title></rect><rect x="145" y="${y+18}" width="${x.b/max*W}" height="13" rx="3" fill="${palette[1]}"><title>${esc(x.name)} / 成功退款率 ${num(x.b)}%</title></rect><text x="745" y="${y+12}" text-anchor="end" class="axis-label">${num(x.a)}%</text><text x="745" y="${y+30}" text-anchor="end" class="axis-label">${num(x.b)}%</text>`;});return wrap('商品申请率与成功退款率对比',s)+legend(['申请率','成功退款率']);}
 return {funnel,lines,donut,scatter,compare};
})();
