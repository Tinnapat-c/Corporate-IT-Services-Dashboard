import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {transformWithOxc} from 'vite';
const root=new URL('../',import.meta.url),generated=new URL('.test-build/',root);await mkdir(generated,{recursive:true});
for(const file of ['model.ts','context.tsx','api.ts']){
 let source=await readFile(new URL('src/'+file,root),'utf8');
 source=source.replaceAll("from './model'","from './model.mjs'");
 if(file==='api.ts')source=source.replace("import fields from './fields.json';",'const fields='+await readFile(new URL('src/fields.json',root),'utf8')+';');
 const result=await transformWithOxc(source,file);await writeFile(new URL(file.replace(/\.tsx?$/,'.mjs'),generated),result.code);
}
const {defaults,ticketBody,symptoms}=await import(new URL('model.mjs',generated));
const {initialState,reducer}=await import(new URL('context.mjs',generated));
const {api,requestBody}=await import(new URL('api.mjs',generated));
const filters={...defaults(),dateField:'ANY'},admin={IsAdmin:true},requester={DataScope:'REQUESTER'};
assert.equal(ticketBody(filters,admin).scope,'ALL');assert.equal(ticketBody({...filters,scope:'ALL'},requester).scope,'TEAM');
assert.equal(ticketBody(filters,admin).dateFrom,null);assert.equal(ticketBody(filters,admin,{},2).pageSize,50);
const closed=ticketBody(filters,admin,{dateField:'CLOSED',dateFrom:'2026-10-22',dateTo:'2026-10-22',status:'FAILURE',sortBy:'NET_DESC'});
assert.equal(closed.dateFrom,'2026-10-22');assert.equal(closed.dateField,'CLOSED');assert.equal(closed.status,'FAILURE');
assert.deepEqual(requestBody('live-ops',{viewerAD:'override',serviceGroup:'Application',scope:'TEAM',status:'ALL'}),{serviceGroup:'Application',scope:'TEAM'});
let state=reducer({...initialState,filters:{...defaults(),ticketKind:''}}, {type:'DRILL',body:{dateFrom:null,dateTo:null,status:'OPEN'}});
assert.equal(state.filters.dateField,'ANY');state=reducer(state,{type:'BACK'});assert.equal(state.filters.dateField,'CREATED');
state=reducer(initialState,{type:'DRILL',body:{severity:'High'}});state=reducer(state,{type:'DRILL',body:{severity:null}});assert.equal(state.filters.severity,'');
state=reducer(initialState,{type:'DRILL_SERVICE',service:'Windows'});state=reducer(state,{type:'DRILL',body:{serviceName:'Windows',serviceSymptom:'Update'}});state=reducer(state,{type:'BACK'});assert.equal(state.view.service,'Windows');
state=reducer(initialState,{type:'JOB',page:'JOB_DETAIL',row:{JobNo:'JO-1',TicketKind:'INC'},context:[]});state=reducer(state,{type:'NAV',page:'LIVE'});assert.equal(state.filters.ticketKind,'','Job identity must not silently filter subsequent pages');
const summary=symptoms([{TicketNo:'SAME',JobNo:'1',ServiceSymptom:'A',CloseAt:'date',NetBizHrs:2,SlaStatus:'Meet SLA',ReopenCount:0},{TicketNo:'SAME',JobNo:'2',ServiceSymptom:'A',CloseAt:'date',NetBizHrs:8,SlaStatus:'Failure',ReopenCount:1}]);
assert.equal(summary[0].Jobs,2);assert.equal(summary[0].MedianNetHrs,5);assert.equal(summary[0].SlaBreachPct,50);assert.equal(summary[0].Reopened,1);
let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert(url.startsWith('/api/dashboard/'));assert.equal(options.credentials,'same-origin');return {ok:true,status:200,json:async()=>({ResultCode:'S',ResultData:{header:[]}})};};
const controller=new AbortController();controller.abort();await assert.rejects(api('live-ops',{},controller.signal),e=>e.name==='AbortError');assert.equal(calls,0);
await assert.rejects(api('job-detail',{jobNo:'missing'}),e=>e.status===404);assert.equal(calls,1);
console.log('PASS: scope, dates, paging, schema whitelist, back navigation, Severity toggle, Service context, Job identity, Job grain, median, rate denominator, abort and missing Job');

assert.deepEqual(requestBody('v2/job-list',{scope:'ALL',tab:'ALL'}),{scope:'ALL',tab:null});
let personSource=await readFile(new URL('src/person-data.ts',root),'utf8');
personSource=personSource.replaceAll("from './model'","from './model.mjs'");
await writeFile(new URL('person-data.mjs',generated),(await transformWithOxc(personSource,'person-data.ts')).code);
const {personRows,personSteps,summarizePersonJobs}=await import(new URL('person-data.mjs',generated));
const personJobs=[{SupportID:'A',TicketNo:'SAME',JobNo:'1',StatusGroupV2:'Completed',Priority:'P1'},{SupportID:'A',TicketNo:'SAME',JobNo:'2',StatusGroupV2:'In progress',Priority:null},{SupportID:'B',TicketNo:'OTHER',JobNo:'3',StatusGroupV2:'Completed',Priority:'P2'}];
assert.equal(personRows(personJobs,'A').length,2);
assert.deepEqual(summarizePersonJobs(personRows(personJobs,'A')).priority,[{Name:'P1',Jobs:1},{Name:'Unspecified',Jobs:1}]);
assert.deepEqual(personSteps([{SupportID:'A',StepName:'Ack',AvgHrs:2,Jobs:1},{SupportID:'A',StepName:'Ack',AvgHrs:4,Jobs:3},{SupportID:'B',StepName:'Ack',AvgHrs:100,Jobs:3},{SupportID:'A',StepName:'Missing',AvgHrs:null,Jobs:10}],'A'),[{StepName:'Ack',AvgHrs:3.5,Jobs:4}]);
console.log('PASS: V2 all-status contract; person isolation; Job grain; missing priority; weighted checklist hours without invented values');

let hourlySource=await readFile(new URL('src/hourly-chart.tsx',root),'utf8');
hourlySource=hourlySource.replaceAll("from './model'","from './model.mjs'");
await writeFile(new URL('hourly-chart.mjs',generated),(await transformWithOxc(hourlySource,'hourly-chart.tsx')).code);
const {hourlySeries}=await import(new URL('hourly-chart.mjs',generated));
const hourly=hourlySeries([{Hour:8,INC:3,REQ:1},{Hour:9,INC:2,REQ:2},{Hour:10,INC:0,REQ:0}]);
assert.equal(hourly.total,8);assert.equal(hourly.hours.length,24);assert.equal(hourly.hours[8].pct,50);assert.equal(hourly.hours[9].pct,50);assert.equal(hourly.hours[10].pct,0);assert.equal(hourly.hours.reduce((n,h)=>n+h.pct,0),100);
assert(hourlySeries([]).hours.every(h=>h.pct===0));
console.log('PASS: hourly percentage uses all-hour total; zero hours remain zero; no per-hour 100% normalization');

let chartLayoutSource=await readFile(new URL('src/chart-layout.ts',root),'utf8');
await writeFile(new URL('chart-layout.mjs',generated),(await transformWithOxc(chartLayoutSource,'chart-layout.ts')).code);
const {shortChartTick,chartTickIndices,chartDomain}=await import(new URL('chart-layout.mjs',generated));
assert.equal(shortChartTick('2026-11-11'),'11/11');assert.equal(shortChartTick('11-05'),'05/11');
for(const length of [0,1,2,11,365]){const indices=chartTickIndices(length,260);assert(indices.length<=5);if(length){assert.equal(indices[0],0);assert.equal(indices.at(-1),length-1);assert.equal(new Set(indices).size,indices.length);}}
const axis=chartDomain([0,7,39]);assert(axis.min<=0&&axis.max>=39);assert(axis.ticks.every(Number.isFinite));assert(chartDomain([-3,9]).min<=-3);
console.log('PASS: compact dates, responsive sparse tick selection, endpoints, finite chart axes including negative values');
