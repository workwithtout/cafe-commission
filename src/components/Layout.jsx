import { useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useSite } from '../lib/site.jsx';
import { Awning, Bow, Sticker, AccentSticker, Icon, Sparkle } from './Decor.jsx';
import { Loading, ErrorState, Button } from './ui.jsx';
import { DbSetup } from '../pages/Setup.jsx';
import { isSetupError } from '../lib/supabase.js';
import { PROFILE_STATUS, effectiveProfileStatus } from '../lib/logic.js';
import { play, sfxPreference, setSfxPreference } from '../lib/sound.js';
import { RichText } from './RichText.jsx';
import { useState } from 'react';

const NAV = [
  { to: '/', label: 'หน้าแรก', end: true },
  { to: '/services', label: 'เมนูงาน' },
  { to: '/queue', label: 'คิวงาน' },
  { to: '/gallery', label: 'แกลลอรี่' },
  { to: '/reviews', label: 'รีวิว' },
  { to: '/contact', label: 'ช่องทางติดต่อ' },
];

/** A decorative sticker pinned to the page. Uses uploaded sticker art if the theme provides it. */
export function Pin({ index = 0, size = 54, style, className = '' }) {
  const { theme } = useSite();
  const url = theme.stickerUrls[index % Math.max(theme.stickerUrls.length, 1)];
  if (url) return <img src={url} alt="" width={size} style={{ ...style, width: size, height: 'auto' }} className={`sticker-pin ${className}`} />;
  return <span className={`sticker-pin ${className}`} style={style}><Sticker index={index} motif={theme.motif} size={size} /></span>;
}

export function ContactButtons({ contacts, small, className = '' }) {
  if (!contacts?.length) return null;
  return (
    <>
      {contacts.map((c) => (
        <a
          key={c.id}
          className={`btn btn--soft ${small ? 'btn--small' : ''} ${className}`}
          href={c.url}
          target={c.url.startsWith('mailto:') ? undefined : '_blank'}
          rel="noopener noreferrer"
          onClick={() => play('tap')}
        >
          <Icon name={c.icon} size={18} className="btn__icon" />
          {c.name}
        </a>
      ))}
    </>
  );
}

function Dock() {
  const { settings } = useSite();
  const [sfxOn, setSfxOn] = useState(sfxPreference());
  if (settings?.sfx_enabled === false) return null;

  return (
    <div className="dock" role="group" aria-label="เสียง">
      <button
        type="button" className="icon-btn" aria-pressed={sfxOn}
        aria-label={sfxOn ? 'ปิดเสียงปุ่ม' : 'เปิดเสียงปุ่ม'} title={sfxOn ? 'ปิดเสียงปุ่ม' : 'เปิดเสียงปุ่ม'}
        onClick={() => { const next = !sfxOn; setSfxOn(next); setSfxPreference(next); if (next) setTimeout(() => play('tap'), 30); }}
      >
        <Icon name={sfxOn ? 'sound' : 'soundOff'} size={20} />
      </button>
    </div>
  );
}

export default function Layout() {
  const site = useSite();
  const loc = useLocation();

  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);

  if (site.loading && !site.data) return <div className="shop-wrap"><div className="shop"><Loading /></div></div>;
  if (site.error && !site.data) {
    if (isSetupError(site.error)) return <DbSetup onRetry={site.reload} />;
    return (
      <div className="shop-wrap"><div className="shop">
        <ErrorState error={site.error} onRetry={site.reload} title="เปิดร้านไม่สำเร็จ" />
      </div></div>
    );
  }

  const { profile, services = [], contacts = [], settings, theme } = site;
  const status = PROFILE_STATUS[effectiveProfileStatus(profile, services)];
  const shopName = settings?.shop_name || 'Artist Café';

  return (
    <div className="shop-wrap">
      <div className="shop">
        {/* ---------- shop front ---------- */}
        <div className="front">
          <Awning />
          <div className="front__side front__side--l float-a"><Pin index={0} size={58} /></div>
          <div className="front__side front__side--r float-b"><Pin index={1} size={62} /></div>
          <header className="sign">
            <span className="sign__deco sign__deco--l" aria-hidden="true"><Bow size={34} /></span>
            <div className="sign__name">{shopName}</div>
            <div className="sign__tag">{profile?.tagline || 'Commission & Portfolio'}</div>
            <span className="sign__deco sign__deco--r" aria-hidden="true"><Sparkle size={26} /></span>
          </header>
        </div>
        {theme.headerImage ? <div className="header-banner"><img src={theme.headerImage} alt="" /></div> : null}

        {/* ---------- profile (always on top) ---------- */}
        <section className="panel panel--check" aria-label="โปรไฟล์ร้าน" style={{ marginTop: 22 }}>
          <span className="panel__label">About me</span>
          <div className="profile" style={{ marginTop: 8 }}>
            <div className="profile__photo">
              <div className="avatar">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt={`รูปโปรไฟล์ของ ${profile?.display_name || 'เจ้าของร้าน'}`} />
                  : <div className="avatar__ph"><AccentSticker motif={theme.motif} size={70} /></div>}
                <span className="avatar__bow"><Bow size={48} /></span>
                <span className="avatar__sticker"><Pin index={2} size={44} /></span>
              </div>
              <span className={`badge badge--${status.tone}`} aria-label={`สถานะ: ${status.label}`}>{status.label}</span>
            </div>
            <div className="profile__info">
              <h1>{profile?.display_name || 'Artist'}</h1>
              {profile?.handle ? <div className="profile__handle">{profile.handle}</div> : null}
              <RichText value={profile?.bio} className="profile__bio" />
              <ContactButtons contacts={contacts} small className="profile__link" />
              <div className="profile__links" style={{ display: 'none' }} />
            </div>
          </div>
          <div className="lace" aria-hidden="true" style={{ marginTop: 14 }} />
        </section>

        {/* ---------- horizontal nav (below profile) ---------- */}
        <nav className="nav" aria-label="เมนูหลัก">
          <span className="nav__hint" aria-hidden="true"><Icon name="arrowLeft" size={16} /></span>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => play('nav')} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
          <span className="nav__hint" aria-hidden="true"><Icon name="arrowRight" size={16} /></span>
        </nav>

        {/* ---------- page ---------- */}
        <main key={loc.pathname} className="page-enter" id="main">
          <Outlet />
        </main>

        {/* ---------- footer ---------- */}
        <footer className="footer">
          <div className="stitch" aria-hidden="true" />
          <div className="footer__band">
            <span className="footer__pill">{shopName} · {profile?.display_name}</span>
            <div className="footer__row" aria-hidden="true">
              <Pin index={0} size={34} className="float-c" style={{ position: 'static' }} />
              <Pin index={1} size={34} className="float-a" style={{ position: 'static' }} />
              <Pin index={2} size={34} className="float-b" style={{ position: 'static' }} />
            </div>
          </div>
          <p style={{ marginTop: 10 }}>
            <Link className="admin-link" to="/admin">เจ้าของร้าน</Link>
          </p>
        </footer>
      </div>
      <Dock />
    </div>
  );
}
