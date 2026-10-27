import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Alert,AppState,Button,Linking,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import {File,Paths} from 'expo-file-system';
import {createClient,accessPresentation,estimate} from './src/client.mjs';

const API=process.env.EXPO_PUBLIC_CARESYS_API_URL||'';
const WEB=process.env.EXPO_PUBLIC_CARESYS_WEB_URL||'';
const key=()=>Crypto.randomUUID().replaceAll('-','');
const confirm=(title,message)=>new Promise(resolve=>Alert.alert(title,message,[{text:'Cancel',style:'cancel',onPress:()=>resolve(false)},{text:'I agree',onPress:()=>resolve(true)}],{cancelable:false}));
const money=cents=>'USD '+(cents/100).toFixed(2);

export default function App(){
  const [auth,setAuth]=useState(null),authRef=useRef(null);
  const [pair,setPair]=useState(null),[agencies,setAgencies]=useState([]),[agency,setAgency]=useState(null);
  const [status,setStatus]=useState(null),[catalog,setCatalog]=useState(null),[modules,setModules]=useState(['people']);
  const [workers,setWorkers]=useState(10),[level,setLevel]=useState('custom'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [pending,setPending]=useState(null),[clock,setClock]=useState(Date.now());
  const quoteKey=useRef(key()),checkoutKey=useRef(key()),selectedAgency=useRef(null);
  const client=useMemo(()=>{try{return createClient(API,()=>authRef.current?.expires>Date.now()?authRef.current.token:null);}catch{return null;}},[]);
  const storageKey=useMemo(()=>'caresys-'+API.replace(/[^a-zA-Z0-9]/g,'_'),[]);
  const loadStatus=async(ref=selectedAgency.current)=>{
    if(!ref||!client)return;
    const value=await client.request(`/agencies/${ref}/billing`);
    if(selectedAgency.current!==ref)return;
    setStatus(value);
    if(value.owner){const c=await client.request(`/agencies/${ref}/billing/catalog`);if(selectedAgency.current===ref)setCatalog(c);}
  };
  const fail=async error=>{
    setMessage(error.message||'Please retry.');
    if(error.status===401){authRef.current=null;setAuth(null);setAgency(null);setStatus(null);setAgencies([]);await SecureStore.deleteItemAsync(storageKey);}
    if(error.status===402)await loadStatus().catch(()=>{});
  };
  const run=async work=>{if(busy)return;setBusy(true);setMessage('');try{await work();}catch(error){await fail(error);}finally{setBusy(false);}};
  const savePending=async value=>{setPending(value);if(value)await SecureStore.setItemAsync(storageKey+'-checkout',JSON.stringify(value));else await SecureStore.deleteItemAsync(storageKey+'-checkout');};

  useEffect(()=>{
    if(!client)return;
    let live=true;
    (async()=>{
      const saved=await SecureStore.getItemAsync(storageKey);
      if(saved){const value=JSON.parse(saved);if(value.expires>Date.now()&&live){authRef.current=value;setAuth(value);}else await SecureStore.deleteItemAsync(storageKey);}
      const checkout=await SecureStore.getItemAsync(storageKey+'-checkout');if(checkout&&live)setPending(JSON.parse(checkout));
    })().catch(error=>{if(live)setMessage(error.message);});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{
    if(!auth||!client)return;
    client.request('/me/agencies').then(setAgencies).catch(fail);
  },[auth]);
  useEffect(()=>{
    selectedAgency.current=agency;setStatus(null);setCatalog(null);quoteKey.current=key();checkoutKey.current=key();
    if(agency)loadStatus(agency).catch(fail);
  },[agency]);
  useEffect(()=>{
    if(status?.current_selection){setModules(status.current_selection.modules);setWorkers(status.current_selection.worker_count);setLevel(status.current_selection.service_level);}
  },[status?.invoice_ref]);
  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),1000);
    const foreground=AppState.addEventListener('change',state=>{if(state==='active'&&authRef.current)loadStatus().catch(fail);});
    const refresh=setInterval(()=>{if(authRef.current&&selectedAgency.current)loadStatus().catch(fail);},60000);
    return()=>{clearInterval(timer);clearInterval(refresh);foreground.remove();};
  },[]);
  useEffect(()=>{
    if(auth&&auth.expires<=clock){authRef.current=null;setAuth(null);setAgency(null);setStatus(null);setMessage('Your mobile session expired. Pair again to continue.');SecureStore.deleteItemAsync(storageKey).catch(()=>{});}
  },[clock,auth]);
  useEffect(()=>{
    if(!pair||!client)return;
    let checking=false,live=true;
    const timer=setInterval(async()=>{
      if(checking)return;
      if(Date.now()>=pair.expires){setPair(null);setMessage('Pairing code expired. Request a new code.');return;}
      checking=true;
      try{
        const result=await client.request('/pairing/token',{method:'POST',anonymous:true,body:{device_code:pair.device_code}});
        if(!live)return;
        const value={token:result.access_token,expires:Date.now()+result.expires_in*1000};
        await SecureStore.setItemAsync(storageKey,JSON.stringify(value));authRef.current=value;setAuth(value);setPair(null);
      }catch(error){if(error.status!==428&&live){setMessage(error.message);if(error.status===400)setPair(null);}}finally{checking=false;}
    },5000);
    return()=>{live=false;clearInterval(timer);};
  },[pair]);

  const checkout=purpose=>run(async()=>{
    const invoice=status.invoices?.find(i=>i.ref===status.invoice_ref);
    const terms=purpose==='setup'?`Save your card securely with Stripe. Your ${status.trial_days}-day free trial starts after card verification and module selection. No subscription charge is made during the trial. After it ends, an agency owner must approve payment. Your bank may show a temporary card verification authorization.`:`Approve proceeding to payment for ${invoice?.invoice_no}: ${money(invoice?.total_cents||0)} before any tax shown by Stripe. Successful payment unlocks agency access for 30 days. No automatic renewal.`;
    if(!await confirm(purpose==='setup'?'Secure card setup':'Approve agency payment',terms))return;
    const result=await client.request(`/agencies/${agency}/billing/checkout/${purpose}`,{method:'POST',body:{request_key:checkoutKey.current,confirm:'yes',...(purpose==='payment'?{invoice_ref:status.invoice_ref}:{})}});
    if(!result.url.startsWith('https://checkout.stripe.com/'))throw new Error('Invalid secure checkout URL.');
    await savePending({agency,ref:result.ref,purpose});
    await WebBrowser.openBrowserAsync(result.url);
    setMessage('After completing Stripe checkout, tap Verify completed checkout.');
  });
  const verify=()=>run(async()=>{
    await client.request(`/agencies/${pending.agency}/billing/checkouts/${pending.ref}/complete`,{method:'POST',body:{}});
    await savePending(null);checkoutKey.current=key();await loadStatus();setMessage('Stripe checkout verified.');
  });
  const download=invoice=>run(async()=>{
    const bytes=await client.request(`/agencies/${agency}/billing/invoices/${invoice.ref}/download`,{pdf:true});
    if(!await Sharing.isAvailableAsync())throw new Error('Sharing PDFs is unavailable on this device.');
    const file=new File(Paths.cache,invoice.ref+'.pdf');
    try{file.create({overwrite:true});file.write(bytes);await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',dialogTitle:'Save or share your CareSys invoice'});}finally{if(file.exists)file.delete();}
  });
  const presentation=accessPresentation(status,clock);
  const selectionChanged=()=>{quoteKey.current=key();};
  const subtotal=catalog&&modules.length?estimate(catalog,modules,workers,level):null;
  const currentInvoice=status?.invoices?.find(i=>i.ref===status.invoice_ref);
  const webValid=(()=>{try{return new URL(WEB).protocol==='https:';}catch{return false;}})();

  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.brand}>CareSys</Text><Text style={styles.subtitle}>Your agency, connected.</Text>
    {!client||!webValid?<Text accessibilityRole="alert">Configure trusted HTTPS API and web URLs in the mobile environment before running this app.</Text>:<>
    {!!message&&<Text style={styles.notice} accessibilityRole="alert">{message}</Text>}
    {!auth?<View style={styles.card}><Text style={styles.heading}>Connect your mobile device</Text><Text>Pair this device through your signed-in CareSys web account. Mobile sessions last 15 minutes.</Text>
      {pair?<><Text selectable style={styles.code}>{pair.user_code}</Text><Text>Approve this code in your browser. Waiting for approval…</Text><Button title="Open browser pairing" onPress={()=>Linking.openURL(WEB.replace(/\/$/,'')+'/mobile-enrollment')}/></>:<Button disabled={busy} title="Get pairing code" onPress={()=>run(async()=>{const result=await client.request('/pairing/requests',{method:'POST',anonymous:true,body:{device_name:'CareSys mobile'}});setPair({...result,expires:Date.now()+result.expires_in*1000});})}/>}
    </View>:<>
      <Text style={styles.label}>Agency workspace</Text><Picker enabled={!busy} selectedValue={agency} onValueChange={setAgency}><Picker.Item label="Choose an agency" value={null}/>{agencies.map(a=><Picker.Item key={a.ref} label={a.name} value={a.ref}/>)}</Picker>
      {agencies.length===0&&<Text>No agency memberships found. Register an agency in the web application.</Text>}
      {agency&&<View style={styles.card}><Text style={styles.heading}>{status?.owner?'Subscription & free trial':presentation.locked?'Agency account locked':'Agency account'}</Text><Text style={presentation.locked?styles.notice:styles.body}>{presentation.message}</Text>
      {status?.owner&&<>
        <Text>{status.notice}</Text>{!!status.trial_ends_at&&<Text>Free trial ends: {status.trial_ends_at} UTC</Text>}{!!status.paid_until&&<Text>Paid access ends: {status.paid_until} UTC</Text>}
        {!status.stripe_configured&&<Text style={styles.notice}>Stripe setup is awaiting platform configuration.</Text>}
        {!status.card_verified?<Button title="Save card securely with Stripe" disabled={busy||!status.stripe_configured} onPress={()=>checkout('setup')}/>:<>
          <Text style={styles.label}>Verified {status.card_brand} card ending {status.card_last4}</Text>
          <Text style={styles.heading}>Choose your modules</Text>
          {catalog&&Object.entries(catalog.module_labels).map(([id,label])=><Pressable key={id} disabled={busy} accessibilityRole="checkbox" accessibilityState={{checked:modules.includes(id)}} style={styles.option} onPress={()=>{setModules(modules.includes(id)?modules.filter(m=>m!==id):[...modules,id]);selectionChanged();}}><Text style={styles.label}>{modules.includes(id)?'☑':'☐'} {label}</Text><Text>{catalog.module_descriptions[id]}</Text></Pressable>)}
          <Text style={styles.label}>Preferred package (lowest price is selected)</Text><Picker enabled={!busy} selectedValue={level} onValueChange={v=>{setLevel(v);selectionChanged();}}>{catalog&&Object.entries(catalog.packages).map(([id,p])=><Picker.Item key={id} value={id} label={p.label}/>)}</Picker>
          <Text style={styles.label}>Workers to cover</Text><Picker enabled={!busy} selectedValue={workers} onValueChange={v=>{setWorkers(v);selectionChanged();}}>{Array.from({length:1000},(_,i)=><Picker.Item key={i+1} value={i+1} label={String(i+1)}/>)}</Picker>
          {subtotal&&<Text style={styles.label}>Estimated {money(subtotal.total)}/month before tax — {subtotal.label}</Text>}
          <Button title="Issue module invoice" disabled={busy||!modules.length} onPress={()=>run(async()=>{await client.request(`/agencies/${agency}/billing/invoices`,{method:'POST',body:{modules,worker_count:workers,service_level:level,request_key:quoteKey.current}});quoteKey.current=key();await loadStatus();setMessage('Invoice issued. Your agency access status is shown above.');})}/>
          {presentation.locked&&status.state==='payment_required'&&currentInvoice?.state==='issued'&&<Button disabled={busy||!status.stripe_configured} title={`Approve payment: ${money(currentInvoice.total_cents)} before tax`} onPress={()=>checkout('payment')}/>}
          {status.invoices?.map(invoice=><View key={invoice.ref} style={styles.option}><Text style={styles.label}>{invoice.invoice_no}</Text><Text>{money(Number(invoice.total_cents))}/month · {invoice.state==='paid'?'Paid':'Pro forma'}</Text><Button title="Download / share PDF" disabled={busy} onPress={()=>download(invoice)}/></View>)}
        </>}
        {pending?.agency===agency&&<Button disabled={busy} title="Verify completed checkout" onPress={verify}/>}
      </>}
      <Button title="Refresh access status" disabled={busy} onPress={()=>run(()=>loadStatus())}/></View>}
      <Button title="Sign out of mobile" disabled={busy} onPress={()=>run(async()=>{await client.request('/auth/token',{method:'DELETE'}).catch(()=>{});authRef.current=null;setAuth(null);setAgency(null);setStatus(null);setAgencies([]);await SecureStore.deleteItemAsync(storageKey);})}/>
    </>}
    </>}
  </ScrollView></SafeAreaView>;
}

const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#f3f7f5'},content:{padding:24,paddingBottom:60,gap:14},brand:{fontSize:32,fontWeight:'700',color:'#117a70'},subtitle:{fontSize:16,color:'#536d70'},card:{backgroundColor:'#fff',borderRadius:18,padding:20,gap:16,borderWidth:1,borderColor:'#dbe6e1'},heading:{fontSize:21,fontWeight:'700',color:'#173b40'},label:{fontSize:15,fontWeight:'600',color:'#173b40'},body:{fontSize:15,lineHeight:23},notice:{padding:14,backgroundColor:'#fff2df',color:'#644516',borderRadius:10,lineHeight:22},code:{fontSize:26,fontWeight:'700',letterSpacing:2},option:{paddingVertical:14,borderBottomWidth:1,borderColor:'#dbe6e1',gap:6}});
