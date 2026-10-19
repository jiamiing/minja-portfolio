export function initInquiry({formConfig,labels,on,signal}){
 const form=document.querySelector('#inquiry-form');if(!form)return()=>{};
 const status=form.querySelector('#form-status'),button=form.querySelector('button[type=submit]'),message=form.querySelector('[name=message]'),counter=form.querySelector('#message-count');
 let busy=false,request=null;
 on(message,'input',()=>counter.textContent=message.value.length);
 function show(text,state){status.hidden=false;status.textContent=text;status.dataset.state=state;}
 on(form,'submit',async event=>{
  event.preventDefault();if(busy)return;if(!form.reportValidity())return;
  const fields=new FormData(form);if(String(fields.get('_honey')||''))return;
  busy=true;button.disabled=true;button.setAttribute('aria-busy','true');button.querySelector('span').textContent=labels.formSending;status.hidden=true;
  request=new AbortController();const timeout=setTimeout(()=>request?.abort('timeout'),20000);
  const payload=Object.fromEntries(fields.entries());payload._replyto=payload.email;payload._subject=`MINJA — ${payload.project_type||'Portfolio inquiry'} / ${payload.name}`;
  try{
   const response=await fetch(formConfig.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:request.signal});
   const data=await response.json();
   const pending=/needs activation|activat.*sent.*email|confirm.*email|verify.*email/i.test(String(data.message||''));
   if(!response.ok||(!(data.success===true||data.success==='true')&&!pending))throw new Error('Submission rejected');
   if(signal.aborted)return;
   show(pending?labels.formPending:labels.formSuccess,pending?'pending':'success');
   if(!pending){form.reset();counter.textContent='0'}
  }catch(error){if(!signal.aborted)show(labels.formError,'error');}
  finally{clearTimeout(timeout);busy=false;if(!signal.aborted){button.disabled=false;button.removeAttribute('aria-busy');button.querySelector('span').textContent=labels.formSend}request=null;}
 });
 return()=>request?.abort('navigation');
}
