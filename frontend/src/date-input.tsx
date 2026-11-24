import {useEffect,useRef,useState} from 'react';

const displayDate=(value:string)=>value.split('-').reverse().join('/');
export function DateInput({label,value,min,onChange}:{label:string;value:string;min?:string;onChange:(value:string)=>void}){
 const [text,setText]=useState(displayDate(value)),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{setText(displayDate(value));input.current?.setCustomValidity('');},[value]);
 function edit(next:string){
  setText(next);
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(next);
  const iso=match?`${match[3]}-${match[2]}-${match[1]}`:'';
  const date=new Date(iso+'T12:00:00Z');
  const valid=!!match&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso&&(!min||iso>=min);
  input.current?.setCustomValidity(valid?'':'กรุณากรอกวันที่เป็น วัน/เดือน/ปี (DD/MM/YYYY) และวันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น');
  if(valid)onChange(iso);
 }
 return <span className="ref-date-input"><input ref={input} aria-label={label} type="text" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} required value={text} onChange={e=>edit(e.target.value)}/><span className="ref-calendar-picker"><span aria-hidden="true">▦</span><input aria-label={`ปฏิทิน ${label}`} type="date" value={value} min={min} onChange={e=>{if(e.target.value){setText(displayDate(e.target.value));input.current?.setCustomValidity('');onChange(e.target.value);}}}/></span></span>;
}
