import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSubscriptionCapacity, parseSubscriberView, subscriptionOutcome, subscriptionLocaleHref, visibleConfirmation } from '../lib/news/subscription-ui.ts';

const capacity={enabled:true,confirmedCount:250,capacity:250,remaining:0,full:true,dailyLimit:300,weeklyLimit:250};
const subscriber=(status,patch={})=>({status,subscriptionType:'public',locale:'en',topics:'["research"]',token:'a'.repeat(64),...patch});

test('capacity rejection never becomes a successful signup or confirmation',()=>{
  for(const action of ['signup','confirm']) {
    const result=subscriptionOutcome(action,409,{status:'capacity-full',aggregateCapacity:capacity});
    assert.equal(result.kind,'capacity-full');assert.deepEqual(result.capacity,capacity);
    assert.equal(result.subscriber,undefined);
  }
});
test('only an actual confirmed response with a management token completes confirmation',()=>{
  assert.equal(subscriptionOutcome('confirm',200,subscriber('confirmed')).kind,'confirmed');
  assert.equal(subscriptionOutcome('confirm',200,subscriber('pending')).kind,'error');
  assert.equal(subscriptionOutcome('confirm',200,subscriber('confirmed',{token:undefined})).kind,'error');
  assert.equal(subscriptionOutcome('confirm',400,subscriber('confirmed')).kind,'error');
});
test('terminal server states cannot be presented as saved preferences or confirmation',()=>{
  for(const status of ['unsubscribed','suppressed']) for(const action of ['confirm','preferences','unsubscribe']) {
    const result=subscriptionOutcome(action,200,subscriber(status));
    assert.equal(result.kind,status);assert.equal(result.subscriber.status,status);
  }
  assert.equal(subscriptionOutcome('unsubscribe',200,subscriber('confirmed')).kind,'error');
});
test('unconfirmed preferences are refused while confirmed preferences retain server values',()=>{
  const refused=subscriptionOutcome('preferences',200,subscriber('pending'));
  assert.equal(refused.kind,'error');assert.equal(refused.reason,'unconfirmed');
  const saved=subscriptionOutcome('preferences',200,subscriber('confirmed'));
  assert.equal(saved.kind,'preferences-saved');assert.deepEqual(saved.subscriber.topics,['research']);
  assert.equal(saved.subscriber.locale,'en');
});
test('conflicting mutations respect the actual subscriber state instead of claiming success',()=>{
  for(const status of ['unsubscribed','suppressed']) {
    assert.equal(subscriptionOutcome('confirm',409,{status:'confirmation-unavailable',subscriberStatus:status}).kind,status);
    assert.equal(subscriptionOutcome('preferences',409,{status:'preferences-not-saved',subscriberStatus:status}).kind,status);
  }
  assert.equal(subscriptionOutcome('preferences',409,{status:'preferences-not-saved',subscriberStatus:'pending'}).reason,'unconfirmed');
  assert.equal(subscriptionOutcome('preferences',409,{status:'preferences-not-saved',subscriberStatus:'confirmed'}).kind,'error');
});
test('signup receipt is not confirmation and disabled responses are explicit',()=>{
  assert.equal(subscriptionOutcome('signup',200,{status:'check-inbox'}).kind,'check-inbox');
  assert.equal(subscriptionOutcome('signup',200,{status:'pending-activation'}).kind,'unavailable');
  assert.equal(subscriptionOutcome('signup',503,{status:'pending-activation'}).kind,'unavailable');
  assert.equal(subscriptionOutcome('signup',503,{error:'Unavailable'}).kind,'error');
  assert.equal(subscriptionOutcome('signup',200,{status:'confirmed'}).kind,'error');
});
test('server reads must contain recognized status and usable saved preferences',()=>{
  assert.equal(parseSubscriberView(subscriber('unknown')),null);
  assert.equal(parseSubscriberView(subscriber('confirmed',{topics:'broken-json'})),null);
  assert.equal(parseSubscriberView(subscriber('confirmed',{topics:['unknown-topic']})),null);
  assert.equal(parseSubscriptionCapacity({...capacity,remaining:-1}),null);
  assert.equal(parseSubscriptionCapacity({enabled:true}),null);
  assert.deepEqual(parseSubscriberView(subscriber('unsubscribed')).topics,['research']);
});
test('signed subscription identity distinguishes tests from public subscriptions',()=>{
  const result=subscriptionOutcome('confirm',200,subscriber('confirmed',{subscriptionType:'test'}));
  assert.equal(result.kind,'confirmed');assert.equal(result.subscriber.subscriptionType,'test');
  assert.equal(parseSubscriberView(subscriber('confirmed')).subscriptionType,'public');
  for(const subscriptionType of [undefined,'unknown',true])
    assert.equal(subscriptionOutcome('confirm',200,subscriber('confirmed',{subscriptionType})).kind,'error');
});
test('confirmation and management links preserve their capability when switching languages',()=>{
  const id='00000000-0000-4000-8000-000000000001',token='a'.repeat(64);
  for(const action of ['confirm',null]) {
    const query=new URLSearchParams({id,token});if(action)query.set('action',action);
    const href=subscriptionLocaleHref('/en/subscribe','en','zh',query.toString());
    const url=new URL(href,'https://example.test');
    assert.equal(url.pathname,'/zh/subscribe');
    assert.equal(url.searchParams.get('id'),id);assert.equal(url.searchParams.get('token'),token);
    assert.equal(url.searchParams.get('action'),action);
    assert.equal(subscriptionLocaleHref('/zh/subscribe','zh','en',url.searchParams.toString()),`/en/subscribe?${query}`);
  }
});
test('language navigation never carries signed subscription query to another page',()=>{
  const query='id=synthetic-reader&token=synthetic-token&action=confirm&source=synthetic';
  for(const path of ['/en','/en/news','/en/news/example','/en/subscribe/other'])
    assert.equal(subscriptionLocaleHref(path,'en','zh',query),path.replace('/en','/zh'));
  assert.equal(subscriptionLocaleHref('/enough','en','zh',query),'/zh');
  assert.equal(subscriptionLocaleHref(null,'en','zh',query),'/zh');
  assert.equal(subscriptionLocaleHref('/en/subscribe','en','zh','source=synthetic'),'/zh/subscribe');
});
test('automatic confirmation requires its signed action, loaded status and a visible non-prerendered page',()=>{
  assert.equal(visibleConfirmation('confirm',true,'visible'),true);
  assert.equal(visibleConfirmation('confirm',true,'visible',false),true);
  for(const action of [undefined,'read','preferences','unsubscribe','signup'])
    assert.equal(visibleConfirmation(action,true,'visible'),false);
  for(const visibility of ['hidden','prerender',''])
    assert.equal(visibleConfirmation('confirm',true,visibility),false);
  assert.equal(visibleConfirmation('confirm',false,'visible'),false);
  assert.equal(visibleConfirmation('confirm',true,'visible',true),false);
});
