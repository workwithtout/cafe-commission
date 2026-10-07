import { useEffect, useRef, useState } from 'react';
import { plainText, sanitizeHtml, toRichHtml } from '../lib/richtext.js';
import { play } from '../lib/sound.js';

/** Shows stored Bio / description text. Always sanitised, never raw HTML or Markdown. */
export function RichText({ value, className = '', as: Tag = 'div' }) {
  const html = toRichHtml(value);
  if (!html) return null;
  return <Tag className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

const TOOLS = [
  { cmd: 'bold', label: 'ตัวหนา', glyph: 'B', style: { fontWeight: 700 } },
  { cmd: 'italic', label: 'ตัวเอียง', glyph: 'I', style: { fontStyle: 'italic' } },
  { cmd: 'underline', label: 'ขีดเส้นใต้', glyph: 'U', style: { textDecoration: 'underline' } },
  { cmd: 'insertUnorderedList', label: 'รายการ', glyph: '•', style: {} },
];

/**
 * Small WYSIWYG editor (bold / italic / underline / bullet list) for Bio and descriptions.
 * Works with touch (big buttons) and keyboard (Ctrl/Cmd+B, I, U). Pasted text is inserted as plain text.
 * `onChange` receives sanitised HTML.
 */
export function RichEditor({ id, value, onChange, maxText, placeholder = 'พิมพ์ข้อความที่นี่…', ariaLabel, minHeight = 110 }) {
  const ref = useRef(null);
  const [active, setActive] = useState({});
  const [len, setLen] = useState(() => plainText(toRichHtml(value)).length);

  // load the value; re-sync only if it was changed from outside (never while the user is typing)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wanted = toRichHtml(value);
    if (sanitizeHtml(el.innerHTML) !== wanted) el.innerHTML = wanted;
    setLen(plainText(wanted).length);
  }, [value]);

  useEffect(() => {
    const onSel = () => {
      const el = ref.current;
      if (!el || !el.contains(document.getSelection()?.anchorNode)) return;
      const next = {};
      TOOLS.forEach((t) => { try { next[t.cmd] = document.queryCommandState(t.cmd); } catch { next[t.cmd] = false; } });
      setActive(next);
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const emit = () => {
    const safe = sanitizeHtml(ref.current.innerHTML);
    setLen(plainText(safe).length);
    onChange(plainText(safe) ? safe : '');
  };
  const run = (cmd) => { play('tap'); ref.current.focus(); document.execCommand(cmd); emit(); };

  return (
    <div className="rte">
      <div className="rte__bar" role="toolbar" aria-label="จัดรูปแบบข้อความ">
        {TOOLS.map((t) => (
          <button
            key={t.cmd} type="button" className="rte__btn" aria-label={t.label} title={t.label} aria-pressed={Boolean(active[t.cmd])}
            onMouseDown={(e) => e.preventDefault()} onClick={() => run(t.cmd)}
          >
            <span style={t.style} aria-hidden="true">{t.glyph}</span>
          </button>
        ))}
        {maxText ? <span className={`rte__count ${len > maxText ? 'rte__count--over' : ''}`}>{len}/{maxText}</span> : null}
      </div>
      <div
        id={id} ref={ref} className="rte__area rich" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
        aria-label={ariaLabel} data-placeholder={placeholder} style={{ minHeight }}
        onInput={emit} onBlur={emit}
        onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); }}
        onDrop={(e) => e.preventDefault()}
      />
    </div>
  );
}
