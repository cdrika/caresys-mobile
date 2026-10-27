import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient,accessPresentation,estimate} from '../src/client.mjs';

test('authenticated API requests omit cookies and keep tokens out of URLs',async()=>{
  let call;const client=createClient('https://api.example/mobile/v1',()=> 'secret',async(url,options)=>{call={url,options};return {ok:true,json:async()=>({data:{ok:true}})};});
  assert.deepEqual(await client.request('/agencies/a/billing',{method:'POST',body:{confirm:'yes'}}),{ok:true});
  assert.equal(call.options.credentials,'omit');assert.equal(call.options.redirect,'error');assert.equal(call.options.headers.Authorization,'Bearer secret');assert.ok(!call.url.includes('secret'));
});
test('plain HTTP and expired credentials are rejected',async()=>{
  assert.throws(()=>createClient('http://api.example/mobile/v1',()=>null));
  await assert.rejects(createClient('https://api.example/mobile/v1',()=>null).request('/me/agencies'),error=>error.status===401);
});
test('trial locks exactly at deadline, with a generic member notice',()=>{
  const state={state:'trial',locked:false,owner:false,trial_ends_at:'2026-11-27 12:00:00'};
  assert.equal(accessPresentation(state,Date.parse('2026-11-27T11:59:59Z')).locked,false);
  assert.equal(accessPresentation(state,Date.parse('2026-11-27T12:00:00Z')).locked,true);
  assert.match(accessPresentation(state,Date.parse('2026-11-27T12:00:00Z')).message,/Contact your agency owner/);
});
test('required dependencies are included once in estimate',()=>{
  const catalog={dependencies:{scheduling:['people','care']},module_cents:{people:0,scheduling:2500,care:1500},extra_worker_cents:300,packages:{custom:{label:'Custom',base_cents:2900,included_workers:10,modules:['people']}}};
  assert.equal(estimate(catalog,['scheduling','care'],10).total,6900);
});
