import assert from 'node:assert/strict';
import { computeProgress, computeStatus, effectiveProfileStatus, fillTemplate, isValidUrl, formatDuration, formatThaiDate, isFacebookUrl, stepCategory, kindForCategory } from '../src/lib/logic.js';

const DEFAULT_CATS = ['pending', 'confirmed', 'in_progress', 'review', 'review'];
const steps = (done, cats = DEFAULT_CATS) => ['รับบรีฟ','ชำระเงิน','กำลังทำ','ตรวจงาน','ส่งไฟล์'].map((label, i) => ({
  id: String(i), label, sort_order: i + 1, is_done: i < done, category: cats[i],
}));
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };

t('progress 4/5 = 80%', () => assert.deepEqual(computeProgress(steps(4)), { total: 5, done: 4, percent: 80 }));
t('progress with no steps = 0, no NaN', () => assert.equal(computeProgress([]).percent, 0));
t('current step "รับบรีฟ" (pending) -> pending', () => assert.equal(computeStatus({}, steps(0)).key, 'pending'));
t('brief done, current step "ชำระเงิน" (confirmed) -> confirmed, NOT in progress', () => assert.equal(computeStatus({}, steps(1)).key, 'confirmed'));
t('paid, current step "กำลังทำ" -> in_progress', () => assert.equal(computeStatus({}, steps(2)).key, 'in_progress'));
t('current step in review category -> review', () => assert.equal(computeStatus({}, steps(3)).key, 'review'));
t('100% -> completed', () => assert.equal(computeStatus({}, steps(5)).key, 'completed'));
t('custom step names: "ร่างแรก" in in_progress, "ลูกค้าตรวจงาน" in review', () => {
  const custom = [
    { id: 'a', label: 'ร่างแรก', sort_order: 1, is_done: false, category: 'in_progress' },
    { id: 'b', label: 'ลูกค้าตรวจงาน', sort_order: 2, is_done: false, category: 'review' },
  ];
  assert.equal(computeStatus({}, custom).key, 'in_progress');
  custom[0].is_done = true;
  assert.equal(computeStatus({}, custom).key, 'review');
});
t('cancelled override wins over everything', () => assert.equal(computeStatus({ status_override: 'cancelled' }, steps(5)).key, 'cancelled'));
t('paused override wins', () => assert.equal(computeStatus({ status_override: 'paused' }, steps(2)).key, 'paused'));
t('forced category override applies while unfinished', () => assert.equal(computeStatus({ status_override: 'review' }, steps(2)).key, 'review'));
t('forced category override is IGNORED at 100% -> completed', () => assert.equal(computeStatus({ status_override: 'review' }, steps(5)).key, 'completed'));
t('NEVER completed with progress < 100 (all overrides, all counts)', () => {
  for (const ov of [null, 'cancelled', 'paused', 'pending', 'confirmed', 'in_progress', 'review'])
    for (let d = 0; d < 5; d++) assert.notEqual(computeStatus({ status_override: ov }, steps(d)).key, 'completed');
});
t('empty workflow never reports completed', () => assert.equal(computeStatus({}, []).key, 'pending'));
t('step order follows sort_order not array order', () => {
  const shuffled = steps(2).reverse();
  assert.equal(computeStatus({}, shuffled).currentStep.label, 'กำลังทำ');
});
t('rows saved before categories fall back to their old kind', () => {
  assert.equal(stepCategory({ kind: 'working' }), 'in_progress');
  assert.equal(stepCategory({ kind: 'waiting_info' }), 'pending');
  assert.equal(stepCategory({ kind: 'waiting_revision' }), 'review');
  assert.equal(stepCategory({ category: 'confirmed', kind: 'normal' }), 'confirmed');
});
t('every category maps to a kind the old check constraint accepts', () => {
  for (const c of ['pending', 'confirmed', 'in_progress', 'review']) assert.ok(['normal', 'working', 'waiting_info', 'waiting_revision'].includes(kindForCategory(c)));
});
t('facebook url: only https facebook.com / fb.com / fb.me', () => {
  assert.ok(isFacebookUrl('https://www.facebook.com/abc')); assert.ok(isFacebookUrl('https://fb.me/abc')); assert.ok(isFacebookUrl('https://m.facebook.com/profile.php?id=1'));
  assert.ok(!isFacebookUrl('http://facebook.com/a')); assert.ok(!isFacebookUrl('https://evilfacebook.com/a')); assert.ok(!isFacebookUrl('https://facebook.com.evil.io/a'));
  assert.ok(!isFacebookUrl('javascript:alert(1)')); assert.ok(!isFacebookUrl(''));
});

const svc = (open, vis = true) => ({ is_open: open, is_visible: vis });
t('profile open + all services closed -> closed', () => assert.equal(effectiveProfileStatus({ status: 'open' }, [svc(false), svc(false)]), 'closed'));
t('profile open + some closed -> partial', () => assert.equal(effectiveProfileStatus({ status: 'open' }, [svc(true), svc(false)]), 'partial'));
t('profile open + all open -> open', () => assert.equal(effectiveProfileStatus({ status: 'open' }, [svc(true)]), 'open'));
t('hidden services are ignored', () => assert.equal(effectiveProfileStatus({ status: 'open' }, [svc(true), svc(false, false)]), 'open'));
t('manual closed / ask always respected', () => { assert.equal(effectiveProfileStatus({ status: 'closed' }, [svc(true)]), 'closed'); assert.equal(effectiveProfileStatus({ status: 'ask' }, [svc(true)]), 'ask'); });
t('no services at all keeps manual status', () => assert.equal(effectiveProfileStatus({ status: 'open' }, []), 'open'));

t('template replaces every {service}', () => assert.equal(fillTemplate('สนใจ {service} / {service}', 'Chibi'), 'สนใจ Chibi / Chibi'));
t('url validation', () => {
  assert.ok(isValidUrl('https://x.com/a')); assert.ok(isValidUrl('mailto:a@b.co'));
  assert.ok(!isValidUrl('javascript:alert(1)')); assert.ok(!isValidUrl('x.com')); assert.ok(!isValidUrl(''));
});
t('duration/date format', () => { assert.equal(formatDuration(3, 5), '3–5 วัน'); assert.equal(formatDuration(5, 5), '5 วัน'); assert.equal(formatThaiDate('2026-10-10'), '10 ต.ค.'); });
console.log(`\n${n} tests passed`);
