import { useEffect, useState } from 'react';
import { applyTheme, resolveTheme } from '../lib/site.jsx';
import { sqlEditorUrl } from '../lib/supabase.js';
import { loadMigrationSql } from '../lib/migrations.js';
import { Button, Alert } from '../components/ui.jsx';
import { useCopy } from '../components/ui.jsx';

// Shown only when the site is not connected yet (before the owner has finished setup).
// Uses the same panel look as the rest of the site and the default palette.
function usePalette() {
  useEffect(() => { applyTheme(resolveTheme(null)); }, []);
}

const PROBLEMS = {
  missing_url: 'ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL',
  bad_url: 'ค่า VITE_SUPABASE_URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย https:// และลงท้ายด้วย .supabase.co',
  missing_key: 'ยังไม่ได้ตั้งค่า VITE_SUPABASE_ANON_KEY',
  secret_key: 'ค่าที่ใส่เป็น Secret key / service_role ซึ่งห้ามใช้ในเว็บ กรุณาใช้ Publishable key (หรือ anon key) แทน และควรสร้าง Secret key ใหม่ในหน้า Supabase',
};

export function EnvSetup({ problem }) {
  usePalette();
  return (
    <div className="shop-wrap">
      <div className="shop">
        <section className="panel" style={{ marginTop: 22 }}>
          <span className="panel__label">Setup</span>
          <h2 style={{ marginTop: 10 }}>ยังไม่ได้เชื่อมต่อ Supabase</h2>
          {problem && <Alert kind="error">{PROBLEMS[problem]}</Alert>}
          <p>ไปที่ Vercel &rarr; โปรเจกต์ของคุณ &rarr; Settings &rarr; Environment Variables แล้วเพิ่ม 2 ค่านี้:</p>
          <pre style={{ background: 'var(--paper2)', padding: 12, borderRadius: 12, overflowX: 'auto' }}>
{`VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY`}
          </pre>
          <p>ค่าทั้งสองอยู่ใน Supabase &rarr; Project Settings &rarr; API Keys (ใช้ Publishable key ห้ามใช้ Secret key) จากนั้นไปที่ Deployments แล้วกด Redeploy เพื่อให้ค่าใหม่มีผล</p>
        </section>
      </div>
    </div>
  );
}

export function DbSetup({ onRetry }) {
  usePalette();
  const { copy, copied, failed } = useCopy();
  const [sql, setSql] = useState('');
  useEffect(() => { loadMigrationSql().then(setSql); }, []);
  return (
    <div className="shop-wrap">
      <div className="shop">
        <section className="panel" style={{ marginTop: 22 }}>
          <span className="panel__label">Setup</span>
          <h2 style={{ marginTop: 10 }}>เชื่อมต่อแล้ว แต่ฐานข้อมูลยังว่างอยู่</h2>
          <p>ต้องสร้างตารางของร้านก่อน 1 ครั้ง ทำตามนี้:</p>
          <ol>
            <li>กด “คัดลอก SQL” ด้านล่าง</li>
            <li>เปิด SQL Editor ของ Supabase แล้ววาง</li>
            <li>กด Run แล้วกลับมากด “ตรวจอีกครั้ง”</li>
          </ol>
          <div className="row">
            <Button variant="primary" icon="copy" disabled={!sql} onClick={() => copy(sql)}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก SQL'}</Button>
            <a className="btn" href={sqlEditorUrl()} target="_blank" rel="noreferrer">เปิด SQL Editor</a>
            <Button variant="soft" onClick={onRetry}>ตรวจอีกครั้ง</Button>
          </div>
          {failed && <Alert kind="error">คัดลอกไม่สำเร็จ ลองกดค้างที่กล่องด้านล่างแล้วเลือกคัดลอกเอง</Alert>}
          <textarea readOnly value={sql} rows={6} aria-label="SQL สำหรับสร้างฐานข้อมูล" style={{ width: '100%', marginTop: 12, fontFamily: 'monospace', fontSize: 12 }} onFocus={(e) => e.target.select()} />
        </section>
      </div>
    </div>
  );
}
