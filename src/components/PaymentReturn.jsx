import React,{useEffect,useState,useRef} from 'react';
import {CheckCircle2,LoaderCircle,ArrowRight} from 'lucide-react';
import {supabase} from '../lib/supabase.js';
import {Link} from '../App.jsx';
import {money} from '../lib/commerce.js';
export default function PaymentReturn({done}) {
  const [receipt,setReceipt]=useState(null),[error,setError]=useState(''),[polling,setPolling]=useState(true);
  const clear=useRef(done);clear.current=done;
  const sid=new URLSearchParams(location.search).get('session_id');
  useEffect(()=>{let active=true,timer,count=0;const check=async()=>{try{
    if(!sid)throw new Error('Липсва идентификатор на плащането.');
    const {data,error}=await supabase.functions.invoke('create-checkout',{body:{action:'status',session_id:sid}});
    if(error||data?.error)throw new Error('Статусът не се зареди. Опитай отново след малко.');
    if(!active)return;setReceipt(data);
    if(data.payment_status==='paid'){
      clear.current();try{sessionStorage.removeItem('therride-checkout-draft');sessionStorage.removeItem('therride-checkout-attempt');}catch{}
      setPolling(false);return;
    }
    if(['failed','expired','refunded'].includes(data.payment_status)||++count>=20){setPolling(false);return;}
    timer=setTimeout(check,2000);
  }catch(e){if(active){setError(e.message);setPolling(false);}}};check();return()=>{active=false;clearTimeout(timer);};},[sid]);
  const paid=receipt?.payment_status==='paid';
  return <section className="checkout-success section-shell">{paid?<CheckCircle2 size={58}/>:polling?<LoaderCircle className="spin" size={48}/>:null}<span className="eyebrow">THERRIDE / ТВОЯТА ПОРЪЧКА</span><h1>{paid?'Плащането е потвърдено.':polling?'Проверяваме плащането…':'Проверка на плащането'}</h1>{receipt?.order_number&&<p>Поръчка <strong>{receipt.order_number}</strong>{receipt.total_cents!=null&&' · '+money(receipt.total_cents)}</p>}{paid?<p>Поръчката е записана. Следва подготовката за следващото ти каране.</p>:<p>{error||(['failed','expired'].includes(receipt?.payment_status)?'Този опит за плащане е неуспешен или изтекъл.':'Още очакваме окончателното потвърждение от Stripe. Не прави повторна поръчка, ако плащането вече е прието.')}</p>}{!paid&&!polling&&<button className="button button-outline" onClick={()=>location.reload()}>Обнови статуса</button>}<Link to={paid?'/shop':'/info/contact'} className="button">{paid?'Обратно към каталога':'Свържи се с нас'}<ArrowRight size={18}/></Link></section>;
}
