import assert from 'node:assert/strict';
import { sanitizeHtml, toRichHtml, plainText, cleanForSave } from '../src/lib/richtext.js';

let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('ok -', name); };
const evil = [
  '<script>alert(1)</script>hi', '<img src=x onerror=alert(1)>', '<a href="javascript:alert(1)">x</a>',
  '<b onclick="x()">b</b>', '<svg onload=alert(1)>', '<iframe src="//e"></iframe>', '<style>*{}</style>t',
  '<<script>script>alert(1)<</script>/script>', '<p style="x:expression(1)">p</p>', '<!-- c --><u>u</u>',
];
t('allowed formatting is kept', () => assert.equal(sanitizeHtml('<b>a</b> <i>b</i> <u>c</u>'), '<b>a</b> <i>b</i> <u>c</u>'));
t('strong/em are mapped to b/i', () => assert.equal(sanitizeHtml('<strong>a</strong><em>b</em>'), '<b>a</b><i>b</i>'));
t('lists survive, stray li dropped', () => {
  assert.equal(sanitizeHtml('<ul><li>a</li><li>b</li></ul>'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(sanitizeHtml('<li>x</li>'), 'x');
});
t('no output ever has an attribute, script, handler or link', () => {
  for (const e of evil) {
    const o = sanitizeHtml(e);
    assert.ok(!/<(script|img|a|svg|iframe|style)\b/i.test(o), e + ' -> ' + o);
    assert.ok(!/<[a-z]+\s/i.test(o), 'attribute left: ' + o);
    assert.ok(!/alert\(1\)/.test(o.replace(/&lt;[^]*?&gt;/g, '')) || !/<script/i.test(o), o);
  }
});
t('script content is dropped, not shown', () => assert.equal(sanitizeHtml('<script>alert(1)</script>hi'), 'hi'));
t('unbalanced tags are closed', () => assert.equal(sanitizeHtml('<b>a<i>b'), '<b>a<i>b</i></b>'));
t('plain text from old versions is escaped and keeps line breaks', () => {
  assert.equal(toRichHtml('a < b\nc & d'), 'a &lt; b<br>c &amp; d');
  assert.equal(toRichHtml('1 <2> & x'), '1 &lt;2&gt; &amp; x');
});
t('raw markdown stays plain text (not interpreted)', () => assert.equal(toRichHtml('**a**'), '**a**'));
t('empty stays empty', () => { assert.equal(toRichHtml(null), ''); assert.equal(toRichHtml('  '), ''); });
t('plainText counts visible text only', () => assert.equal(plainText('<p><b>ab</b></p><p>c</p>'), 'ab\nc'));
t('cleanForSave: no visible text -> null', () => { assert.equal(cleanForSave('<p><br></p>'), null); assert.equal(cleanForSave('<b>x</b>'), '<b>x</b>'); });
console.log(`\n${n} richtext tests passed`);
