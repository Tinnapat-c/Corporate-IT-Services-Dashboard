import {str,type Row} from './model';

// Keep person identity at Job grain; repeated TicketNo values are separate Jobs.
export function personRows(data:Row[],supportID:string){return data.filter(r=>str(r.SupportID)===supportID);}
export function summarizePersonJobs(data:Row[]){
 const counts=(key:string)=>[...data.reduce((map,r)=>{const name=str(r[key])||'Unspecified';map.set(name,(map.get(name)||0)+1);return map;},new Map<string,number>())].map(([name,Jobs])=>({Name:name,Jobs})).sort((a,b)=>b.Jobs-a.Jobs);
 return {status:counts('StatusGroupV2'),priority:counts('Priority')};
}
export function personSteps(data:Row[],supportID:string){
 const groups=new Map<string,{hours:number;jobs:number}>();
 for(const r of personRows(data,supportID)){
  if(typeof r.AvgHrs!=='number'||typeof r.Jobs!=='number'||r.Jobs<=0)continue;
  const name=str(r.StepName)||'Unspecified',item=groups.get(name)||{hours:0,jobs:0};
  item.hours+=r.AvgHrs*r.Jobs;item.jobs+=r.Jobs;groups.set(name,item);
 }
 return [...groups].map(([StepName,r])=>({StepName,AvgHrs:r.hours/r.jobs,Jobs:r.jobs}));
}
