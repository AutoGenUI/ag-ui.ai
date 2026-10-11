import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { newsSchema, canonicalUrl, singaporeDay } from '../lib/news/core.ts';
import { articles, upsertNews, seedDatabase, seed, freshness } from '../lib/news/store.ts';
import { operate } from '../lib/news/operations.ts';
import { recordMetric, statsSummary } from '../lib/news/analytics.ts';
import { drainQueue, mailWebhook, manageSubscription, queueDigest, subscribe, tokenFor, mailTest, mailTestReady } from '../lib/news/mail.ts';
function database(){const raw=new DatabaseSync(':memory:');for(const entry of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8')).entries)raw.exec(readFileSync(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),'utf8'));const db={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return raw.prepare(sql).get(...args)||null},async all(){return {results:raw.prepare(sql).all(...args)}},_run(){return raw.prepare(sql).run(...args)},async run(){return {meta:this._run()}}}},async batch(statements){raw.exec('BEGIN');try{const r=statements.map(s=>({meta:s._run()}));raw.exec('COMMIT');return r;}catch(e){raw.exec('ROLLBACK');throw e;}}};return db;}
const config={enabled:false,apiKey:'',sender:'',secret:'',webhookSecret:''};
const active={enabled:true,apiKey:'test-only',sender:'test@example.test',secret:'test-only-not-production',webhookSecret:'test-only-webhook'};
const acceptance={...active,enabled:false,domainVerified:true,testRecipient:'acceptance@example.test'};
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
