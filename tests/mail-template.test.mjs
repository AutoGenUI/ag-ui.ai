import assert from 'node:assert/strict';
import test from 'node:test';
import {renderMail} from '../lib/news/mail-template.ts';

const confirmUrl='https://ag-ui.ai/zh/subscribe?action=confirm&id=synthetic&token='+ 'a'.repeat(64);
const manageUrl='https://ag-ui.ai/zh/subscribe?id=synthetic&token='+ 'b'.repeat(64);
test('confirmation mail separates its primary confirmation from request management in both formats and languages',()=>{
  for(const locale of ['zh','en']) {
    const mail=renderMail({locale,kind:'confirmation',confirmUrl,manageUrl});
    assert.match(mail.html,/<!doctype html>/i);
    assert.ok(mail.html.includes('max-width:620px'));
    assert.ok(mail.html.includes('role="presentation"'));
    const primary=mail.html.indexOf('bgcolor="#2443d6"');
    const management=mail.html.indexOf('border-top:2px solid #d8dce7');
    assert.ok(primary>0&&management>primary);
    assert.equal((mail.html.match(/bgcolor="#2443d6"/g)||[]).length,1);
    assert.ok(mail.text.indexOf(confirmUrl)<mail.text.indexOf('------------------------------'));
    assert.ok(mail.text.indexOf(manageUrl)>mail.text.indexOf('------------------------------'));
    assert.ok(mail.html.includes(locale==='zh'?'自动确认订阅':'confirm your subscription automatically'));
    assert.ok(mail.text.includes('24'));
    assert.ok(!mail.html.includes('<img')&&!mail.html.includes('<script'));
  }
});
test('weekly mail distinguishes stories, preferences and explicitly managed unsubscribe',()=>{
  for(const locale of ['zh','en']) {
    const item={slug:'story',sourceName:'Primary source',eventDate:'2026-10-13',zh:{title:'生成式 UI 事件',summary:'来源核验过的摘要'},en:{title:'Generative UI event',summary:'An attributed summary'}};
    const mail=renderMail({locale,kind:'weekly',editionId:'2026-10-12',items:[item],manageUrl});
    assert.ok(mail.html.indexOf('/news/story')<mail.html.indexOf('border-top:2px solid #d8dce7'));
    assert.ok(mail.html.includes(`${manageUrl.replaceAll('&','&amp;')}#unsubscribe`));
    assert.ok(mail.html.includes(locale==='zh'?'修改订阅偏好':'Change preferences'));
    assert.ok(mail.html.includes(locale==='zh'?'打开退订管理':'Open unsubscribe settings'));
    assert.ok(mail.text.includes('Primary source · 2026-10-13'));
    assert.ok(!mail.html.includes('action=confirm'));
  }
});
test('untrusted story copy and signed URLs cannot inject HTML or an external story destination',()=>{
  const copy={title:'<script>alert(1)</script>',summary:'<img src=x onerror="attack()">'};
  const mail=renderMail({locale:'en',kind:'weekly',editionId:'2026-10-12',items:[{slug:'../../"onclick=attack',sourceName:'<iframe>',eventDate:'<svg>',zh:copy,en:copy}],manageUrl:manageUrl+'&quote="<test>'});
  assert.ok(!mail.html.includes('<script>')&&!mail.html.includes('<img')&&!mail.html.includes('<iframe>')&&!mail.html.includes('<svg>'));
  assert.ok(mail.html.includes('&lt;script&gt;'));
  assert.ok(mail.html.includes('https://ag-ui.ai/en/news/..%2F..%2F%22onclick%3Dattack'));
  assert.ok(mail.html.includes('&quot;&lt;test&gt;'));
});
test('isolated acceptance identities remain labelled rather than presented as a public digest',()=>{
  for(const locale of ['zh','en']) {
    const mail=renderMail({locale,kind:'confirmation',confirmUrl,manageUrl,test:true});
    assert.ok(mail.subject.startsWith(locale==='zh'?'[验收测试]':'[Acceptance test]'));
    assert.ok(mail.html.includes(locale==='zh'?'不会加入正式周报名单':'not a public newsletter subscription'));
    assert.ok(mail.text.startsWith(locale==='zh'?'这是邮件验收测试':'This is an email acceptance test'));
  }
});
