import {useState} from 'react';
import {fmt,type Row} from './model';

export function hourlySeries(data:Row[]){
 const hours=Array.from({length:24},(_,hour)=>({hour,incident:0,request:0,total:0,pct:0}));
 for(const r of data){const hour=Number(r.Hour);if(!Number.isInteger(hour)||hour<0||hour>23)continue;hours[hour].incident+=Math.max(0,Number(r.INC)||0);hours[hour].request+=Math.max(0,Number(r.REQ)||0);}
 const total=hours.reduce((sum,h)=>sum+h.incident+h.request,0);
 for(const h of hours){h.total=h.incident+h.request;h.pct=total?h.total/total*100:0;}
 return {hours,total};
}

export function HourlyChart({data,percent,onDrill}:{data:Row[];percent:boolean;onDrill:(hour:number,kind?:string)=>void}){
 const {hours,total}=hourlySeries(data),[active,setActive]=useState<number|null>(null),chosen=active==null?null:hours[active],largest=Math.max(0,...hours.map(h=>percent?h.pct:h.total)),step=percent?(largest<20?1:5):Math.max(1,10**Math.floor(Math.log10(Math.max(1,largest/4)))),maximum=Math.max(step*4,Math.ceil(largest/(step*4))*step*4),hourName=(hour:number)=>String(hour).padStart(2,'0')+':00',detail=(h:typeof hours[number])=>`${hourName(h.hour)} · Incident ${fmt(h.incident)} · Request ${fmt(h.request)} · รวม ${fmt(h.total)} Jobs (${fmt(h.pct)}% ของทั้งหมด)`;
 return <div className="ref-hourly"><p className="ref-hour-readout" aria-live="polite">{chosen?detail(chosen):`รวม ${fmt(total)} Jobs · ${percent?'% เทียบกับ Job ทุกชั่วโมงรวมกัน':'จำนวน Job แยกตามชั่วโมง'}`}</p><div className="ref-hour-scroll"><div className="ref-hour-canvas"><div className="ref-hour-axis" aria-hidden="true">{[0,1,2,3,4].map(i=><span key={i} style={{bottom:i*25+'%'}}>{fmt(maximum*i/4)}{percent?'%':''}</span>)}</div><div className="ref-hour-plot"><div className="ref-hour-grid" aria-hidden="true">{[0,1,2,3,4].map(i=><i key={i} style={{bottom:i*25+'%'}}/>)}</div>{hours.map(h=>{const value=percent?h.pct:h.total;return <div className="ref-hour-column" key={h.hour} onMouseEnter={()=>setActive(h.hour)} title={detail(h)}><div className="ref-hour-space"><div className="ref-hour-stack" style={{height:(value/maximum*100)+'%'}}>{!percent&&h.total>0&&<strong className="ref-hour-total">{fmt(h.total)}</strong>}<button disabled={!h.total} style={{height:'100%',background:h.total===Math.max(...hours.map(v=>v.total))?'#0078d4':'#b8c2d0'}} title={detail(h)} aria-label={`${hourName(h.hour)}: ${fmt(h.total)} Jobs · ${fmt(h.pct)}% ของทั้งหมด`} onFocus={()=>setActive(h.hour)} onClick={()=>onDrill(h.hour)}/></div></div><button className="ref-column-label ref-hour-label" disabled={!h.total} title={detail(h)} onFocus={()=>setActive(h.hour)} onClick={()=>onDrill(h.hour)}>{String(h.hour).padStart(2,'0')}</button></div>;})}</div></div></div><p className="ref-hour-hint">ชั่วโมง (00–23) · ชี้ที่แท่งเพื่อดูจำนวนและเปอร์เซ็นต์ · คลิกเพื่อดู Job</p></div>;
}
