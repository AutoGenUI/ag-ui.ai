import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import * as nodeModule from 'node:module';
import { newsSchema, canonicalUrl, singaporeDay, hmac } from '../lib/news/core.ts';
import { articles, upsertNews, seedDatabase, seed, freshness } from '../lib/news/store.ts';
import { operate } from '../lib/news/operations.ts';
import { recordMetric, statsSummary } from '../lib/news/analytics.ts';
import { drainQueue, mailWebhook, manageSubscription, queueDigest, subscribe, tokenFor, mailTest, mailTestReady, mailCapacity, DAILY_EMAIL_LIMIT, WEEKLY_EMAIL_LIMIT, PUBLIC_SUBSCRIBER_CAPACITY } from '../lib/news/mail.ts';
function database(){const raw=new DatabaseSync(':memory:');
  // Cloudflare D1 limits LIKE/GLOB patterns to 50 bytes; desktop SQLite's
  // default is much larger. Enforce the actual LIKE limit in every fixture.
  raw.function('like',(pattern,value)=>{
    if(Buffer.byteLength(pattern,'utf8')>50) throw new Error('LIKE or GLOB pattern too complex');
    if(value===null) return null;
    const escaped=[...pattern].map(char=>char==='%'?'.*':char==='_'?'.':char.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
    return new RegExp(`^${escaped}$`,'is').test(value)?1:0;
  });
  for(const entry of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8')).entries)raw.exec(readFileSync(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),'utf8'));const db={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return raw.prepare(sql).get(...args)||null},async all(){return {results:raw.prepare(sql).all(...args)}},_run(){return raw.prepare(sql).run(...args)},async run(){return {meta:this._run()}}}},async batch(statements){raw.exec('BEGIN');try{const r=statements.map(s=>({meta:s._run()}));raw.exec('COMMIT');return r;}catch(e){raw.exec('ROLLBACK');throw e;}}};return db;}
const config={enabled:false,apiKey:'',sender:'',secret:'',webhookSecret:''};
const active={enabled:true,apiKey:'test-only',sender:'test@example.test',secret:'test-only-not-production',webhookSecret:'test-only-webhook'};
const acceptance={...active,enabled:false,domainVerified:true,testRecipient:'acceptance@example.test'};
const publicInput=(email,patch={})=>({email,locale:'zh',topics:['product'],consent:true,website:'',...patch});
const decodeHtml=value=>value.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
const confirmationLink=mail=>new URL(decodeHtml(mail.htmlContent.match(/href="([^"]+action=confirm[^"]+)"/)[1]));
const confirmFromMail=(db,mail)=>{const link=confirmationLink(mail);return manageSubscription(db,{id:link.searchParams.get('id'),token:link.searchParams.get('token'),action:'confirm'},active);};
async function mockedMail(run,respond=()=>Response.json({messageId:'fixture-provider-message'})) {
  const original=globalThis.fetch,sent=[];
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.brevo.com/v3/smtp/email');sent.push(JSON.parse(options.body));return respond(sent.length);};
  try {await run(sent);} finally {globalThis.fetch=original;}
}
async function pendingPublicFixture(db,label,expires,deliveryStatus='submitted',patch={}) {
  const s={id:crypto.randomUUID(),email:`fixture-${label}@example.test`,locale:'zh',topics:'["product"]',status:'pending',created_at:'2000-01-01T00:00:00.000Z',token_expires:expires,is_test:0,...patch};
  await db.prepare('INSERT INTO subscribers(id,email,locale,topics,status,created_at,token_expires,is_test) VALUES(?,?,?,?,?,?,?,?)')
    .bind(s.id,s.email,s.locale,s.topics,s.status,s.created_at,s.token_expires,s.is_test).run();
  const deliveryId=`confirm:${s.id}:fixture-legacy-day`;
  if(deliveryStatus) await db.prepare("INSERT INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at,attempted_at,is_test) VALUES(?,?,'confirmation',?,?,?,?,?)")
    .bind(deliveryId,s.id,deliveryStatus,s.created_at,s.created_at,s.created_at,s.is_test).run();
  return {...s,deliveryId};
}
async function capacityFixture(db,count,is_test=0,label='capacity') {
  const now=new Date().toISOString(),expires=new Date(Date.now()+86400000).toISOString(),rows=[];
  const statements=[];
  for(let index=0;index<count;index++) {
    const s={id:crypto.randomUUID(),email:`fixture-${label}-${index}@example.test`,locale:'zh',topics:'["product"]',status:'confirmed',created_at:now,token_expires:expires,is_test};rows.push(s);
    statements.push(db.prepare("INSERT INTO subscribers(id,email,locale,topics,status,created_at,confirmed_at,token_expires,is_test) VALUES(?,?,?,?,'confirmed',?,?,?,?)").bind(s.id,s.email,s.locale,s.topics,now,now,expires,is_test));
  }
  if(statements.length) await db.batch(statements);
  return rows;
}
test('public capacity aggregates confirmed production subscribers only without personal fields',async()=>{
  const db=database();await capacityFixture(db,2);await capacityFixture(db,5,1,'capacity-test');
  for(const status of ['pending','suppressed','unsubscribed']) await pendingPublicFixture(db,`capacity-${status}`,new Date(Date.now()+86400000).toISOString(),null,{status});
  const summary=await mailCapacity(db,active);
  assert.deepEqual(summary,{enabled:true,confirmedCount:2,capacity:PUBLIC_SUBSCRIBER_CAPACITY,remaining:248,full:false,dailyLimit:DAILY_EMAIL_LIMIT,weeklyLimit:WEEKLY_EMAIL_LIMIT});
  assert.doesNotMatch(JSON.stringify(summary),/example\.test|token|email|subscriber_id/);
  assert.equal((await mailCapacity(db,config)).enabled,false);
  const dashboard=await operate(db,'dashboard',{},active);
  for(const key of Object.keys(summary)) assert.equal(dashboard.email[key],summary[key]);
});
test('public confirmation from the generated email claims one place and reports its subscription type',async()=>{
  for(const locale of ['zh','en']) {
    const db=database();
    await mockedMail(async sent=>{
      const signup=await subscribe(db,publicInput(`fixture-two-step-${locale}@example.test`,{locale}),active,`fixture-two-step-${locale}`);
      assert.equal(signup.status,'check-inbox');assert.equal(sent.length,1);
      const mail=sent[0],link=confirmationLink(mail);
      const expectedCopy=locale==='zh'
        ? [/自动确认订阅/,/无需再点击一次/,/24 小时内有效/,/确认订阅/]
        : [/confirm your subscription automatically/,/No second click is needed/,/valid for 24 hours/,/Confirm subscription/];
      for(const copy of expectedCopy) {
        assert.match(decodeHtml(mail.htmlContent),copy);assert.match(mail.textContent,copy);
      }
      assert.ok(mail.textContent.split('\n').includes(link.href));
      const pending=await db.prepare('SELECT status,is_test FROM subscribers').first();
      assert.equal(pending.status,'pending');assert.equal(pending.is_test,0);
      assert.equal((await mailCapacity(db,active)).confirmedCount,0);
      const input={id:link.searchParams.get('id'),token:link.searchParams.get('token'),action:'confirm'};
      const confirmed=await manageSubscription(db,input,active);
      assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.subscriptionType,'public');
      assert.doesNotMatch(JSON.stringify(confirmed),/email|is_test|@example\.test/);
      const capacity=await mailCapacity(db,active);
      assert.equal(capacity.confirmedCount,1);assert.equal(capacity.remaining,249);
      assert.equal((await manageSubscription(db,input,active)).subscriptionType,'public');
      assert.equal((await mailCapacity(db,active)).confirmedCount,1);
      const read=await manageSubscription(db,{id:input.id,token:confirmed.token,action:'read'},active);
      assert.equal(read.status,'confirmed');assert.equal(read.subscriptionType,'public');assert.equal(read.locale,locale);
      const unsubscribed=await manageSubscription(db,{id:input.id,token:confirmed.token,action:'unsubscribe'},active);
      assert.equal(unsubscribed.subscriptionType,'public');assert.equal(unsubscribed.status,'unsubscribed');
      assert.equal((await mailCapacity(db,active)).remaining,250);
      assert.equal(sent.length,1);
    });
  }
});
test('signed test confirmation and management report test identity without enrolling it publicly',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  const db=database();await seedDatabase(db);
  await mockedMail(async sent=>{
    await mailTest(db,{action:'confirmation',runId:'fixture-type-isolation',locale:'zh',topics:['product']},acceptance);
    assert.equal(sent.length,1);
    const link=confirmationLink(sent[0]),id=link.searchParams.get('id');
    const confirmed=await manageSubscription(db,{id,token:link.searchParams.get('token'),action:'confirm'},active);
    assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.subscriptionType,'test');
    assert.doesNotMatch(JSON.stringify(confirmed),/email|is_test|@example\.test/);
    const capacity=await mailCapacity(db,active);
    assert.equal(capacity.confirmedCount,0);assert.equal(capacity.remaining,250);
    const read=await manageSubscription(db,{id,token:confirmed.token,action:'read'},active);
    assert.equal(read.subscriptionType,'test');
    const saved=await manageSubscription(db,{id,token:confirmed.token,action:'preferences',locale:'en',topics:['research']},active);
    assert.equal(saved.subscriptionType,'test');assert.equal(saved.locale,'en');
    assert.equal((await queueDigest(db,'2026-10-12')).queued,0);
    await subscribe(db,publicInput(acceptance.testRecipient),active,'fixture-type-public-retry');
    assert.equal(sent.length,1);
    assert.equal((await db.prepare('SELECT is_test FROM subscribers WHERE id=?').bind(id).first()).is_test,1);
    const optedOut=await manageSubscription(db,{id,token:confirmed.token,action:'unsubscribe'},active);
    assert.equal(optedOut.subscriptionType,'test');assert.equal(optedOut.status,'unsubscribed');
    assert.equal((await mailCapacity(db,active)).remaining,250);
  });
});
test('full public signup collects nothing and the transactional insert closes a concurrent capacity race',async()=>{
  for(const fillDuringBatch of [false,true]) {
    const db=database();await capacityFixture(db,fillDuringBatch?249:250);
    if(fillDuringBatch) {const batch=db.batch;let filled=false;db.batch=async statements=>{if(!filled){filled=true;await pendingPublicFixture(db,'concurrent-last-slot',new Date(Date.now()+86400000).toISOString(),null,{status:'confirmed'});}return batch(statements);};}
    await mockedMail(async sent=>{
      const input=publicInput('fixture-capacity-new@example.test');
      const result=await subscribe(db,input,active,'fixture-capacity-client');
      assert.equal(result.status,'capacity-full');assert.equal(result.aggregateCapacity.confirmedCount,250);assert.equal(result.aggregateCapacity.remaining,0);
      assert.equal(await db.prepare('SELECT id FROM subscribers WHERE email=?').bind(input.email).first(),null);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,0);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM mail_quota').first()).n,0);assert.equal(sent.length,0);
      if(!fillDuringBatch) assert.equal((await db.prepare('SELECT count(*) AS n FROM rate_limits').first()).n,0);
    });
  }
});
test('249-to-250 concurrent confirmations have one winner and the original pending link works after a slot is released',async()=>{
  const db=database();await capacityFixture(db,249);
  const expires=new Date(Date.now()+86400000).toISOString();
  const pending=[await pendingPublicFixture(db,'last-slot-a',expires),await pendingPublicFixture(db,'last-slot-b',expires)];
  const inputs=await Promise.all(pending.map(async s=>({id:s.id,token:await tokenFor(s,active.secret,'confirm'),action:'confirm'})));
  await mockedMail(async sent=>{
    const results=await Promise.all(inputs.map(input=>manageSubscription(db,input,active)));
    const winner=results.findIndex(result=>result.status==='confirmed'),loser=1-winner;
    assert.ok(winner>=0);assert.equal(results[loser].status,'capacity-full');
    assert.equal((await mailCapacity(db,active)).confirmedCount,250);
    const blocked=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(pending[loser].id).first();
    assert.equal(blocked.status,'pending');assert.equal(blocked.token_expires,expires);
    assert.equal((await manageSubscription(db,inputs[winner],active)).status,'confirmed');
    const saved=await manageSubscription(db,{id:pending[winner].id,token:results[winner].token,action:'preferences',locale:'en',topics:['research']},active);
    assert.equal(saved.status,'confirmed');assert.equal(saved.locale,'en');
    const pendingManage=await tokenFor(pending[loser],active.secret);
    assert.equal((await manageSubscription(db,{id:pending[loser].id,token:pendingManage,action:'preferences',locale:'en',topics:['research']},active)).status,'preferences-not-saved');
    await manageSubscription(db,{id:pending[winner].id,token:results[winner].token,action:'unsubscribe'},active);
    assert.equal((await mailCapacity(db,active)).remaining,1);
    assert.equal((await manageSubscription(db,inputs[loser],active)).status,'confirmed');
    assert.equal((await mailCapacity(db,active)).confirmedCount,250);assert.equal(sent.length,0);
  });
});
test('test confirmation ignores public capacity while opted-out confirmations and unsaved preferences remain rejected',async()=>{
  const db=database();await capacityFixture(db,250);
  const expires=new Date(Date.now()+86400000).toISOString();
  const testRow=await pendingPublicFixture(db,'capacity-test-confirm',expires,null,{is_test:1});
  assert.equal((await manageSubscription(db,{id:testRow.id,token:await tokenFor(testRow,active.secret,'confirm'),action:'confirm'},active)).status,'confirmed');
  assert.equal((await mailCapacity(db,active)).confirmedCount,250);
  for(const status of ['suppressed','unsubscribed']) {
    const s=await pendingPublicFixture(db,`capacity-no-revive-${status}`,expires,null,{status});
    const before=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first();
    assert.equal((await manageSubscription(db,{id:s.id,token:await tokenFor(s,active.secret,'confirm'),action:'confirm'},active)).status,'confirmation-unavailable');
    assert.equal((await manageSubscription(db,{id:s.id,token:await tokenFor(s,active.secret),action:'preferences',locale:'en',topics:['research']},active)).status,'preferences-not-saved');
    assert.deepEqual(await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first(),before);
  }
});
test('public pending retries preserve the first confirmation link across the local midnight',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-11T15:58:00.000Z')});
  const db=database(),input=publicInput('fixture-sequential@example.test');
  await mockedMail(async sent=>{
    await subscribe(db,input,active,'fixture-first-client');
    const before=await db.prepare('SELECT * FROM subscribers').first();
    t.mock.timers.tick(5*60000);
    await subscribe(db,{...input,locale:'en',topics:['research']},active,'fixture-retry-client');
    assert.equal(sent.length,1);
    assert.deepEqual(await db.prepare('SELECT * FROM subscribers').first(),before);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,1);
    assert.equal((await db.prepare('SELECT sum(count) AS n FROM mail_quota').first()).n,1);
    assert.equal((await confirmFromMail(db,sent[0])).status,'confirmed');
  });
});
test('concurrent first public signups create one subscriber and one usable confirmation',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  const db=database(),input=publicInput('fixture-concurrent-first@example.test');
  await mockedMail(async sent=>{
    const results=await Promise.all([subscribe(db,input,active,'fixture-first-a'),subscribe(db,{...input,locale:'en'},active,'fixture-first-b')]);
    assert.deepEqual(results,[{status:'check-inbox'},{status:'check-inbox'}]);
    assert.equal(sent.length,1);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM subscribers').first()).n,1);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,1);
    assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,1);
    assert.equal((await confirmFromMail(db,sent[0])).status,'confirmed');
  });
});
test('concurrent retries preserve a legacy live confirmation even when the delivery history is missing',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  for(const deliveryStatus of ['submitted','delivered','failed','cancelled',null]) {
    const db=database(),s=await pendingPublicFixture(db,`live-${deliveryStatus}`,'2026-10-12T12:00:00.000Z',deliveryStatus);
    const token=await tokenFor(s,active.secret,'confirm');
    await mockedMail(async sent=>{
      await Promise.all([subscribe(db,publicInput(s.email),active,'fixture-live-a'),subscribe(db,publicInput(s.email,{locale:'en'}),active,'fixture-live-b')]);
      assert.equal(sent.length,deliveryStatus?0:1);
      const current=await db.prepare('SELECT * FROM subscribers').first();
      assert.equal(current.token_expires,s.token_expires);assert.equal(current.locale,s.locale);assert.equal(current.topics,s.topics);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,1);
      assert.equal((await db.prepare('SELECT sum(count) AS n FROM mail_quota').first()).n,deliveryStatus?null:1);
      assert.equal((await manageSubscription(db,{id:s.id,token,action:'confirm'},active)).status,'confirmed');
    });
  }
});
test('at expiry a public signup starts a new confirmation cycle and rejects the expired link',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-11T01:00:00.000Z')});
  const db=database(),input=publicInput('fixture-expiry-boundary@example.test');
  await mockedMail(async sent=>{
    await subscribe(db,input,active,'fixture-expiry-first');
    const first=await db.prepare('SELECT * FROM subscribers').first();
    t.mock.timers.tick(86400000);
    await assert.rejects(()=>confirmFromMail(db,sent[0]),/expired/);
    await subscribe(db,input,active,'fixture-expiry-new');
    assert.equal(sent.length,2);
    const current=await db.prepare('SELECT * FROM subscribers').first();
    assert.equal(current.id,first.id);assert.notEqual(current.token_expires,first.token_expires);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,2);
    assert.equal((await db.prepare('SELECT sum(count) AS n FROM mail_quota').first()).n,2);
    await assert.rejects(()=>confirmFromMail(db,sent[0]),/expired/);
    assert.equal((await confirmFromMail(db,sent[1])).status,'confirmed');
  });
});
test('concurrent expired public retries replace each known generation once and cancel old queued mail',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  for(const deliveryStatus of ['submitted','delivered','failed','cancelled','queued']) {
    const db=database(),s=await pendingPublicFixture(db,`expired-${deliveryStatus}`,'2026-10-12T00:00:00.000Z',deliveryStatus);
    await mockedMail(async sent=>{
      await Promise.all([subscribe(db,publicInput(s.email),active,'fixture-expired-a'),subscribe(db,publicInput(s.email,{locale:'en'}),active,'fixture-expired-b')]);
      assert.equal(sent.length,1);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM subscribers').first()).n,1);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,2);
      assert.equal((await db.prepare('SELECT status FROM deliveries WHERE id=?').bind(s.deliveryId).first()).status,deliveryStatus==='queued'?'cancelled':deliveryStatus);
      assert.equal((await db.prepare('SELECT token_expires FROM subscribers').first()).token_expires,'2026-10-13T01:00:00.000Z');
      assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,1);
      await drainQueue(db,active);assert.equal(sent.length,1);
      assert.equal((await confirmFromMail(db,sent[0])).status,'confirmed');
    });
  }
});
test('a public quota-held confirmation can be replaced after expiry without reviving its old queue',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  const db=database(),input=publicInput('fixture-public-quota@example.test');
  await db.prepare('INSERT INTO mail_quota(day,count) VALUES(?,300)').bind(singaporeDay()).run();
  await mockedMail(async sent=>{
    await subscribe(db,input,active,'fixture-quota-first');
    assert.equal(sent.length,0);
    const oldDelivery=await db.prepare('SELECT id,status FROM deliveries').first();assert.equal(oldDelivery.status,'queued');
    await db.prepare("UPDATE subscribers SET token_expires='2000-01-01T00:00:00.000Z'").run();
    await db.prepare('UPDATE mail_quota SET count=0').run();
    await subscribe(db,input,active,'fixture-quota-next');
    assert.equal(sent.length,1);
    assert.equal((await db.prepare('SELECT status FROM deliveries WHERE id=?').bind(oldDelivery.id).first()).status,'cancelled');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,2);
    await drainQueue(db,active);assert.equal(sent.length,1);
    assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,1);
    assert.equal((await confirmFromMail(db,sent[0])).status,'confirmed');
  });
});
test('public retries never rotate or resend sending and uncertain confirmation generations',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  for(const status of ['sending','uncertain']) {
    const db=database(),s=await pendingPublicFixture(db,`unresolved-${status}`,'2026-10-12T00:00:00.000Z',status);
    await mockedMail(async sent=>{
      await subscribe(db,publicInput(s.email,{locale:'en',topics:['research']}),active,'fixture-unresolved');
      const current=await db.prepare('SELECT * FROM subscribers').first();
      assert.equal(current.token_expires,s.token_expires);assert.equal(current.locale,s.locale);assert.equal(current.topics,s.topics);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,1);
      assert.equal((await db.prepare('SELECT status FROM deliveries').first()).status,'uncertain');
      assert.equal((await db.prepare('SELECT count(*) AS n FROM mail_quota').first()).n,0);assert.equal(sent.length,0);
    });
  }
  for(const failure of ['timeout','server-error']) {
    const db=database(),input=publicInput(`fixture-public-${failure}@example.test`);
    await mockedMail(async sent=>{
      await subscribe(db,input,active,'fixture-unknown-first');
      const before=await db.prepare('SELECT * FROM subscribers').first();
      t.mock.timers.tick(25*3600000);
      await subscribe(db,input,active,'fixture-unknown-retry');
      assert.equal(sent.length,1);assert.deepEqual(await db.prepare('SELECT * FROM subscribers').first(),before);
      assert.equal((await db.prepare('SELECT status FROM deliveries').first()).status,'uncertain');
      assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,1);
      assert.equal((await db.prepare('SELECT sum(count) AS n FROM mail_quota').first()).n,1);
    },()=>{if(failure==='timeout') throw new Error('fixture timeout');return new Response('',{status:503});});
  }
});
test('public signup preserves suppressed, confirmed and acceptance subscribers and requires consent',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  for(const [status,is_test] of [['confirmed',0],['suppressed',0],['pending',1],['unsubscribed',1],['suppressed',1]]) {
    const db=database(),s=await pendingPublicFixture(db,`protected-${status}-${is_test}`,'2000-01-01T00:00:00.000Z','queued',{status,is_test});
    const before={subscriber:await db.prepare('SELECT * FROM subscribers').first(),delivery:await db.prepare('SELECT * FROM deliveries').first()};
    await mockedMail(async sent=>{
      await subscribe(db,publicInput(s.email,{locale:'en'}),active,'fixture-protected');
      assert.deepEqual(await db.prepare('SELECT * FROM subscribers').first(),before.subscriber);
      assert.deepEqual(await db.prepare('SELECT * FROM deliveries').first(),before.delivery);
      assert.equal(sent.length,0);assert.equal((await db.prepare('SELECT count(*) AS n FROM mail_quota').first()).n,0);
    });
  }
  const db=database();
  await assert.rejects(()=>subscribe(db,publicInput('fixture-no-consent@example.test',{consent:false}),active,'fixture-no-consent'));
  assert.equal((await db.prepare('SELECT count(*) AS n FROM subscribers').first()).n,0);
});
test('a fresh public opt-in after unsubscribe rotates both link clocks, keeps history and claims one place',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  const db=database(),input=publicInput('fixture-public-reoptin@example.test');
  await mockedMail(async sent=>{
    await subscribe(db,input,active,'fixture-reoptin-first');
    const previous=await db.prepare('SELECT * FROM subscribers').first(),first=await confirmFromMail(db,sent[0]);
    await manageSubscription(db,{id:previous.id,token:first.token,action:'unsubscribe'},active);
    await db.prepare("INSERT INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at) VALUES('fixture-old-public-queue',?,'weekly','queued',?,?)").bind(previous.id,previous.created_at,previous.created_at).run();
    const oldSubmission=await db.prepare("SELECT * FROM deliveries WHERE kind='confirmation'").first();
    assert.equal((await subscribe(db,{...input,locale:'en',topics:['research']},active,'fixture-reoptin-new')).status,'check-inbox');
    const current=await db.prepare('SELECT * FROM subscribers').first();
    assert.equal(current.id,previous.id);assert.equal(current.status,'pending');assert.equal(current.is_test,0);assert.equal(current.confirmed_at,null);
    assert.equal(current.created_at,'2026-10-13T01:00:00.001Z');assert.equal(current.token_expires,'2026-10-14T01:00:00.001Z');
    assert.equal(current.locale,'en');assert.equal(current.topics,'["research"]');
    assert.equal((await db.prepare("SELECT status FROM deliveries WHERE id='fixture-old-public-queue'").first()).status,'cancelled');
    assert.deepEqual(await db.prepare('SELECT * FROM deliveries WHERE id=?').bind(oldSubmission.id).first(),oldSubmission);
    assert.equal(sent.length,2);assert.equal((await mailCapacity(db,active)).confirmedCount,0);
    await assert.rejects(()=>confirmFromMail(db,sent[0]),/Invalid or expired link/);
    for(const action of ['read','preferences','unsubscribe']) await assert.rejects(()=>manageSubscription(db,{id:previous.id,token:first.token,action,locale:'zh',topics:['product']},active),/Invalid or expired link/);
    const confirmed=await confirmFromMail(db,sent[1]);assert.equal(confirmed.subscriptionType,'public');assert.equal(confirmed.status,'confirmed');
    assert.equal((await mailCapacity(db,active)).confirmedCount,1);assert.equal((await mailCapacity(db,active)).remaining,249);
    await confirmFromMail(db,sent[1]);await drainQueue(db,active);
    assert.equal((await mailCapacity(db,active)).confirmedCount,1);assert.equal(sent.length,2);assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,2);
  },count=>Response.json({messageId:`fixture-reoptin-message-${count}`}));
});
test('concurrent public re-opt-ins have one winner and a delayed request cannot reopen a later opt-out',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  for(const delayed of [false,true]) {
    const db=database(),s=await pendingPublicFixture(db,`reoptin-concurrent-${delayed}`,'2026-10-14T01:00:00.000Z','delivered',{status:'unsubscribed',created_at:new Date().toISOString()});
    let enter,release,paused=false;
    const entered=new Promise(resolve=>{enter=resolve;}),released=new Promise(resolve=>{release=resolve;});
    if(delayed) {const batch=db.batch;db.batch=async statements=>{if(!paused){paused=true;enter();await released;}return batch(statements);};}
    await mockedMail(async sent=>{
      const first=subscribe(db,publicInput(s.email),active,'fixture-reoptin-concurrent-a');
      if(delayed) await entered;
      const second=await subscribe(db,publicInput(s.email,{locale:'en'}),active,'fixture-reoptin-concurrent-b');
      assert.equal(second.status,'check-inbox');
      if(delayed) {
        const confirmed=await confirmFromMail(db,sent[0]);
        await manageSubscription(db,{id:s.id,token:confirmed.token,action:'unsubscribe'},active);
        const completed=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first();
        release();await first;assert.deepEqual(await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first(),completed);
      } else {await first;assert.equal((await confirmFromMail(db,sent[0])).status,'confirmed');}
      assert.equal(sent.length,1);assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,2);
      assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,1);
    });
  }
});
test('public re-opt-in respects consent, capacity, rate limits and the confirmation daily quota',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  for(const reason of ['consent','capacity','capacity-race','rate','quota']) {
    const db=database(),s=await pendingPublicFixture(db,`reoptin-gate-${reason}`,'2026-10-14T01:00:00.000Z','delivered',{status:'unsubscribed'});
    const before=await db.prepare('SELECT * FROM subscribers').first();
    if(reason==='capacity') await capacityFixture(db,250);
    if(reason==='capacity-race') {await capacityFixture(db,249);const batch=db.batch;let filled=false;db.batch=async statements=>{if(!filled){filled=true;await capacityFixture(db,1,0,'reoptin-race-last-slot');}return batch(statements);};}
    if(reason==='rate') await db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,2,?)').bind(`email:${await hmac(s.email,active.secret)}:${Math.floor(Date.now()/86400000)}`,Date.now()+86400000).run();
    if(reason==='quota') await db.prepare('INSERT INTO mail_quota(day,count) VALUES(?,300)').bind(singaporeDay()).run();
    await mockedMail(async sent=>{
      if(reason==='consent') await assert.rejects(()=>subscribe(db,publicInput(s.email,{consent:false}),active,'fixture-reoptin-gate'));
      else {const result=await subscribe(db,publicInput(s.email),active,'fixture-reoptin-gate');assert.equal(result.status,reason.startsWith('capacity')?'capacity-full':'check-inbox');}
      assert.equal(sent.length,0);
      const current=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first();
      if(reason==='quota') {
        assert.equal(current.status,'pending');assert.notEqual(current.created_at,s.created_at);
        const queued=await db.prepare("SELECT id,status FROM deliveries WHERE id<>?").bind(s.deliveryId).first();assert.equal(queued.status,'queued');
        assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,300);
        t.mock.timers.tick(3600000);await db.prepare('UPDATE mail_quota SET count=0').run();
        await drainQueue(db,active);assert.equal(sent.length,1);assert.equal((await confirmFromMail(db,sent[0])).status,'confirmed');
      } else {assert.deepEqual(current,before);assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,1);}
    });
  }
});
test('public re-opt-in never revives unknown submissions or historical suppression',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  for(const reason of ['sending-confirmation','uncertain-confirmation','sending-weekly','uncertain-weekly','hardbounce','spam','invalid']) {
    const db=database(),s=await pendingPublicFixture(db,`reoptin-stop-${reason}`,'2026-10-14T01:00:00.000Z','failed',{status:'unsubscribed'});
    if(reason.includes('-')) {const [status,kind]=reason.split('-');await db.prepare('UPDATE deliveries SET status=?,kind=?').bind(status,kind).run();}
    else await db.prepare('UPDATE deliveries SET error=?').bind(reason).run();
    const before={subscriber:await db.prepare('SELECT * FROM subscribers').first(),delivery:await db.prepare('SELECT * FROM deliveries').first()};
    await mockedMail(async sent=>{
      await subscribe(db,publicInput(s.email),active,'fixture-reoptin-stop');
      assert.deepEqual(await db.prepare('SELECT * FROM subscribers').first(),before.subscriber);assert.deepEqual(await db.prepare('SELECT * FROM deliveries').first(),before.delivery);
      assert.equal(sent.length,0);assert.equal((await db.prepare('SELECT count(*) AS n FROM mail_quota').first()).n,0);
    });
  }
});
test('old public queue producers and preloaded claims cannot cross a re-opt-in epoch',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  for(const stage of ['weekly-insert','weekly-claim','confirmation-claim']) {
    const db=database();await seedDatabase(db);
    const confirmation=stage==='confirmation-claim';
    const s=await pendingPublicFixture(db,`reoptin-queue-${stage}`,'2026-10-14T01:00:00.000Z',confirmation?'queued':null,{status:confirmation?'pending':'confirmed',created_at:new Date().toISOString()});
    const oldManage=await tokenFor(s,active.secret),oldDelivery=confirmation?s.deliveryId:`2026-10-12:${s.id}`;
    if(stage==='weekly-claim') assert.equal((await queueDigest(db,'2026-10-12')).queued,1);
    let enter,release,paused=false;
    const entered=new Promise(resolve=>{enter=resolve;}),released=new Promise(resolve=>{release=resolve;});
    const prepare=db.prepare;
    db.prepare=sql=>{const statement=prepare(sql);
      if(stage==='weekly-insert') {const run=statement.run;statement.run=async()=>{if(!paused&&sql.startsWith('INSERT OR IGNORE INTO deliveries')&&sql.includes("'weekly','queued'")){paused=true;enter();await released;}return run.call(statement);};}
      else {const first=statement.first;statement.first=async()=>{if(!paused&&sql.startsWith("UPDATE deliveries SET status='sending'")){paused=true;enter();await released;}return first.call(statement);};}
      return statement;};
    await mockedMail(async sent=>{
      const stale=stage==='weekly-insert'?queueDigest(db,'2026-10-12'):drainQueue(db,active);
      await entered;
      await manageSubscription(db,{id:s.id,token:oldManage,action:'unsubscribe'},active);
      await subscribe(db,publicInput(s.email),active,'fixture-reoptin-queue-current');assert.equal(sent.length,1);
      await confirmFromMail(db,sent[0]);
      // Simulate an old queue row arriving after cancellation. It must remain
      // ineligible both for the paused claim and for subsequent normal drains.
      if(stage!=='weekly-insert') await db.prepare("UPDATE deliveries SET status='queued' WHERE id=?").bind(oldDelivery).run();
      release();const result=await stale;assert.equal(stage==='weekly-insert'?result.queued:result.submitted,0);
      await drainQueue(db,active);assert.equal(sent.length,1);assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,1);
      const old=await db.prepare('SELECT status,attempted_at FROM deliveries WHERE id=?').bind(oldDelivery).first();
      if(stage==='weekly-insert') {
        assert.equal(old,null);assert.equal((await queueDigest(db,'2026-10-12')).queued,1);
        await drainQueue(db,active);assert.equal(sent.length,2);
      } else {assert.equal(old.status,'queued');assert.equal(old.attempted_at,confirmation?s.created_at:null);}
    });
  }
});
test('previously validated public confirmation, preferences and unsubscribe cannot mutate a new epoch',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  for(const action of ['confirm','preferences','unsubscribe']) {
    const db=database(),s=await pendingPublicFixture(db,`reoptin-manage-${action}`,'2026-10-14T01:00:00.000Z','delivered',{status:action==='confirm'?'unsubscribed':'confirmed',created_at:new Date().toISOString()});
    const oldManage=await tokenFor(s,active.secret),oldToken=action==='confirm'?await tokenFor(s,active.secret,'confirm'):oldManage;
    let enter,release,paused=false;
    const entered=new Promise(resolve=>{enter=resolve;}),released=new Promise(resolve=>{release=resolve;});
    const prepare=db.prepare;
    db.prepare=sql=>{const statement=prepare(sql);statement.fixtureSql=sql;
      if(action!=='unsubscribe') {const run=statement.run;statement.run=async()=>{if(!paused&&sql.startsWith(action==='confirm'?"UPDATE subscribers SET status='confirmed'":"UPDATE subscribers SET locale=?,topics=? WHERE id=? AND status='confirmed'")){paused=true;enter();await released;}return run.call(statement);};}
      return statement;};
    if(action==='unsubscribe') {const batch=db.batch;db.batch=async statements=>{if(!paused&&statements.some(statement=>statement.fixtureSql.startsWith("UPDATE subscribers SET status='unsubscribed'"))){paused=true;enter();await released;}return batch(statements);};}
    await mockedMail(async sent=>{
      const stale=manageSubscription(db,{id:s.id,token:oldToken,action,locale:'en',topics:['research']},active),rejected=assert.rejects(stale,/Invalid or expired link/);
      await entered;
      if(action!=='confirm') await manageSubscription(db,{id:s.id,token:oldManage,action:'unsubscribe'},active);
      await subscribe(db,publicInput(s.email),active,'fixture-reoptin-manage-current');
      if(action!=='confirm') await confirmFromMail(db,sent[0]);
      const before={subscriber:await db.prepare('SELECT * FROM subscribers').first(),deliveries:(await db.prepare('SELECT * FROM deliveries ORDER BY id').all()).results};
      release();await rejected;
      assert.deepEqual(await db.prepare('SELECT * FROM subscribers').first(),before.subscriber);
      assert.deepEqual((await db.prepare('SELECT * FROM deliveries ORDER BY id').all()).results,before.deliveries);assert.equal(sent.length,1);
    });
  }
});
test('suppression remains terminal through signed opt-out, provider opt-out and public re-opt-in',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  for(const event of ['hardBounce','spam','invalid_email']) {
    const db=database(),s=await pendingPublicFixture(db,`reoptin-suppression-${event.toLowerCase()}`,'2026-10-14T01:00:00.000Z','submitted',{status:'confirmed'}),token=await tokenFor(s,active.secret);
    await mailWebhook(db,{event,email:s.email,'X-Mailin-custom':`delivery:${s.deliveryId}`});
    assert.equal((await manageSubscription(db,{id:s.id,token,action:'unsubscribe'},active)).status,'suppressed');
    await mailWebhook(db,{event:'unsubscribed',email:s.email,'X-Mailin-custom':`delivery:${s.deliveryId}`});
    await mockedMail(async sent=>{await subscribe(db,publicInput(s.email),active,'fixture-reoptin-suppression');assert.equal(sent.length,0);});
    assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,'suppressed');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM mail_quota').first()).n,0);
  }
});
test('related old unsubscribe callbacks preserve fresh consent while current and uncorrelated opt-outs stop it',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  for(const phase of ['pending','confirmed']) for(const reference of ['provider','custom']) {
    const db=database(),s=await pendingPublicFixture(db,`reoptin-callback-${phase}-${reference}`,'2026-10-14T01:00:00.000Z','delivered',{status:'unsubscribed'});
    await db.prepare('UPDATE deliveries SET provider_id=? WHERE id=?').bind('fixture-old-optout-message',s.deliveryId).run();
    await mockedMail(async sent=>{
      await subscribe(db,publicInput(s.email),active,'fixture-reoptin-callback');if(phase==='confirmed') await confirmFromMail(db,sent[0]);
      const before=await db.prepare('SELECT * FROM subscribers').first();
      const oldReference=reference==='provider'?{'message-id':'fixture-old-optout-message'}:{'X-Mailin-custom':`delivery:${s.deliveryId}`};
      await mailWebhook(db,{event:'unsubscribed',email:s.email,...oldReference});
      assert.deepEqual(await db.prepare('SELECT * FROM subscribers').first(),before);
      const current=await db.prepare('SELECT id FROM deliveries WHERE id<>?').bind(s.deliveryId).first();
      await mailWebhook(db,{event:'unsubscribed',email:s.email,'X-Mailin-custom':`delivery:${current.id}`});
      assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,'unsubscribed');assert.equal(sent.length,1);
    });
  }
  for(const event of ['unsubscribed','hardBounce','spam','invalid_email']) {
    const db=database(),s=await pendingPublicFixture(db,`reoptin-global-${event.toLowerCase()}`,'2026-10-14T01:00:00.000Z','delivered',{status:'unsubscribed'});
    await mockedMail(async sent=>{
      await subscribe(db,publicInput(s.email),active,'fixture-reoptin-global');
      await mailWebhook(db,{event,email:s.email,...(event==='unsubscribed'?{}:{'X-Mailin-custom':`delivery:${s.deliveryId}`})});
      assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,event==='unsubscribed'?'unsubscribed':'suppressed');assert.equal(sent.length,1);
    });
  }
});
test('a public re-opt-in epoch is newer than old delivery timestamps even within one millisecond or after clock correction',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-13T01:00:00.000Z')});
  for(const ahead of [0,2000]) {
    const db=database(),s=await pendingPublicFixture(db,`reoptin-clock-${ahead}`,'2026-10-14T01:00:00.000Z','delivered',{status:'unsubscribed'});
    const oldDeliveryTime=new Date(Date.now()+ahead).toISOString();
    await db.prepare('UPDATE deliveries SET created_at=? WHERE id=?').bind(oldDeliveryTime,s.deliveryId).run();
    await mockedMail(async sent=>{
      await subscribe(db,publicInput(s.email),active,'fixture-reoptin-clock');assert.equal(sent.length,1);
      const current=await db.prepare('SELECT * FROM subscribers').first();
      assert.equal(Date.parse(current.created_at),Date.parse(oldDeliveryTime)+1);
      await mailWebhook(db,{event:'unsubscribed',email:s.email,'X-Mailin-custom':`delivery:${s.deliveryId}`});
      assert.deepEqual(await db.prepare('SELECT * FROM subscribers').first(),current);
      assert.equal((await confirmFromMail(db,sent[0])).status,'confirmed');
    });
  }
});
test('confirmation and weekly emails offer matching escaped HTML and plain-text original URLs in both languages',async()=>{
  for(const locale of ['zh','en']) {
    const db=database(),item=structuredClone(seed[0]);
    item.slug='fixture-mail-copy';item.canonicalUrl='https://example.com/fixture-mail-copy';
    for(const language of ['zh','en']) {item[language].title='Fixture <unsafe> & "quoted"';item[language].summary='Fixture summary <script>fixture</script> & "quoted" is plain text.';}
    await upsertNews(db,item,'Fixture escaping check');
    await mockedMail(async sent=>{
      await mailTest(db,{action:'confirmation',runId:`copy-fallback-${locale}`,locale,topics:[item.category]},acceptance);
      assert.equal((await confirmFromMail(db,sent[0])).status,'confirmed');
      await mailTest(db,{action:'weekly',runId:`copy-fallback-${locale}`},acceptance);
      assert.equal(sent.length,2);
      for(const [index,mail] of sent.entries()) {
        const copied=[...mail.htmlContent.matchAll(/>(https:\/\/ag-ui\.ai\/[^<]+\/subscribe\?[^<]+)</g)].map(match=>decodeHtml(match[1]));
        const textUrls=mail.textContent.split('\n').filter(line=>line.startsWith(`https://ag-ui.ai/${locale}/subscribe?`)&&!new URL(line).hash);
        assert.equal(copied.length,index===0?2:1);assert.deepEqual(textUrls,copied);
        for(const url of copied) {
          const parsed=new URL(url);assert.equal(parsed.hostname,'ag-ui.ai');assert.equal(parsed.protocol,'https:');
          assert.match(parsed.searchParams.get('token'),/^[a-f0-9]{64}$/);
          assert.equal(mail.htmlContent.includes(url),false);
          assert.equal([...mail.htmlContent.matchAll(/href="([^"]+)"/g)].some(match=>decodeHtml(match[1])===url),true);
        }
        assert.match(mail.htmlContent,locale==='zh'?/复制此网址/:/copy this URL/);
        assert.match(mail.textContent,locale==='zh'?/仍可能经 Brevo 跟踪/:/may still pass through Brevo tracking/);
      }
      assert.match(sent[1].htmlContent,/Fixture &lt;unsafe&gt; &amp; &quot;quoted&quot;/);
      assert.doesNotMatch(sent[1].htmlContent,/<script>|<unsafe>/);
      assert.match(sent[1].textContent,/Fixture <unsafe> & "quoted"/);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM subscribers WHERE is_test=0').first()).n,0);
    });
  }
});
async function retiredAcceptanceFixture(db,patch={}) {
  const now=new Date().toISOString(),expires=new Date(Date.now()+86400000).toISOString();
  const s=await pendingPublicFixture(db,'retired-acceptance',expires,null,{email:acceptance.testRecipient,is_test:1,status:'unsubscribed',created_at:now,...patch});
  for(const kind of ['confirmation','weekly']) await db.prepare('INSERT INTO deliveries(id,subscriber_id,kind,status,provider_id,created_at,updated_at,is_test) VALUES(?,?,?,\'delivered\',?,?,?,?)')
    .bind(`test:prior-acceptance:${s.id}:${kind}`,s.id,kind,`fixture-old-${kind}`,now,now,s.is_test).run();
  return s;
}
test('explicit acceptance restart sends nothing, preserves history and invalidates old links and run IDs',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  const db=database();await seedDatabase(db);
  const s=await retiredAcceptanceFixture(db),oldConfirm=await tokenFor(s,active.secret,'confirm'),oldManage=await tokenFor(s,active.secret);
  await db.prepare("INSERT INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at,is_test) VALUES(?,?,'confirmation','delivered',?,?,1)")
    .bind(`test:prior-confirmation-only:${s.id}:confirmation`,s.id,s.created_at,s.created_at).run();
  const production=await webhookFixture(db,'restart-production',0);
  const oldHistory=(await db.prepare('SELECT * FROM deliveries WHERE subscriber_id=? ORDER BY id').bind(s.id).all()).results;
  const productionBefore=(await db.prepare('SELECT * FROM deliveries WHERE subscriber_id=? ORDER BY id').bind(production.subscriberId).all()).results;
  await db.prepare('INSERT INTO mail_quota(day,count) VALUES(?,3)').bind(singaporeDay()).run();
  await mockedMail(async sent=>{
    const args={action:'restart',runId:'new-acceptance-run',locale:'en',topics:['model']};
    const restarted=await operate(db,'mail-test',args,acceptance);
    assert.equal(restarted.status,'restarted');assert.equal(restarted.subscriberStatus,'pending');assert.equal(restarted.publicEnabled,false);
    assert.equal(restarted.activeTestRunId,args.runId);assert.equal(sent.length,0);
    assert.deepEqual((await mailTest(db,{action:'status'},acceptance)).preferences,{locale:'en',topics:['model']});
    assert.doesNotMatch(JSON.stringify(restarted),/acceptance@example|token=|test-only/);
    const pending=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first();
    assert.notEqual(pending.created_at,s.created_at);assert.equal(pending.token_expires,null);
    assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,3);
    const marker=await db.prepare('SELECT payload FROM editions WHERE id=?').bind(`test-restart:${s.id}:${args.runId}`).first();
    const metadata=JSON.parse(marker.payload);assert.equal(metadata.previousCreatedAt,s.created_at);assert.equal(metadata.previousTokenExpires,s.token_expires);
    assert.doesNotMatch(marker.payload,/acceptance@example|token=|test-only/);
    assert.deepEqual((await db.prepare('SELECT * FROM deliveries WHERE subscriber_id=? ORDER BY id').bind(s.id).all()).results,oldHistory);
    assert.equal((await mailTest(db,args,acceptance)).status,'restart-already-recorded');
    assert.deepEqual(await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first(),pending);
    await assert.rejects(()=>manageSubscription(db,{id:s.id,token:oldManage,action:'read'},acceptance),/Invalid/);
    assert.equal((await mailTest(db,{action:'confirmation',runId:'prior-acceptance'},acceptance)).status,'stale-test-run');
    await mailTest(db,{action:'confirmation',runId:args.runId},acceptance);assert.equal(sent.length,1);
    await assert.rejects(()=>manageSubscription(db,{id:s.id,token:oldConfirm,action:'confirm'},acceptance),/Invalid/);
    const confirmed=await confirmFromMail(db,sent[0]);assert.equal(confirmed.status,'confirmed');
    const deliveryCount=(await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n;
    for(const runId of ['prior-confirmation-only','prior-acceptance','unrecorded-new-run']) assert.equal((await mailTest(db,{action:'weekly',runId},acceptance)).status,'stale-test-run');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,deliveryCount);assert.equal(sent.length,1);
    await mailTest(db,{action:'weekly',runId:args.runId},acceptance);assert.equal(sent.length,2);
    await manageSubscription(db,{id:s.id,token:confirmed.token,action:'unsubscribe'},acceptance);
    const completed=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first();
    assert.equal((await mailTest(db,args,acceptance)).status,'restart-already-recorded');
    assert.deepEqual(await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first(),completed);assert.equal(sent.length,2);
    assert.equal((await mailTest(db,{action:'weekly',runId:args.runId},acceptance)).status,'recipient-suppressed');
    const next={action:'restart',runId:'next-acceptance-run'};
    assert.equal((await mailTest(db,next,acceptance)).status,'restarted');
    const nextSubscriber=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first();
    assert.equal((await mailTest(db,args,acceptance)).status,'restart-already-recorded');
    assert.deepEqual(await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first(),nextSubscriber);
    assert.equal((await mailTest(db,{action:'weekly',runId:args.runId},acceptance)).status,'stale-test-run');assert.equal(sent.length,2);
    assert.deepEqual((await db.prepare('SELECT * FROM deliveries WHERE subscriber_id=? ORDER BY id').bind(production.subscriberId).all()).results,productionBefore);
  },index=>Response.json({messageId:`fixture-restarted-${index}`}));
});
test('the D1 LIKE limit is enforced and an 80-character acceptance run uses literal SQL prefixes',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  const db=database();await seedDatabase(db);
  await assert.rejects(()=>db.prepare("SELECT 'fixture' LIKE ? AS matched").bind('x'.repeat(51)).first(),/pattern too complex/);
  assert.equal((await db.prepare('SELECT ? LIKE ? AS matched').bind('x'.repeat(51),'x'.repeat(49)+'%').first()).matched,1);
  const s=await retiredAcceptanceFixture(db),runId='r'.repeat(80),prepare=db.prepare;
  db.prepare=sql=>{assert.doesNotMatch(sql,/\b(?:LIKE|GLOB)\b/i);return prepare(sql);};
  await mockedMail(async sent=>{
    assert.equal((await mailTest(db,{action:'status'},acceptance)).subscriberStatus,'unsubscribed');
    assert.equal((await mailTest(db,{action:'restart',runId},acceptance)).status,'restarted');assert.equal(sent.length,0);
    assert.equal((await mailTest(db,{action:'status'},acceptance)).activeTestRunId,runId);
    assert.equal((await mailTest(db,{action:'restart',runId},acceptance)).status,'restart-already-recorded');
    await mailTest(db,{action:'confirmation',runId},acceptance);
    const confirmed=await confirmFromMail(db,sent[0]);assert.equal(confirmed.status,'confirmed');
    await mailTest(db,{action:'weekly',runId},acceptance);assert.equal(sent.length,2);
    assert.equal((await mailTest(db,{action:'weekly',runId:'prior-acceptance'},acceptance)).status,'stale-test-run');
    await manageSubscription(db,{id:s.id,token:confirmed.token,action:'unsubscribe'},acceptance);
    assert.equal((await mailTest(db,{action:'restart',runId:'prior-acceptance'},acceptance)).status,'test-run-already-used');
  });
});
test('same and competing restart IDs serialize one state-only acceptance generation',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  for(const runIds of [['concurrent-restart','concurrent-restart'],['concurrent-restart-a','concurrent-restart-b']]) {
    const db=database(),s=await retiredAcceptanceFixture(db);
    await mockedMail(async sent=>{
      const results=await Promise.all(runIds.map(runId=>mailTest(db,{action:'restart',runId},acceptance)));
      assert.equal(results.filter(result=>result.status==='restarted').length,1);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM editions WHERE is_test=1').first()).n,1);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,2);
      assert.equal((await db.prepare('SELECT status FROM subscribers WHERE id=?').bind(s.id).first()).status,'pending');
      assert.equal((await db.prepare('SELECT count(*) AS n FROM mail_quota').first()).n,0);assert.equal(sent.length,0);
    });
  }
});
test('a concurrent replay cannot reopen a later opt-out of the same recorded restart',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  const db=database(),s=await retiredAcceptanceFixture(db),batch=db.batch;let calls=0;
  db.batch=async statements=>{if(++calls===2) await db.prepare("UPDATE subscribers SET status='unsubscribed' WHERE id=?").bind(s.id).run();return batch(statements);};
  await mockedMail(async sent=>{
    const args={action:'restart',runId:'restart-optout-race'};
    const results=await Promise.all([mailTest(db,args,acceptance),mailTest(db,args,acceptance)]);
    assert.equal(results.filter(result=>result.status==='restarted').length,1);
    assert.equal((await db.prepare('SELECT status FROM subscribers WHERE id=?').bind(s.id).first()).status,'unsubscribed');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM editions').first()).n,1);assert.equal(sent.length,0);
  });
});
test('a delayed competing restart cannot reopen a completed later generation from an old snapshot',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  const db=database(),s=await retiredAcceptanceFixture(db),prepare=db.prepare,batch=db.batch;
  const delayedRun='delayed-restart-b',activeRun='completed-restart-a';
  let enter,release,paused=false;
  const entered=new Promise(resolve=>{enter=resolve;}),released=new Promise(resolve=>{release=resolve;});
  db.prepare=sql=>{const statement=prepare(sql),bind=statement.bind;
    statement.bind=(...args)=>{statement.fixtureArgs=args;return bind.apply(statement,args);};return statement;};
  db.batch=async statements=>{if(!paused&&statements.some(statement=>statement.fixtureArgs?.[0]===`test-restart:${s.id}:${delayedRun}`)){paused=true;enter();await released;}return batch(statements);};
  await mockedMail(async sent=>{
    const delayed=mailTest(db,{action:'restart',runId:delayedRun},acceptance);
    await entered;
    assert.equal((await mailTest(db,{action:'restart',runId:activeRun},acceptance)).status,'restarted');
    await mailTest(db,{action:'confirmation',runId:activeRun},acceptance);
    const confirmed=await confirmFromMail(db,sent[0]);
    await manageSubscription(db,{id:s.id,token:confirmed.token,action:'unsubscribe'},acceptance);
    const completed=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first();
    release();assert.equal((await delayed).status,'test-restart-unavailable');
    assert.deepEqual(await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first(),completed);
    const current=await mailTest(db,{action:'status'},acceptance);
    assert.equal(current.subscriberStatus,'unsubscribed');assert.equal(current.activeTestRunId,activeRun);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM editions WHERE substr(id,1,length(?))=?').bind(`test-restart:${s.id}:`,`test-restart:${s.id}:`).first()).n,1);
    assert.equal(sent.length,1);
  });
});
test('restart cancels only old queued test mail and refuses production, suppression, reused or unresolved runs',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  const db=database(),s=await retiredAcceptanceFixture(db);
  await db.prepare("INSERT INTO deliveries(id,subscriber_id,kind,status,created_at,updated_at,is_test) VALUES('fixture-old-test-queue',?,'weekly','queued',?,?,1)").bind(s.id,s.created_at,s.created_at).run();
  await mockedMail(async sent=>{
    assert.equal((await mailTest(db,{action:'restart',runId:'cancel-old-test-queue'},acceptance)).status,'restarted');
    assert.equal((await db.prepare("SELECT status FROM deliveries WHERE id='fixture-old-test-queue'").first()).status,'cancelled');assert.equal(sent.length,0);
  });
  for(const variant of ['production','suppressed','confirmed','pending','sending','uncertain','used-run','public-enabled','missing']) {
    const denied=database();
    let row;
    if(variant!=='missing') row=await retiredAcceptanceFixture(denied,variant==='production'?{is_test:0}:['suppressed','confirmed','pending'].includes(variant)?{status:variant}:{});
    if(['sending','uncertain'].includes(variant)) await denied.prepare("UPDATE deliveries SET status=? WHERE kind='weekly'").bind(variant).run();
    const snapshot=async()=>({subscribers:(await denied.prepare('SELECT * FROM subscribers ORDER BY id').all()).results,deliveries:(await denied.prepare('SELECT * FROM deliveries ORDER BY id').all()).results,editions:(await denied.prepare('SELECT * FROM editions ORDER BY id').all()).results});
    const before=await snapshot();
    await mockedMail(async sent=>{
      const args={action:'restart',runId:variant==='used-run'?'prior-acceptance':'refused-restart-run'};
      if(variant==='production') await assert.rejects(()=>mailTest(denied,args,acceptance),/production/);
      else assert.notEqual((await mailTest(denied,args,variant==='public-enabled'?{...acceptance,enabled:true}:acceptance)).status,'restarted');
      assert.deepEqual(await snapshot(),before);assert.equal(sent.length,0);
      await assert.rejects(()=>mailTest(denied,{...args,email:'outsider@example.test'},acceptance));
      assert.deepEqual(await snapshot(),before);
    });
  }
});
test('a paused legacy weekly call cannot insert or claim mail after an acceptance restart',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  for(const stage of ['insert','claim']) {
    const db=database();await seedDatabase(db);
    const s=await retiredAcceptanceFixture(db,{status:'confirmed'}),oldToken=await tokenFor(s,active.secret);
    const oldRun='legacy-racing-weekly',oldDelivery=`test:${oldRun}:${s.id}:weekly`;
    let enter,release,paused=false;
    const entered=new Promise(resolve=>{enter=resolve;}),released=new Promise(resolve=>{release=resolve;});
    if(stage==='insert') {
      const batch=db.batch;
      db.batch=async statements=>{if(!paused){paused=true;enter();await released;}return batch(statements);};
    } else {
      const prepare=db.prepare;
      db.prepare=sql=>{const statement=prepare(sql),first=statement.first;
        statement.first=async()=>{if(!paused&&sql.startsWith("UPDATE deliveries SET status='sending'")){paused=true;enter();await released;}return first.call(statement);};return statement;};
    }
    await mockedMail(async sent=>{
      const oldRequest=mailTest(db,{action:'weekly',runId:oldRun},acceptance);
      await entered;
      await manageSubscription(db,{id:s.id,token:oldToken,action:'unsubscribe'},acceptance);
      const newRun='active-racing-restart';
      assert.equal((await mailTest(db,{action:'restart',runId:newRun},acceptance)).status,'restarted');
      await mailTest(db,{action:'confirmation',runId:newRun},acceptance);
      const confirmed=await confirmFromMail(db,sent[0]);assert.equal(confirmed.status,'confirmed');
      if(stage==='claim') {
        // Model a legacy queued row arriving after cancellation. The atomic
        // claim must quarantine it even though this recipient is confirmed.
        await db.prepare("UPDATE deliveries SET status='queued' WHERE id=?").bind(oldDelivery).run();
      }
      release();
      assert.equal((await oldRequest).submitted,0);assert.equal(sent.length,1);
      const oldRow=await db.prepare('SELECT status,attempted_at FROM deliveries WHERE id=?').bind(oldDelivery).first();
      if(stage==='insert') assert.equal(oldRow,null);
      else {assert.equal(oldRow.status,'queued');assert.equal(oldRow.attempted_at,null);}
      assert.equal((await mailTest(db,{action:'weekly',runId:oldRun},acceptance)).status,'stale-test-run');assert.equal(sent.length,1);
      await manageSubscription(db,{id:s.id,token:confirmed.token,action:'unsubscribe'},acceptance);
      if(oldRow) assert.equal((await db.prepare('SELECT status FROM deliveries WHERE id=?').bind(oldDelivery).first()).status,'cancelled');
    });
  }
});
test('a previously validated confirmation cannot confirm the restarted acceptance generation',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  const db=database(),s=await retiredAcceptanceFixture(db),oldToken=await tokenFor(s,active.secret,'confirm');
  let enter,release,paused=false;
  const entered=new Promise(resolve=>{enter=resolve;}),released=new Promise(resolve=>{release=resolve;});
  const prepare=db.prepare;
  db.prepare=sql=>{const statement=prepare(sql),run=statement.run;
    statement.run=async()=>{if(!paused&&sql.startsWith("UPDATE subscribers SET status='confirmed'")){paused=true;enter();await released;}return run.call(statement);};return statement;};
  await mockedMail(async sent=>{
    const oldRequest=manageSubscription(db,{id:s.id,token:oldToken,action:'confirm'},acceptance),rejected=assert.rejects(oldRequest,/Invalid or expired link/);
    await entered;
    assert.equal((await mailTest(db,{action:'restart',runId:'confirm-generation-race'},acceptance)).status,'restarted');
    release();await rejected;
    assert.equal((await db.prepare('SELECT status FROM subscribers WHERE id=?').bind(s.id).first()).status,'pending');assert.equal(sent.length,0);
  });
});
test('previously validated preference and unsubscribe calls cannot mutate a restarted generation',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  for(const action of ['preferences','unsubscribe']) {
    const db=database(),s=await retiredAcceptanceFixture(db,{status:'confirmed'}),oldToken=await tokenFor(s,active.secret);
    let enter,release,paused=false;
    const entered=new Promise(resolve=>{enter=resolve;}),released=new Promise(resolve=>{release=resolve;});
    const prepare=db.prepare;
    db.prepare=sql=>{const statement=prepare(sql);statement.fixtureSql=sql;
      if(action==='preferences') {const run=statement.run;statement.run=async()=>{if(!paused&&sql.startsWith("UPDATE subscribers SET locale=?,topics=? WHERE id=? AND status='confirmed'")){paused=true;enter();await released;}return run.call(statement);};}
      return statement;};
    if(action==='unsubscribe') {const batch=db.batch;db.batch=async statements=>{if(!paused&&statements.some(statement=>statement.fixtureSql.startsWith("UPDATE subscribers SET status='unsubscribed'"))){paused=true;enter();await released;}return batch(statements);};}
    await mockedMail(async sent=>{
      const oldRequest=manageSubscription(db,{id:s.id,token:oldToken,action,locale:'en',topics:['research']},acceptance),rejected=assert.rejects(oldRequest,/Invalid or expired link/);
      await entered;
      await manageSubscription(db,{id:s.id,token:oldToken,action:'unsubscribe'},acceptance);
      const runId=`manage-generation-${action}`;
      assert.equal((await mailTest(db,{action:'restart',runId,locale:'zh',topics:['model']},acceptance)).status,'restarted');
      if(action==='unsubscribe') await db.prepare('INSERT INTO mail_quota(day,count) VALUES(?,300)').bind(singaporeDay()).run();
      await mailTest(db,{action:'confirmation',runId},acceptance);
      if(action==='preferences') await confirmFromMail(db,sent[0]);
      const before=await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first();
      const deliveries=(await db.prepare('SELECT * FROM deliveries WHERE subscriber_id=? ORDER BY id').bind(s.id).all()).results;
      release();await rejected;
      assert.deepEqual(await db.prepare('SELECT * FROM subscribers WHERE id=?').bind(s.id).first(),before);
      assert.deepEqual((await db.prepare('SELECT * FROM deliveries WHERE subscriber_id=? ORDER BY id').bind(s.id).all()).results,deliveries);
      assert.equal(sent.length,action==='preferences'?1:0);
      if(action==='unsubscribe') assert.equal(deliveries.find(delivery=>delivery.id===`test:${runId}:${s.id}:confirmation`).status,'queued');
    });
  }
});
async function webhookFixture(db, label, isTest=0) {
  const email=`fixture-${label}@example.test`, subscriberId=`fixture-${label}`, now='2000-01-01T00:00:00.000Z';
  await db.prepare("INSERT INTO subscribers(id,email,locale,topics,status,created_at,confirmed_at,is_test) VALUES(?,?,'en','[\"product\"]','confirmed',?,?,?)")
    .bind(subscriberId,email,now,now,isTest).run();
  for(const status of ['submitted','queued']) await db.prepare("INSERT INTO deliveries(id,subscriber_id,kind,status,provider_id,created_at,updated_at,is_test) VALUES(?,?,'weekly',?,?,?,?,?)")
    .bind(`${subscriberId}-${status}`,subscriberId,status,status==='submitted'?`${subscriberId}-message`:null,now,now,isTest).run();
  return {email,subscriberId,messageId:`${subscriberId}-message`};
}
test('transactional webhook spellings preserve all seven events and suppress invalid_email',async()=>{
  const cases=[
    ['delivered','confirmed','delivered','queued'],
    ['hardBounce','suppressed','failed','cancelled'],['hard_bounce','suppressed','failed','cancelled'],
    ['softBounce','confirmed','failed','queued'],['soft_bounce','confirmed','failed','queued'],
    ['spam','suppressed','failed','cancelled'],
    ['invalid','suppressed','failed','cancelled'],['invalid_email','suppressed','failed','cancelled'],['invalidEmail','suppressed','failed','cancelled'],
    ['blocked','confirmed','failed','queued'],['unsubscribed','unsubscribed','failed','cancelled'],
  ];
  for(const [event,subscriberStatus,deliveryStatus,queuedStatus] of cases) for(const isTest of [0,1]) {
    const db=database(),target=await webhookFixture(db,'target',isTest),other=await webhookFixture(db,'other',1-isTest);
    const beforeOther=(await db.prepare('SELECT * FROM deliveries WHERE subscriber_id=? ORDER BY id').bind(other.subscriberId).all()).results;
    assert.deepEqual(await mailWebhook(db,{event,email:target.email,'message-id':target.messageId}),{received:1});
    assert.equal((await db.prepare('SELECT status FROM subscribers WHERE id=?').bind(target.subscriberId).first()).status,subscriberStatus,event);
    assert.equal((await db.prepare('SELECT status FROM deliveries WHERE id=?').bind(`${target.subscriberId}-submitted`).first()).status,deliveryStatus,event);
    assert.equal((await db.prepare('SELECT status FROM deliveries WHERE id=?').bind(`${target.subscriberId}-queued`).first()).status,queuedStatus,event);
    assert.equal((await db.prepare('SELECT status FROM subscribers WHERE id=?').bind(other.subscriberId).first()).status,'confirmed');
    assert.deepEqual((await db.prepare('SELECT * FROM deliveries WHERE subscriber_id=? ORDER BY id').bind(other.subscriberId).all()).results,beforeOther);
    if(event==='invalid_email') assert.equal((await db.prepare('SELECT error FROM deliveries WHERE id=?').bind(`${target.subscriberId}-submitted`).first()).error,'invalid');
  }
});
test('unmatched synthetic delivered callbacks never create or update production or acceptance records',async()=>{
  const db=database(),fixtures=[await webhookFixture(db,'production',0),await webhookFixture(db,'acceptance',1)];
  const snapshot=async()=>({subscribers:(await db.prepare('SELECT * FROM subscribers ORDER BY id').all()).results,deliveries:(await db.prepare('SELECT * FROM deliveries ORDER BY id').all()).results});
  const before=await snapshot();
  for(const fixture of fixtures) {
    assert.deepEqual(await mailWebhook(db,{event:'delivered',email:fixture.email,'message-id':'fixture-synthetic-unknown-message','X-Mailin-custom':'delivery:fixture-synthetic-unknown-delivery'}),{received:1});
    assert.deepEqual(await snapshot(),before);
    assert.deepEqual(await mailWebhook(db,{event:'fixture_unknown_event',email:fixture.email,'message-id':fixture.messageId}),{received:1});
    assert.deepEqual(await snapshot(),before);
  }
});
test('webhook HTTP route accepts the configured Bearer and rejects other credentials before reading a body',async(t)=>{
  if(typeof nodeModule.registerHooks!=='function') {
    t.skip('This isolated Cloudflare-binding fixture requires node:module.registerHooks (Node 22.15+).');
    return;
  }
  const db=database(),fixture=await webhookFixture(db,'http-callback',1);
  const state={db,secret:'fixture-only-not-a-production-webhook-secret',reads:0,databaseCalls:0};
  globalThis.__agUiWebhookRuntimeFixture=state;
  const runtimeUrl=new URL('../lib/news/runtime.ts',import.meta.url).href;
  // Only the Cloudflare binding adapter is replaced. The HTTP route,
  // equalSecret, payload schema and D1 mutations are the application code.
  const hooks=nodeModule.registerHooks({load(url,context,nextLoad){
    if(url!==runtimeUrl) return nextLoad(url,context);
    return {format:'module',shortCircuit:true,source:`
      const fixture=globalThis.__agUiWebhookRuntimeFixture;
      export const setting=key=>key==='BREVO_WEBHOOK_SECRET'?fixture.secret:(fixture.settings?.[key]||'');
      export const database=()=>{fixture.databaseCalls++;return fixture.db;};
      export const isOwner=()=>false;
      export const originAllowed=request=>fixture.allowOrigin===true&&request.headers.get('origin')===new URL(request.url).origin;
      export const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
      export const readBody=async request=>{fixture.reads++;return request.json();};
    `};
  }});
  try {
    const {newsApi}=await import('../lib/news/api.ts');
    const request=(authorization,body)=>new Request('https://fixture.example.test/api/brevo/webhook',{method:'POST',headers:authorization?{authorization}:{},body});
    for(const authorization of ['',`Bearer fixture-wrong-secret`,state.secret]) {
      const response=await newsApi(request(authorization,'not-json'));
      assert.equal(response.status,401);
      assert.deepEqual(await response.json(),{error:'Unauthorized'});
    }
    assert.equal(state.reads,0);assert.equal(state.databaseCalls,0);
    const payload={event:'delivered',email:fixture.email,'message-id':fixture.messageId};
    const response=await newsApi(request(`Bearer ${state.secret}`,JSON.stringify(payload)));
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{received:1});
    assert.equal((await db.prepare('SELECT status FROM deliveries WHERE id=?').bind(`${fixture.subscriberId}-submitted`).first()).status,'delivered');
    assert.equal(state.reads,1);assert.equal(state.databaseCalls,1);
    state.secret='';
    assert.equal((await newsApi(request('Bearer ',JSON.stringify(payload)))).status,401);
    assert.equal(state.reads,1);assert.equal(state.databaseCalls,1);
    const restartBody=JSON.stringify({operation:'mail-test',arguments:{action:'restart',runId:'anonymous-restart'}});
    const admin=await newsApi(new Request('https://fixture.example.test/api/admin',{method:'POST',headers:{origin:'https://fixture.example.test','content-type':'application/json'},body:restartBody}));
    assert.equal(admin.status,403);assert.equal(state.databaseCalls,1);
    const mcp=await newsApi(new Request('https://fixture.example.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'newsroom_write',arguments:JSON.parse(restartBody)}})}));
    assert.equal(mcp.status,403);assert.equal(state.databaseCalls,1);
    state.settings={EMAIL_ENABLED:'true',BREVO_DOMAIN_VERIFIED:'true',EMAIL_ACCEPTANCE_PASSED:'true',BREVO_API_KEY:active.apiKey,BREVO_SENDER_EMAIL:active.sender,SUBSCRIPTION_SECRET:active.secret};
    state.secret='fixture-only-not-a-production-webhook-secret';state.allowOrigin=true;
    const formal=await capacityFixture(db,250,0,'http-capacity');
    const publicRequest=(path,body)=>new Request(`https://fixture.example.test${path}`,{method:'POST',headers:{origin:'https://fixture.example.test','content-type':'application/json'},body:JSON.stringify(body)});
    const publicStatus=await newsApi(new Request('https://fixture.example.test/api/subscription/status'));
    assert.equal(publicStatus.status,200);
    const aggregate=await publicStatus.json();
    assert.deepEqual(aggregate,{enabled:true,confirmedCount:250,capacity:250,remaining:0,full:true,dailyLimit:300,weeklyLimit:250});
    const fullSignup=await newsApi(publicRequest('/api/subscription',publicInput('fixture-http-full-new@example.test')));
    assert.equal(fullSignup.status,409);assert.deepEqual((await fullSignup.json()).aggregateCapacity,aggregate);
    const pending=await pendingPublicFixture(db,'http-capacity-pending',new Date(Date.now()+86400000).toISOString(),null);
    const confirmInput={id:pending.id,token:await tokenFor(pending,active.secret,'confirm'),action:'confirm'};
    const fullConfirm=await newsApi(publicRequest('/api/subscription/manage',confirmInput));
    assert.equal(fullConfirm.status,409);assert.deepEqual((await fullConfirm.json()).aggregateCapacity,aggregate);
    const failedPreferences=await newsApi(publicRequest('/api/subscription/manage',{id:pending.id,token:await tokenFor(pending,active.secret),action:'preferences',locale:'en',topics:['research']}));
    assert.equal(failedPreferences.status,409);assert.equal((await failedPreferences.json()).status,'preferences-not-saved');
    const optedOut=await newsApi(publicRequest('/api/subscription/manage',{id:formal[0].id,token:await tokenFor(formal[0],active.secret),action:'unsubscribe'}));
    assert.equal(optedOut.status,200);assert.equal((await optedOut.json()).status,'unsubscribed');
    const retry=await newsApi(publicRequest('/api/subscription/manage',confirmInput));
    assert.equal(retry.status,200);assert.equal((await retry.json()).status,'confirmed');
  } finally {hooks.deregister();delete globalThis.__agUiWebhookRuntimeFixture;}
});
test('concurrent acceptance run IDs claim one confirmation and preserve its signed link',async()=>{
  const db=database(),old=globalThis.fetch,sent=[];
  globalThis.fetch=async(_url,options)=>{sent.push(JSON.parse(options.body));return Response.json({messageId:'concurrent-test'});};
  try {
    const results=await Promise.all(['concurrent-first','concurrent-second','concurrent-first'].map(runId=>mailTest(db,{action:'confirmation',runId},acceptance)));
    assert.equal(results.reduce((n,r)=>n+(r.submitted||0),0),1);
    assert.equal(sent.length,1);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries').first()).n,1);
    const link=new URL(sent[0].htmlContent.match(/href="([^"]+action=confirm[^"]+)"/)[1].replaceAll('&amp;','&'));
    assert.equal((await manageSubscription(db,{id:link.searchParams.get('id'),token:link.searchParams.get('token'),action:'confirm'},acceptance)).status,'confirmed');
  } finally {globalThis.fetch=old;}
});
test('replacing an expired quota-held confirmation cancels the old generation permanently',async()=>{
  const db=database(),old=globalThis.fetch,sent=[];
  globalThis.fetch=async(_url,options)=>{sent.push(JSON.parse(options.body));return Response.json({messageId:'replacement-test'});};
  try {
    await db.prepare('INSERT INTO mail_quota(day,count) VALUES(?,300)').bind(singaporeDay()).run();
    const first={action:'confirmation',runId:'expired-first'},second={action:'confirmation',runId:'expired-second'};
    assert.equal((await mailTest(db,first,acceptance)).submitted,0);
    await db.prepare("UPDATE subscribers SET token_expires='2000-01-01T00:00:00.000Z'").run();
    await db.prepare('UPDATE mail_quota SET count=0').run();
    assert.equal((await mailTest(db,second,acceptance)).submitted,1);
    assert.equal((await mailTest(db,first,acceptance)).submitted,0);
    assert.equal(sent.length,1);
    assert.equal((await db.prepare("SELECT status FROM deliveries WHERE id LIKE 'test:expired-first:%'").first()).status,'cancelled');
    const link=new URL(sent[0].htmlContent.match(/href="([^"]+action=confirm[^"]+)"/)[1].replaceAll('&amp;','&'));
    assert.equal((await manageSubscription(db,{id:link.searchParams.get('id'),token:link.searchParams.get('token'),action:'confirm'},acceptance)).status,'confirmed');
  } finally {globalThis.fetch=old;}
});
test('mail acceptance requires configured verified transport and never accepts caller-selected recipients',async()=>{
  const db=database();
  for(const patch of [{domainVerified:false},{apiKey:''},{sender:''},{secret:''},{webhookSecret:''},{testRecipient:'invalid'}]) {
    const c={...acceptance,...patch};
    assert.equal(mailTestReady(c),false);
    assert.equal((await mailTest(db,{action:'confirmation',runId:'acceptance-one'},c)).status,'test-not-configured');
  }
  assert.equal((await db.prepare('SELECT count(*) AS n FROM subscribers').first()).n,0);
  await assert.rejects(()=>mailTest(db,{action:'confirmation',runId:'acceptance-one',email:'outsider@example.test'},acceptance));
  assert.equal((await subscribe(db,{email:'reader@example.test'},acceptance,'public')).status,'pending-activation');
  assert.equal((await drainQueue(db,acceptance)).status,'pending-activation');
});
test('owner acceptance reuses signed links and real content, isolates production, and is idempotent',async()=>{
  const db=database(); await seedDatabase(db);
  const now=new Date().toISOString(), realId=crypto.randomUUID();
  await db.prepare("INSERT INTO subscribers(id,email,locale,topics,status,created_at,confirmed_at) VALUES(?,?,'en',?,'confirmed',?,?)")
    .bind(realId,'production@example.test','["product"]',now,now).run();
  await queueDigest(db,'2026-10-05');
  const old=globalThis.fetch, sent=[];
  globalThis.fetch=async(_url,options)=>{sent.push(JSON.parse(options.body));return Response.json({messageId:`test-provider-${sent.length}`});};
  try {
    const args={action:'confirmation',runId:'acceptance-one',locale:'zh',topics:['model','product']};
    const first=await operate(db,'mail-test',args,acceptance);
    assert.equal(first.submitted,1); assert.equal(first.publicEnabled,false);
    assert.doesNotMatch(JSON.stringify(first),/acceptance@example|token=|test-only/);
    assert.equal((await mailTest(db,args,acceptance)).submitted,0);
    assert.equal((await mailTest(db,{...args,runId:'acceptance-two'},acceptance)).status,'confirmation-already-pending');
    assert.equal(sent.length,1);
    assert.equal(sent[0].to[0].email,acceptance.testRecipient);
    const link=new URL(sent[0].htmlContent.match(/href="([^"]+action=confirm[^"]+)"/)[1].replaceAll('&amp;','&'));
    const id=link.searchParams.get('id'), token=link.searchParams.get('token');
    const confirmed=await manageSubscription(db,{id,token,action:'confirm'},acceptance);
    assert.equal(confirmed.status,'confirmed');
    await manageSubscription(db,{id,token:confirmed.token,action:'preferences',locale:'en',topics:['model']},acceptance);
    const weekly={action:'weekly',runId:'acceptance-one'};
    assert.equal((await mailTest(db,weekly,acceptance)).submitted,1);
    assert.equal((await mailTest(db,weekly,acceptance)).submitted,0);
    assert.equal(sent.length,2); assert.match(sent[1].subject,/Acceptance test/);
    assert.match(sent[1].htmlContent,/\/en\/news\//);
    for(const mail of sent) assert.deepEqual(mail.to,[{email:acceptance.testRecipient}]);
    await mailWebhook(db,{event:'delivered',email:acceptance.testRecipient,'message-id':'test-provider-2'});
    assert.equal((await db.prepare("SELECT status FROM deliveries WHERE is_test=1 AND kind='weekly'").first()).status,'delivered');
    assert.equal((await queueDigest(db,'2026-10-05')).queued,0);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM deliveries WHERE is_test=0').first()).n,1);
    const dashboard=await operate(db,'dashboard',{},acceptance);
    assert.deepEqual(dashboard.email.subscribers.map(x=>({...x})),[{status:'confirmed',count:1}]);
    assert.equal(dashboard.stats.confirmed.reduce((sum,row)=>sum+row.confirmed,0),1);
    assert.equal((await db.prepare('SELECT count FROM mail_quota').first()).count,2);
    await drainQueue(db,active);
    assert.equal(sent.length,3); assert.equal(sent[2].to[0].email,'production@example.test');
    await manageSubscription(db,{id,token:confirmed.token,action:'unsubscribe'},acceptance);
    assert.equal((await mailTest(db,{action:'weekly',runId:'acceptance-new'},acceptance)).status,'recipient-suppressed');
    assert.equal(sent.length,3);
  } finally {globalThis.fetch=old;}
});
test('acceptance quota and recipient scopes prevent ordinary draining and suppression stops retries',async()=>{
  const db=database(); await seedDatabase(db);
  await db.prepare('INSERT INTO mail_quota(day,count) VALUES(?,300)').bind(singaporeDay()).run();
  const old=globalThis.fetch; let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({messageId:'quota-test'});};
  try {
    const confirmation={action:'confirmation',runId:'acceptance-quota'};
    assert.equal((await mailTest(db,confirmation,acceptance)).submitted,0);
    assert.equal((await drainQueue(db,active)).submitted,0);
    await db.prepare('UPDATE mail_quota SET count=0').run();
    assert.equal((await mailTest(db,confirmation,acceptance)).submitted,1);
    const s=await db.prepare('SELECT * FROM subscribers WHERE is_test=1').first();
    const confirmed=await manageSubscription(db,{id:s.id,token:await tokenFor(s,acceptance.secret,'confirm'),action:'confirm'},acceptance);
    assert.equal(confirmed.status,'confirmed');
    await db.prepare('UPDATE mail_quota SET count=250').run();
    const weekly={action:'weekly',runId:'acceptance-quota'};
    assert.equal((await mailTest(db,weekly,acceptance)).submitted,0);
    assert.equal((await drainQueue(db,active)).submitted,0);
    // A changed server recipient must not flush the previous recipient's queue.
    await assert.rejects(()=>mailTest(db,weekly,{...acceptance,testRecipient:'different@example.test'}));
    await mailWebhook(db,{event:'hardBounce',email:acceptance.testRecipient,'message-id':'quota-test'});
    await db.prepare('UPDATE mail_quota SET count=0').run();
    assert.equal((await mailTest(db,weekly,acceptance)).status,'recipient-suppressed');
    assert.equal((await db.prepare("SELECT status FROM deliveries WHERE kind='weekly'").first()).status,'cancelled');
    assert.equal(calls,1);
  } finally {globalThis.fetch=old;}
});
test('an uncertain acceptance submission is never automatically retried, even under a new run ID',async()=>{
  const db=database(), old=globalThis.fetch; let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('lost response');};
  try {
    const args={action:'confirmation',runId:'acceptance-timeout'};
    await mailTest(db,args,acceptance); await mailTest(db,args,acceptance);
    assert.equal((await mailTest(db,{...args,runId:'acceptance-another'},acceptance)).status,'confirmation-already-pending');
    assert.equal(calls,1);
    assert.equal((await db.prepare('SELECT status FROM deliveries').first()).status,'uncertain');
  } finally {globalThis.fetch=old;}
});
test('source recovery clears errors; later failure preserves the last successful check',async()=>{
  const db=database();
  const source={id:'recovering-source',url:'https://example.com/news',name:'Recovering source',kind:'official'};
  await operate(db,'source',{...source,success:false,error:'403'},config);
  await operate(db,'source',{...source,success:true},config);
  const recovered=await db.prepare('SELECT * FROM sources WHERE id=?').bind(source.id).first();
  assert.equal(recovered.error,null);
  assert.ok(recovered.successful_at);
  await operate(db,'source',{...source,success:false},config);
  const failed=await db.prepare('SELECT * FROM sources WHERE id=?').bind(source.id).first();
  assert.equal(failed.error,'Source unavailable');
  assert.equal(failed.successful_at,recovered.successful_at);
});
test('25 source-reviewed bilingual events validate with separate dates',()=>{assert.ok(seed.length>=20);for(const x of seed)newsSchema.parse(x);assert.equal(new Set(seed.map(x=>x.canonicalUrl)).size,seed.length);assert.ok(seed.filter(x=>x.eventDate>='2026-07-12').length>=18);});
test('invalid and future dates and nonpublic source URLs are rejected',()=>{for(const patch of [{eventDate:'2026-02-31'},{publishedAt:'2099-01-01'},{canonicalUrl:'http://example.com'},{canonicalUrl:'https://127.0.0.1/'},{canonicalUrl:'https://x.local/'}])assert.throws(()=>newsSchema.parse({...seed[0],...patch}));assert.equal(canonicalUrl('https://example.com/post/?utm_source=x#abc'),'https://example.com/post');});
test('seed and replay are idempotent; multi-source merges keep one event and history',async()=>{const db=database();await seedDatabase(db);await seedDatabase(db);assert.equal((await articles(db)).length,25);const before=(await db.prepare('SELECT * FROM revisions').all()).results.length;const existing=(await articles(db)).find(x=>x.slug===seed[0].slug);assert.equal((await upsertNews(db,existing,'Recheck same article')).changed,false);const merged=await upsertNews(db,{...existing,slug:'another-source',canonicalUrl:'https://example.com/second-source'},'Merge another source',existing.slug);assert.equal(merged.slug,existing.slug);assert.equal((await articles(db)).length,25);assert.equal((await db.prepare('SELECT * FROM revisions').all()).results.length,before+1);});
test('conflicting evidence is held; withdrawal remains traceable; checkpoints survive retries',async()=>{const db=database();await seedDatabase(db);const item={...seed[0],slug:'conflicting-item',canonicalUrl:'https://example.com/conflict'};await operate(db,'publish',{article:item,reason:'Conflicting publication dates',verification:{sourceRead:true,dateConfirmed:false,conflicts:['date']}},config);assert.ok(!(await articles(db)).some(x=>x.slug===item.slug));assert.equal((await articles(db,true)).find(x=>x.slug===item.slug).status,'review');await operate(db,'withdraw',{slug:seed[0].slug,reason:'Test a source withdrawal'},config);assert.ok(!(await articles(db)).some(x=>x.slug===seed[0].slug));const a={id:'collection-test-2026',kind:'collection'};await operate(db,'run-start',a,config);await operate(db,'run-start',a,config);assert.equal((await freshness(db)).stale,true);await operate(db,'run-finish',{id:a.id,status:'succeeded',result:'Source reads and readback completed'},config);assert.equal((await operate(db,'run-start',a,config)).alreadyCompleted,true);assert.equal((await freshness(db)).stale,false);await operate(db,'source',{id:'test-source',url:'https://example.com/news',name:'Test source',kind:'official',success:false,error:'403'},config);const source=await db.prepare('SELECT * FROM sources WHERE id=?').bind('test-source').first();assert.equal(source.successful_at,null);assert.equal(source.error,'403');});
test('email disabled does not collect email; preference tokens and suppression are enforced',async()=>{const db=database();assert.equal((await subscribe(db,{},config,'test')).status,'pending-activation');assert.equal((await db.prepare('SELECT * FROM subscribers').all()).results.length,0);const s={id:crypto.randomUUID(),email:'reader@example.test',locale:'en',topics:'["product"]',status:'pending',created_at:new Date().toISOString(),token_expires:new Date(Date.now()+100000).toISOString()};await db.prepare('INSERT INTO subscribers(id,email,locale,topics,status,created_at,token_expires) VALUES(?,?,?,?,?,?,?)').bind(...Object.values(s)).run();await assert.rejects(()=>manageSubscription(db,{id:s.id,token:'x'.repeat(64),action:'confirm'},active));await manageSubscription(db,{id:s.id,token:await tokenFor(s,active.secret,'confirm'),action:'confirm'},active);assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,'confirmed');await mailWebhook(db,{event:'hard_bounce',email:s.email});assert.equal((await db.prepare('SELECT status FROM subscribers').first()).status,'suppressed');});
test('weekly editions are empty-safe and duplicate-safe; quota exhaustion leaves queue intact',async()=>{const db=database();assert.equal((await queueDigest(db,'2026-10-05')).empty,true);await seedDatabase(db);const s={id:crypto.randomUUID(),email:'reader@example.test',locale:'en',topics:'["product","protocol","research","model","framework"]',status:'confirmed',created_at:new Date().toISOString()};await db.prepare('INSERT INTO subscribers(id,email,locale,topics,status,created_at) VALUES(?,?,?,?,?,?)').bind(...Object.values(s)).run();const first=await queueDigest(db,'2026-10-05');assert.equal(first.queued,1);assert.equal((await queueDigest(db,'2026-10-05')).queued,0);await db.prepare('INSERT INTO mail_quota(day,count) VALUES(?,300)').bind(singaporeDay()).run();assert.equal((await drainQueue(db,active)).submitted,0);assert.equal((await db.prepare('SELECT status FROM deliveries').first()).status,'queued');});
test('a submission timeout becomes uncertain, never automatically resent; callback confirms delivery',async()=>{const db=database();await seedDatabase(db);const s={id:crypto.randomUUID(),email:'reader@example.test',locale:'en',topics:'["product"]',status:'confirmed',created_at:new Date().toISOString()};await db.prepare('INSERT INTO subscribers(id,email,locale,topics,status,created_at) VALUES(?,?,?,?,?,?)').bind(...Object.values(s)).run();await queueDigest(db,'2026-10-05');const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('timeout');};try{await drainQueue(db,active);await drainQueue(db,active);assert.equal(calls,1);assert.equal((await db.prepare('SELECT status FROM deliveries').first()).status,'uncertain');await db.prepare("UPDATE deliveries SET provider_id='test-message',status='submitted'").run();await mailWebhook(db,{event:'delivered',email:s.email,'message-id':'test-message'});assert.equal((await db.prepare('SELECT status FROM deliveries').first()).status,'delivered');}finally{globalThis.fetch=old;}});
test('analytics deduplicates views, rejects bots/local tests and matches public/admin totals',async()=>{const db=database();const data={id:crypto.randomUUID(),kind:'view',path:'/zh/news'};const request=new Request('https://ag-ui.ai/api/stats',{headers:{'user-agent':'Browser Test Human','cf-connecting-ip':'192.0.2.1'}});await recordMetric(db,request,data,'test-secret');await recordMetric(db,request,data,'test-secret');await recordMetric(db,request,{...data,kind:'engaged'},'test-secret');await recordMetric(db,new Request('https://ag-ui.ai/api/stats',{headers:{'user-agent':'Googlebot'}}),{...data,id:crypto.randomUUID()},'test-secret');await recordMetric(db,new Request('http://localhost:3000/api/stats'),{...data,id:crypto.randomUUID()},'test-secret');const pub=await statsSummary(db),admin=await statsSummary(db,true);assert.equal(pub.views,1);assert.equal(pub.todayVisitors,1);assert.equal(admin.views,pub.views);assert.equal(admin.daily[0].engaged,1);assert.doesNotMatch(JSON.stringify((await db.prepare('SELECT * FROM stats_events').all()).results),/192\.0\.2\.1/);});
