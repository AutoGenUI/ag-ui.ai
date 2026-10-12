import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import * as nodeModule from 'node:module';
import { newsSchema, canonicalUrl, singaporeDay } from '../lib/news/core.ts';
import { articles, upsertNews, seedDatabase, seed, freshness } from '../lib/news/store.ts';
import { operate } from '../lib/news/operations.ts';
import { recordMetric, statsSummary } from '../lib/news/analytics.ts';
import { drainQueue, mailWebhook, manageSubscription, queueDigest, subscribe, tokenFor, mailTest, mailTestReady } from '../lib/news/mail.ts';
function database(){const raw=new DatabaseSync(':memory:');for(const entry of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8')).entries)raw.exec(readFileSync(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),'utf8'));const db={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return raw.prepare(sql).get(...args)||null},async all(){return {results:raw.prepare(sql).all(...args)}},_run(){return raw.prepare(sql).run(...args)},async run(){return {meta:this._run()}}}},async batch(statements){raw.exec('BEGIN');try{const r=statements.map(s=>({meta:s._run()}));raw.exec('COMMIT');return r;}catch(e){raw.exec('ROLLBACK');throw e;}}};return db;}
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
test('public signup preserves opted-out, confirmed and acceptance subscribers and requires consent',async(t)=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T01:00:00.000Z')});
  for(const [status,is_test] of [['confirmed',0],['suppressed',0],['unsubscribed',0],['pending',1]]) {
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
        const copied=[...mail.htmlContent.matchAll(/<span style="overflow-wrap:anywhere;word-break:break-all">([^<]+)<\/span>/g)].map(match=>decodeHtml(match[1]));
        const textUrls=mail.textContent.split('\n').filter(line=>line.startsWith(`https://ag-ui.ai/${locale}/subscribe?`));
        assert.equal(copied.length,index===0?2:1);assert.deepEqual(textUrls,copied);
        for(const url of copied) {
          const parsed=new URL(url);assert.equal(parsed.hostname,'ag-ui.ai');assert.equal(parsed.protocol,'https:');
          assert.match(parsed.searchParams.get('token'),/^[a-f0-9]{64}$/);
          assert.equal(mail.htmlContent.includes(url),false);
          assert.equal([...mail.htmlContent.matchAll(/href="([^"]+)"/g)].some(match=>decodeHtml(match[1])===url),true);
        }
        assert.match(mail.htmlContent,locale==='zh'?/复制下面的网址文字/:/copy the URL text/);
        assert.match(mail.textContent,locale==='zh'?/仍可能经过 Brevo 跟踪/:/may still pass through Brevo tracking/);
      }
      assert.match(sent[1].htmlContent,/Fixture &lt;unsafe&gt; &amp; &quot;quoted&quot;/);
      assert.doesNotMatch(sent[1].htmlContent,/<script>|<unsafe>/);
      assert.match(sent[1].textContent,/Fixture <unsafe> & "quoted"/);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM subscribers WHERE is_test=0').first()).n,0);
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
      export const setting=key=>key==='BREVO_WEBHOOK_SECRET'?fixture.secret:'';
      export const database=()=>{fixture.databaseCalls++;return fixture.db;};
      export const isOwner=()=>false;
      export const originAllowed=()=>false;
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
