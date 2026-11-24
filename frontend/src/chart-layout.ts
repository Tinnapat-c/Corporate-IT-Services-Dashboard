export function shortChartTick(value:string){
 const date=value.match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(date)return `${date[3]}/${date[2]}`;
 const monthDay=value.match(/^(\d{2})-(\d{2})$/);
 if(monthDay)return `${monthDay[2]}/${monthDay[1]}`;
 return value.length>15?value.slice(0,13)+'…':value;
}
export function weekChartTick(value:string){const d=new Date(value.slice(0,10)+'T12:00:00Z');if(!Number.isFinite(+d))return shortChartTick(value);d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const start=Date.UTC(d.getUTCFullYear(),0,1);return 'W'+Math.ceil(((+d-start)/86400000+1)/7);}
export function chartTickIndices(length:number,width:number,labelWidth=82){
 if(length<=0)return [];
 const count=Math.min(length,Math.max(2,Math.floor(width/labelWidth)+1));
 if(count===1)return [0];
 return [...new Set(Array.from({length:count},(_,i)=>Math.round(i*(length-1)/(count-1))))];
}
export function chartDomain(values:number[]){
 const valid=values.filter(Number.isFinite),low=Math.min(0,...valid),high=Math.max(1,...valid),raw=(high-low)/4,unit=10**Math.floor(Math.log10(raw)),step=([1,2,2.5,5,10].find(n=>n>=raw/unit)||10)*unit;
 const min=Math.floor(low/step)*step,max=Math.ceil(high/step)*step;
 return {min,max,ticks:Array.from({length:Math.round((max-min)/step)+1},(_,i)=>Number((min+i*step).toPrecision(12)))};
}
