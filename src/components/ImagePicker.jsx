import { useEffect, useRef, useState } from 'react';
import ImageEditor from './ImageEditor.jsx';
import { Button } from './ui.jsx';
import { Icon } from './Decor.jsx';
import { useSite } from '../lib/site.jsx';
import { checkSourceFile, fmtBytes, prepareWatermark, watermarkConfigFor } from '../lib/imageTools.js';
import { play } from '../lib/sound.js';

/** Frame shapes offered in the editor. ratio = width / height; null = keep the picture's own shape. */
export const SHAPES = {
  square: { key: 'square', label: 'จัตุรัส 1:1', ratio: 1 },
  card: { key: 'card', label: 'แนวนอน 4:3', ratio: 4 / 3 },
  portrait: { key: 'portrait', label: 'แนวตั้ง 3:4', ratio: 3 / 4 },
  wide: { key: 'wide', label: 'จอกว้าง 16:9', ratio: 16 / 9 },
  banner: { key: 'banner', label: 'แบนเนอร์ 4:1', ratio: 4 },
  original: { key: 'original', label: 'ตามสัดส่วนรูปเดิม', ratio: null },
};

/**
 * Picks a file, opens the editor, and gives back the finished (cropped + resized + watermarked) File.
 * Shared by the picture field and by lists of pictures (theme stickers).
 */
export function useImageIntake({ choices, defaultChoice, round, maxSide, watermarkKind, onResult }) {
  const { settings } = useSite();
  const [pending, setPending] = useState(null);   // { file, watermark }
  const [error, setError] = useState('');

  const start = async (file) => {
    setError('');
    if (!file) return;
    const bad = checkSourceFile(file);   // not an image, or over the 50 MB hard limit: stop here, nothing is uploaded
    if (bad) { play('error'); setError(bad); return; }
    try {
      const wm = await prepareWatermark(watermarkConfigFor(settings, watermarkKind));
      setPending({ file, watermark: wm.cfg ? wm : null });
    } catch (e) { play('error'); setError(e.message); }
  };

  const editor = pending ? (
    <ImageEditor
      file={pending.file} choices={choices} defaultChoice={defaultChoice} round={round} maxSide={maxSide} watermark={pending.watermark}
      onCancel={() => setPending(null)}
      onDone={(out) => { const src = pending.file; setPending(null); onResult(out.file, src); }}
    />
  ) : null;
  return { start, editor, error, clearError: () => setError(''), reopen: (file) => start(file) };
}

/**
 * "Drag a picture here, or choose a file" field with preview.
 * Nothing is uploaded here: the finished picture is kept in `value.file` and uploaded when the form is saved
 * (see commitImage in admin/common.jsx), so cancelling a form never leaves stray files behind.
 *
 * value = { url, file?, source?, preview?, removed? }
 */
export function ImagePicker({
  label = 'รูปภาพ', value, onChange, required, choices = [SHAPES.square], defaultChoice, round = false, maxSide = 1600, watermark, hint,
}) {
  const input = useRef(null);
  const previewRef = useRef(null);
  const [over, setOver] = useState(false);
  const [info, setInfo] = useState('');

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const intake = useImageIntake({
    choices, defaultChoice, round, maxSide, watermarkKind: watermark,
    onResult: (file, source) => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = URL.createObjectURL(file);
      setInfo(source && source.size > file.size && source.size > 5 * 1024 * 1024
        ? `บีบอัดอัตโนมัติแล้ว ${fmtBytes(source.size)} → ${fmtBytes(file.size)}`
        : `ขนาดไฟล์ที่จะอัปโหลด ${fmtBytes(file.size)}`);
      onChange({ ...value, file, source, preview: previewRef.current, removed: false });
    },
  });

  const shown = value?.preview || (!value?.removed ? value?.url : '') || '';
  const choose = (e) => { const f = e.target.files?.[0]; e.target.value = ''; intake.start(f); };
  const onDrop = (e) => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) intake.start(f);
  };

  return (
    <div className="field">
      <span className="field__label">{label}{required ? ' *' : ''}</span>
      <div
        className={`dropzone ${over ? 'dropzone--over' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
        onDrop={onDrop}
      >
        <div className={`dropzone__thumb ${round ? 'dropzone__thumb--round' : ''}`}>
          {shown ? <img src={shown} alt="ตัวอย่างรูปที่เลือก" /> : <Icon name="image" size={34} />}
        </div>
        <div className="dropzone__body">
          <input ref={input} type="file" hidden accept="image/*" onChange={choose} />
          <button type="button" className="dropzone__pick" onClick={() => input.current?.click()}>
            <Icon name="upload" size={22} />
            <span>
              <b className="dz-drag">ลากรูปมาวางที่นี่</b><b className="dz-tap">แตะเพื่อเลือกรูป</b>
              <span className="dz-drag"> หรือกดเพื่อเลือกไฟล์</span>
            </span>
          </button>
          <small>{hint || 'เลือกรูปแล้วจะมีหน้าจัดตำแหน่ง ซูม และตัดรูปก่อนอัปโหลดจริง · รูปที่ใหญ่เกิน 5 MB จะถูกบีบอัดให้อัตโนมัติ (ไฟล์ต้นฉบับไม่เกิน 50 MB)'}</small>
          <div className="actions">
            {value?.source && <Button small icon="edit" onClick={() => intake.reopen(value.source)}>จัดรูปอีกครั้ง</Button>}
            {(shown || value?.file) && !required && (
              <Button small variant="danger" icon="trash" onClick={() => { if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; } setInfo(''); onChange({ url: '', path: '', file: null, source: null, preview: '', removed: true }); }}>ลบรูป</Button>
            )}
          </div>
        </div>
      </div>
      {info && value?.file && <small className="dropzone__info" role="status">{info}</small>}
      {intake.error && <span className="error" role="alert">{intake.error}</span>}
      {intake.editor}
    </div>
  );
}
