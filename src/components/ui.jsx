import { useEffect, useRef, useState } from 'react';
import { Icon, EmptyArt, LoadingArt } from './Decor.jsx';
import { play } from '../lib/sound.js';
import { useSite } from '../lib/site.jsx';
import { computeProgress, computeStatus, sortSteps } from '../lib/logic.js';

/* ----------------------------------------------------------------- Button */
export function Button({ variant, small, block, icon, sfx = 'tap', onClick, children, className = '', type = 'button', ...rest }) {
  const cls = ['btn', variant && `btn--${variant}`, small && 'btn--small', block && 'btn--block', className].filter(Boolean).join(' ');
  return (
    <button
      type={type}
      className={cls}
      onClick={(e) => { if (!rest.disabled && sfx) play(sfx); onClick?.(e); }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={18} className="btn__icon" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, onClick, sfx = 'tap', className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} onClick={(e) => { if (sfx) play(sfx); onClick?.(e); }} {...rest}>
      <Icon name={icon} size={20} />
    </button>
  );
}

/* ----------------------------------------------------------------- Modal */
export function Modal({ title, onClose, children, wide, labelledBy = 'modal-title' }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    play('open');
    const first = ref.current?.querySelector('[data-autofocus], button, a, input, textarea, select');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const a = f[0]; const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) { play('close'); onClose(); } }}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>
        <div className="modal__card">
          <IconButton icon="close" label="ปิดหน้าต่าง" className="modal__close" sfx="close" onClick={onClose} />
          {title ? <h3 id={labelledBy}>{title}</h3> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Confirmation before deleting anything important. */
export function ConfirmDialog({ title, message, confirmLabel = 'ลบเลย', busy, error, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      {error ? <Alert kind="error">{error}</Alert> : null}
      <div className="row row--end">
        <Button onClick={onCancel} sfx="close" disabled={busy}>ยกเลิก</Button>
        <Button variant="danger" icon="trash" onClick={onConfirm} disabled={busy} data-autofocus>{busy ? 'กำลังลบ…' : confirmLabel}</Button>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- feedback */
export function Alert({ kind = 'info', children }) {
  return (
    <div className={`alert ${kind === 'error' ? 'alert--error' : kind === 'ok' ? 'alert--ok' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'ok' ? 'check' : 'warn'} size={20} />
      <div>{children}</div>
    </div>
  );
}

export function Loading() {
  const { theme } = useSite() || {};
  return <LoadingArt motif={theme?.motif} />;
}

export function Empty({ title, children }) {
  const { theme } = useSite() || {};
  return (
    <div className="state">
      <EmptyArt motif={theme?.motif} />
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'โหลดข้อมูลไม่สำเร็จ' }) {
  return (
    <div className="state" role="alert">
      <Icon name="warn" size={42} />
      <h3>{title}</h3>
      <p>{error?.message || 'มีบางอย่างผิดพลาด ลองใหม่อีกครั้งนะ'}</p>
      {onRetry ? <Button variant="soft" onClick={onRetry}>ลองใหม่</Button> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- form bits */
export function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div className="field">
      {label ? <label htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <span className="error" role="alert">{error}</span> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- stars */
function StarShape({ filled, size }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M20 3 L25 14 L37 15.5 L28 24 L30.5 36 L20 30 L9.5 36 L12 24 L3 15.5 L15 14Z"
        fill={filled ? 'var(--butter)' : 'var(--paper2)'} stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

export function Stars({ value = 0, size = 22 }) {
  const full = Math.round(value);
  return (
    <span className="stars" role="img" aria-label={`${value} จาก 5 ดาว`}>
      {[1, 2, 3, 4, 5].map((n) => <StarShape key={n} filled={n <= full} size={size} />)}
    </span>
  );
}

export function StarInput({ value, onChange, id }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="ให้คะแนน" id={id}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ดาว`}
          onClick={() => { play('tap'); onChange(n); }}
        >
          <StarShape filled={n <= value} size={36} />
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- status + progress */
export function StatusBadge({ status, showOverride }) {
  return (
    <span className={`badge badge--${status.tone} ${status.overridden && showOverride ? 'badge--override' : ''}`}>
      {status.label}
      {status.overridden && showOverride ? <small>(ตั้งเอง)</small> : null}
    </span>
  );
}

/** Progress is ALWAYS derived from queue steps. There is no input for it anywhere. */
export function Progress({ item, steps }) {
  const ordered = sortSteps(steps);
  const prog = computeProgress(ordered);
  const status = computeStatus(item, ordered);
  const cls = status.key === 'completed' ? 'progress--done' : status.key === 'cancelled' ? 'progress--cancelled' : '';
  const nowIdx = ordered.findIndex((s) => !s.is_done);
  return (
    <div className={`progress ${cls}`}>
      <div className="progress__head">
        <span>ความคืบหน้า</span>
        <span>{prog.done} / {prog.total} ขั้นตอน ({prog.percent}%)</span>
      </div>
      <div className="progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.percent} aria-label="ความคืบหน้างาน">
        <div className="progress__fill" style={{ width: `${prog.percent}%` }} />
      </div>
      {ordered.length > 0 && (
        <div className="progress__steps" aria-hidden="true">
          {ordered.map((s, i) => <span key={s.id} className={`progress__dot ${s.is_done ? 'on' : i === nowIdx ? 'now' : ''}`} title={s.label} />)}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- misc hooks */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async (text) => {
    setFailed(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback for old / non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('copy failed');
      }
      play('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      return true;
    } catch {
      play('error');
      setFailed(true);
      return false;
    }
  };
  return { copy, copied, failed };
}
