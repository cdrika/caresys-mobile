export class ApiError extends Error {
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}

export function createClient(base,getToken,fetcher=fetch){
  const url=new URL(base);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname.replace(/\/$/,'')!=='/mobile/v1')throw new Error('Configure an HTTPS mobile API URL ending in /mobile/v1.');
  const root=base.replace(/\/$/,'');
  return {url:path=>root+path,async request(path,{method='GET',body,anonymous=false,pdf=false}={}){
    if(!path.startsWith('/')||path.includes('..')||path.includes('?')||path.includes('#'))throw new Error('Invalid API path.');
    const headers={Accept:pdf?'application/pdf':'application/json'};
    if(!anonymous){const token=await getToken();if(!token)throw new ApiError(401,'TOKEN_EXPIRED','Your mobile session expired. Pair your device again.');headers.Authorization='Bearer '+token;}
    if(body!==undefined)headers['Content-Type']='application/json';
    const response=await fetcher(root+path,{method,headers,credentials:'omit',redirect:'error',...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw new ApiError(response.status,error.error?.code||'REQUEST_FAILED',error.error?.message||'Request could not complete.');}
    if(pdf){if(!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('Unexpected invoice format.');return new Uint8Array(await response.arrayBuffer());}
    return (await response.json()).data;
  }};
}

export function accessPresentation(status,now=Date.now()){
  if(!status)return {locked:true,message:'Loading agency access…'};
  const deadline=status.state==='trial'?status.trial_ends_at:status.state==='paid'?status.paid_until:null;
  const expires=deadline?Date.parse(deadline.replace(' ','T').replace(/Z$/,'')+'Z'):null;
  const expired=expires!==null&&expires<=now;
  const locked=status.locked||expired;
  return {locked,message:locked?(status.owner?'Agency access requires setup or owner-approved payment.':'This agency account is locked. Contact your agency owner.'):(status.state==='trial'?'Your free trial is active. No payment is collected during the trial.':'Agency access is available.')};
}

export function estimate(catalog,modules,workers,preference='custom'){
  const required=new Set(['people',...modules]);
  for(const key of required)for(const dependency of catalog.dependencies[key]||[])required.add(dependency);
  const priority=key=>key===preference?0:key==='custom'?2:1;
  return Object.entries(catalog.packages).map(([key,p])=>({key,label:p.label,total:p.base_cents+[...required].filter(m=>!p.modules.includes(m)).reduce((sum,m)=>sum+catalog.module_cents[m],0)+Math.max(0,workers-p.included_workers)*catalog.extra_worker_cents})).sort((a,b)=>a.total-b.total||priority(a.key)-priority(b.key))[0];
}
