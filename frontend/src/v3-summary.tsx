import {useCallback,useEffect,useState} from 'react';
import {useApp} from './context';
import {useV2} from './v2-api';
import {fmt,rows,type Row} from './model';

const priorities=[{code:'P1',name:'Critical',color:'#d13438',text:'#b42318'},{code:'P2',name:'High',color:'#f08c2e',text:'#b45309'},{code:'P3',name:'Medium',color:'#e0ae1f',text:'#8a6a00'},{code:'P4',name:'Low',color:'#3ba55c',text:'#1e7b3c'}];
export function bangkokDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function dateLabel(value:string){return new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function PriorityTile({priority,from,to,onCount}:{priority:typeof priorities[number];from:string;to:string;onCount:(code:string,count:number|null)=>void}){
 const {state,dispatch}=useApp(),selected=state.filters.severity,excluded=!!selected&&selected!==priority.name,q=useV2('live',{dateFrom:from,dateTo:to,priority:priority.code},!excluded),h=rows(q.data,'headline')[0],value=excluded?0:h?.Opened;
 useEffect(()=>onCount(priority.code,value==null?null:Number(value)),[priority.code,value,onCount]);
 return <div className="v3-priority-cell"><button className="v3-priority-tile" style={{borderLeftColor:priority.color}} disabled={q.isPending&&!excluded||!!q.error} title={q.error?.message||`${priority.name} · ${from} – ${to}`} onClick={()=>dispatch({type:'DRILL',body:{tab:null,dateFrom:from,dateTo:to,dateBasis:'OPENED',priority:priority.code}})}><strong style={{color:priority.text}}>{excluded?'0':q.error?'—':value==null?'…':fmt(value)}</strong><span>{priority.name}</span></button>{q.error&&<small role="alert">{q.error.message}<button type="button" onClick={()=>q.refetch()}>ลองอีกครั้ง</button></small>}</div>;
}
function Summary({title,from,to,headline,today=false}:{title:string;from:string;to:string;headline?:Row;today?:boolean}){
 const [counts,setCounts]=useState<Record<string,number|null>>({}),onCount=useCallback((code:string,count:number|null)=>setCounts(old=>old[code]===count?old:{...old,[code]:count}),[]),complete=priorities.every(p=>counts[p.code]!=null),missing=complete&&headline?.Opened!=null?Number(headline.Opened)-priorities.reduce((n,p)=>n+Number(counts[p.code]),0):0;
 return <section className={'v3-summary-card'+(today?' v3-today':'')} aria-label={today?'Today summary':'Selected period severity summary'}><div className="v3-summary-heading"><h2>{title}</h2><p><strong>{headline?.Opened==null?'…':fmt(headline.Opened)}</strong> jobs opened{today?' today':''}</p></div><div className="v3-priority-row">{priorities.map(priority=><PriorityTile key={priority.code} priority={priority} from={from} to={to} onCount={onCount}/>)}</div>{missing>0&&<small className="v3-unclassified">รวม Job ที่ยังไม่ระบุ Priority {fmt(missing)} งาน</small>}</section>;
}
export function V3Summary({headline}:{headline:Row}){
 const {state}=useApp(),day=bangkokDay(),today=useV2('live',{dateFrom:day,dateTo:day}),todayHeadline=rows(today.data,'headline')[0],f=state.filters;
 return <div className="v3-summary-grid"><Summary title={`Today · ${dateLabel(day)}`} from={day} to={day} headline={todayHeadline} today/><Summary title={`Jobs by severity · ${dateLabel(f.dateFrom)} – ${dateLabel(f.dateTo)}`} from={f.dateFrom} to={f.dateTo} headline={headline}/>{today.error&&<p className="api-error" role="alert">{today.error.message} <button onClick={()=>today.refetch()}>ลองอีกครั้ง</button></p>}</div>;
}
