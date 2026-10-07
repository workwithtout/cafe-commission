import { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, Link } from 'react-router-dom';
import { supabase, isSetupError } from '../../lib/supabase.js';
import { Alert, Button, Field, Loading } from '../../components/ui.jsx';
import { Icon } from '../../components/Decor.jsx';
import { useSubmit } from '../../lib/hooks.js';
import Dashboard from './Dashboard.jsx';
import ProfileAdmin from './ProfileAdmin.jsx';
import ServicesAdmin from './ServicesAdmin.jsx';
import QueueAdmin from './QueueAdmin.jsx';
import GalleryAdmin from './GalleryAdmin.jsx';
import ReviewsAdmin from './ReviewsAdmin.jsx';
import ContactsAdmin from './ContactsAdmin.jsx';
import ThemesAdmin from './ThemesAdmin.jsx';
import SettingsAdmin from './SettingsAdmin.jsx';
import { DbSetup } from '../Setup.jsx';

const TABS = [
  ['', 'Dashboard', true], ['profile', 'Profile'], ['services', 'Services'], ['queue', 'Queue'], ['gallery', 'Gallery'],
  ['reviews', 'Reviews'], ['contacts', 'Contact Links'], ['themes', 'Themes'], ['settings', 'Settings'],
];

function Login({ notAdmin, onSignOut }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submit, busy, error] = useSubmit(async () => {
    if (!email.trim() || !password) throw new Error('กรอกอีเมลและรหัสผ่านก่อนนะ');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  });

  return (
    <div className="shop-wrap">
      <div className="shop login">
        <section className="panel" style={{ marginTop: 10 }}>
          <span className="panel__label">Owner only</span>
          <h2 style={{ marginTop: 10 }}>เข้าสู่ระบบเจ้าของร้าน</h2>
          {notAdmin ? (
            <>
              <Alert kind="error">บัญชีนี้ไม่ได้รับสิทธิ์เป็นเจ้าของร้าน (ยังไม่อยู่ในตาราง admins) ดูขั้นตอน Admin Setup ใน README</Alert>
              <Button onClick={onSignOut} icon="logout">ออกจากระบบ</Button>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <Field label="อีเมล" htmlFor="ad-email"><input id="ad-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="รหัสผ่าน" htmlFor="ad-pw"><input id="ad-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              {error && <Alert kind="error">{error}</Alert>}
              <div className="row">
                <Button type="submit" variant="primary" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</Button>
                <Link className="btn" to="/">กลับหน้าร้าน</Link>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export default function AdminApp() {
  // phase: loading | out | notadmin | ok
  const [phase, setPhase] = useState('loading');
  const [email, setEmail] = useState('');

  const check = useCallback(async (session) => {
    if (!session) { setPhase('out'); return; }
    setEmail(session.user.email || '');
    // Real authorisation: ask the database (is_admin() reads the admins table). RLS enforces the same on every write.
    const { data, error } = await supabase.rpc('is_admin');
    if (error && isSetupError(error)) { setPhase('nodb'); return; }
    setPhase(!error && data === true ? 'ok' : 'notadmin');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { check(session); });
    return () => sub.subscription.unsubscribe();
  }, [check]);

  const signOut = async () => { await supabase.auth.signOut(); setPhase('out'); };

  if (phase === 'loading') return <div className="shop-wrap"><div className="shop"><Loading /></div></div>;
  if (phase === 'nodb') return <DbSetup onRetry={() => supabase.auth.getSession().then(({ data }) => check(data.session))} />;
  if (phase !== 'ok') return <Login notAdmin={phase === 'notadmin'} onSignOut={signOut} />;

  return (
    <div className="admin">
      <div className="admin__bar">
        <h1>หลังบ้านร้านขนม</h1>
        <div className="row">
          <small>{email}</small>
          <Link className="btn btn--small" to="/"><Icon name="external" size={16} /> ดูหน้าร้าน</Link>
          <Button small icon="logout" onClick={signOut}>ออกจากระบบ</Button>
        </div>
      </div>
      <nav className="admin-nav" aria-label="เมนูหลังบ้าน">
        {TABS.map(([to, label, end]) => (
          <NavLink key={to} to={`/admin/${to}`} end={Boolean(end)} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<ProfileAdmin />} />
        <Route path="services" element={<ServicesAdmin />} />
        <Route path="queue" element={<QueueAdmin />} />
        <Route path="gallery" element={<GalleryAdmin />} />
        <Route path="reviews" element={<ReviewsAdmin />} />
        <Route path="contacts" element={<ContactsAdmin />} />
        <Route path="themes" element={<ThemesAdmin />} />
        <Route path="settings" element={<SettingsAdmin />} />
      </Routes>
    </div>
  );
}
