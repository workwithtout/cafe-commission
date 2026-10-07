// Hand-built SVG decoration. Nothing here is an emoji: every sticker, ribbon and bakery item is drawn.
// Colours come from CSS variables, so each theme recolours the same drawings AND swaps in
// completely different motifs (strawberry / matcha / chocolate).

const S = 'var(--ink)';       // sketchy outline colour
const sw = 2.2;               // outline width

/* ------------------------------------------------------------------ */
/* Generic pieces                                                      */
/* ------------------------------------------------------------------ */
export function Bow({ size = 64, className = '', style }) {
  return (
    <svg viewBox="0 0 80 60" width={size} height={(size * 60) / 80} className={className} style={style} aria-hidden="true">
      <path d="M40 30 C28 8 6 6 6 24 C6 42 28 46 40 30Z" fill="var(--ribbon)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M40 30 C52 8 74 6 74 24 C74 42 52 46 40 30Z" fill="var(--ribbon)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M16 20 C22 16 28 18 32 24 M64 20 C58 16 52 18 48 24" fill="none" stroke="var(--ribbon-hi)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M36 34 L28 56 L38 50 L40 58 L42 50 L52 56 L44 34Z" fill="var(--ribbon)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <rect x="33" y="22" width="14" height="16" rx="6" fill="var(--ribbon-dark)" stroke={S} strokeWidth={sw} />
    </svg>
  );
}

export function Star({ size = 28, className = '', style }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path d="M20 3 L25 14 L37 15.5 L28 24 L30.5 36 L20 30 L9.5 36 L12 24 L3 15.5 L15 14Z" fill="var(--butter)" stroke={S} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Heart({ size = 26, className = '', style, fill = 'var(--c-main)' }) {
  return (
    <svg viewBox="0 0 40 36" width={size} height={(size * 36) / 40} className={className} style={style} aria-hidden="true">
      <path d="M20 33 C6 22 2 15 2 10 C2 5 6 2 10.5 2 C14.5 2 18 4.5 20 8 C22 4.5 25.5 2 29.5 2 C34 2 38 5 38 10 C38 15 34 22 20 33Z" fill={fill} stroke={S} strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 9 C10 7 12 6.5 14 7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

export function Sparkle({ size = 20, className = '', style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path d="M12 1 C12.8 8 16 11.2 23 12 C16 12.8 12.8 16 12 23 C11.2 16 8 12.8 1 12 C8 11.2 11.2 8 12 1Z" fill="var(--c-cream)" stroke={S} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Key({ size = 44, className = '', style }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} className={className} style={style} aria-hidden="true">
      <circle cx="20" cy="20" r="12" fill="var(--butter)" stroke={S} strokeWidth={sw} />
      <circle cx="20" cy="20" r="5" fill="var(--paper)" stroke={S} strokeWidth="1.6" />
      <path d="M29 29 L52 52 M42 42 L48 36 M47 47 L53 41" stroke={S} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d="M29 29 L52 52" stroke="var(--butter)" strokeWidth="3.4" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Motif stickers                                                      */
/* ------------------------------------------------------------------ */
function Strawberry({ size = 56, style, className }) {
  return (
    <svg viewBox="0 0 60 66" width={size} height={(size * 66) / 60} style={style} className={className} aria-hidden="true">
      <path d="M30 60 C10 50 4 34 8 24 C12 14 24 16 30 20 C36 16 48 14 52 24 C56 34 50 50 30 60Z" fill="var(--c-main)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      {[[20, 30], [30, 36], [40, 30], [24, 44], [36, 44], [30, 52]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.8" ry="2.6" fill="var(--butter)" stroke={S} strokeWidth="1" />
      ))}
      <path d="M30 20 C24 8 14 12 18 18 C20 20 26 20 30 20 C34 20 40 20 42 18 C46 12 36 8 30 20Z" fill="var(--leaf)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M30 20 L30 8" stroke={S} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

function CakeSlice({ size = 64, style, className }) {
  return (
    <svg viewBox="0 0 70 60" width={size} height={(size * 60) / 70} style={style} className={className} aria-hidden="true">
      <path d="M6 50 L6 28 L56 16 L64 28 L64 50 Z" fill="var(--c-cream)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M6 28 L56 16 L64 28 Z" fill="var(--c-main-soft)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M6 28 C10 36 14 36 18 28 C22 36 26 36 30 28 C34 36 38 36 42 28 C46 36 50 36 54 28 C58 36 62 36 64 28" fill="var(--c-main-soft)" stroke={S} strokeWidth={sw} />
      <path d="M6 40 L64 40" stroke={S} strokeWidth="1.6" strokeDasharray="4 3" />
      <circle cx="46" cy="14" r="6" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
      <path d="M46 8 L46 4" stroke={S} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Cupcake({ size = 52, style, className }) {
  return (
    <svg viewBox="0 0 56 62" width={size} height={(size * 62) / 56} style={style} className={className} aria-hidden="true">
      <path d="M10 30 L16 58 L40 58 L46 30Z" fill="var(--c-accent)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M20 32 L22 56 M28 32 L28 56 M36 32 L34 56" stroke={S} strokeWidth="1.4" opacity=".5" />
      <path d="M8 32 C2 22 12 16 16 18 C14 8 28 4 32 10 C40 6 48 14 42 20 C52 22 50 32 46 32Z" fill="var(--c-cream)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <circle cx="28" cy="6" r="5" fill="var(--c-main)" stroke={S} strokeWidth="2" />
    </svg>
  );
}

function Cookie({ size = 52, style, className }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} style={style} className={className} aria-hidden="true">
      <path d="M30 4 C36 4 38 8 44 9 C50 10 52 14 52 20 C56 24 56 32 52 38 C52 46 46 52 40 52 C34 58 26 58 20 52 C12 52 6 46 8 38 C2 32 4 24 8 20 C8 12 14 8 20 8 C24 4 26 4 30 4Z" fill="var(--c-main-soft)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      {[[22, 20], [36, 18], [30, 32], [18, 38], [42, 36], [32, 46]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="4" ry="3.2" fill="var(--c-main)" stroke={S} strokeWidth="1.4" />
      ))}
    </svg>
  );
}

function ChocoBar({ size = 56, style, className }) {
  return (
    <svg viewBox="0 0 60 56" width={size} height={(size * 56) / 60} style={style} className={className} aria-hidden="true">
      <rect x="8" y="12" width="44" height="40" rx="5" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <rect key={`${r}${c}`} x={12 + c * 13.5} y={16 + r * 11.5} width="11" height="9" rx="2" fill="var(--c-main-soft)" stroke={S} strokeWidth="1.2" />
      )))}
      <path d="M8 12 L8 4 L44 4 L52 12" fill="var(--c-cream)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
  );
}

function MatchaLeaf({ size = 56, style, className }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} style={style} className={className} aria-hidden="true">
      <path d="M8 52 C4 22 26 4 54 6 C56 34 38 56 8 52Z" fill="var(--c-main)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M8 52 C22 38 34 26 48 12 M24 38 L26 22 M32 30 L46 32 M18 46 L8 38" stroke="var(--c-main-soft)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Mochi({ size = 56, style, className }) {
  return (
    <svg viewBox="0 0 64 54" width={size} height={(size * 54) / 64} style={style} className={className} aria-hidden="true">
      <path d="M6 42 C2 24 18 8 32 8 C46 8 62 24 58 42 C58 50 48 50 32 50 C16 50 6 50 6 42Z" fill="var(--c-cream)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M12 32 C20 26 44 26 52 32 C44 38 20 38 12 32Z" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
      <circle cx="24" cy="36" r="2.2" fill={S} /><circle cx="40" cy="36" r="2.2" fill={S} />
      <path d="M29 40 Q32 43 35 40" fill="none" stroke={S} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Teacup({ size = 58, style, className }) {
  return (
    <svg viewBox="0 0 64 56" width={size} height={(size * 56) / 64} style={style} className={className} aria-hidden="true">
      <path d="M8 24 L52 24 C52 44 44 50 30 50 C16 50 8 44 8 24Z" fill="var(--c-cream)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M52 28 C62 26 62 40 50 40" fill="none" stroke={S} strokeWidth={sw} />
      <ellipse cx="30" cy="24" rx="22" ry="5" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
      <path d="M22 14 C18 10 26 8 22 2 M34 14 C30 10 38 8 34 2" fill="none" stroke={S} strokeWidth="2" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

function Bean({ size = 44, style, className }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={style} className={className} aria-hidden="true">
      <ellipse cx="24" cy="24" rx="15" ry="20" transform="rotate(35 24 24)" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
      <path d="M12 12 C22 20 24 30 36 38" fill="none" stroke="var(--c-main-soft)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Bamboo({ size = 40, style, className }) {
  return (
    <svg viewBox="0 0 30 64" width={size} height={(size * 64) / 30} style={style} className={className} aria-hidden="true">
      {[2, 24, 46].map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="14" height="20" rx="3" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
          <path d={`M6 ${y + 20} L24 ${y + 20}`} stroke={S} strokeWidth={sw} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/* ---- blue / yellow / oreo motifs (original drawings, recoloured by the theme) ---- */
function Cloud({ size = 56, style, className }) {
  return (
    <svg viewBox="0 0 64 44" width={size} height={(size * 44) / 64} style={style} className={className} aria-hidden="true">
      <path d="M16 38 C6 38 4 26 13 24 C12 14 24 10 29 18 C33 8 50 12 49 24 C60 24 60 38 50 38Z" fill="var(--c-cream)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M16 31 C20 29 24 29 27 31" fill="none" stroke="var(--c-main-soft)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Drop({ size = 40, style, className }) {
  return (
    <svg viewBox="0 0 40 52" width={size} height={(size * 52) / 40} style={style} className={className} aria-hidden="true">
      <path d="M20 4 C26 16 35 24 35 33 C35 42 28 48 20 48 C12 48 5 42 5 33 C5 24 14 16 20 4Z" fill="var(--c-main)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M13 32 C13 38 17 41 21 41" fill="none" stroke="var(--c-main-soft)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function Snow({ size = 44, style, className }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={style} className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="19" fill="var(--c-main-soft)" stroke={S} strokeWidth={sw} />
      <path d="M24 9 V39 M11 16.5 L37 31.5 M37 16.5 L11 31.5" stroke={S} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="24" r="5" fill="var(--c-cream)" stroke={S} strokeWidth="2" />
    </svg>
  );
}

function Sun({ size = 52, style, className }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} style={style} className={className} aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <path key={i} d="M30 3 L34 13 L26 13Z" transform={`rotate(${i * 36} 30 30)`} fill="var(--c-main-dark)" stroke={S} strokeWidth="1.6" strokeLinejoin="round" />
      ))}
      <circle cx="30" cy="30" r="14" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
      <path d="M23 29 C24 25 27 23 31 23" fill="none" stroke="var(--c-cream)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Lemon({ size = 54, style, className }) {
  return (
    <svg viewBox="0 0 64 48" width={size} height={(size * 48) / 64} style={style} className={className} aria-hidden="true">
      <path d="M6 24 C6 14 18 8 32 8 C46 8 58 14 58 24 C58 34 46 40 32 40 C18 40 6 34 6 24Z" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
      <path d="M2 24 L8 22 M62 24 L56 22" stroke={S} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17 18 C22 14 28 13 34 13" fill="none" stroke="var(--c-cream)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M44 10 C48 4 54 4 58 6 C54 10 50 12 44 10Z" fill="var(--leaf)" stroke={S} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function Daisy({ size = 48, style, className }) {
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} style={style} className={className} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <ellipse key={i} cx="28" cy="13" rx="6" ry="10" transform={`rotate(${i * 45} 28 28)`} fill="var(--c-cream)" stroke={S} strokeWidth="1.8" />
      ))}
      <circle cx="28" cy="28" r="8" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
    </svg>
  );
}

function OreoCookie({ size = 54, style, className }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} style={style} className={className} aria-hidden="true">
      <circle cx="30" cy="30" r="25" fill="var(--c-main)" stroke={S} strokeWidth={sw} />
      <circle cx="30" cy="30" r="19" fill="none" stroke="var(--c-main-soft)" strokeWidth="2" strokeDasharray="3 3.5" />
      <path d="M30 17 L33 26 L43 26 L35 32 L38 42 L30 36 L22 42 L25 32 L17 26 L27 26Z" fill="var(--c-cream)" stroke="var(--c-cream)" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function MilkGlass({ size = 44, style, className }) {
  return (
    <svg viewBox="0 0 44 58" width={size} height={(size * 58) / 44} style={style} className={className} aria-hidden="true">
      <path d="M6 6 H38 L34 52 C34 54 32 55 30 55 H14 C12 55 10 54 10 52Z" fill="var(--c-cream)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M8.5 20 H35.5 L33.5 48 H10.5Z" fill="var(--lace)" stroke="none" />
      <path d="M12 12 L13.5 44" stroke="var(--c-accent)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function CreamSwirl({ size = 46, style, className }) {
  return (
    <svg viewBox="0 0 50 50" width={size} height={size} style={style} className={className} aria-hidden="true">
      <path d="M10 40 C4 40 4 30 12 30 C8 22 16 18 22 22 C24 12 38 12 38 22 C46 22 46 34 38 36 C40 42 32 44 28 42 C22 46 14 46 10 40Z" fill="var(--c-cream)" stroke={S} strokeWidth={sw} strokeLinejoin="round" />
      <circle cx="25" cy="29" r="4" fill="var(--c-main-soft)" stroke={S} strokeWidth="1.6" />
    </svg>
  );
}

export const MOTIFS = {
  strawberry: { stickers: [Strawberry, CakeSlice, Cupcake], accent: Cupcake, label: 'สตรอว์เบอร์รี' },
  matcha:     { stickers: [MatchaLeaf, Mochi, Teacup, Bamboo], accent: Mochi, label: 'มัทฉะ' },
  chocolate:  { stickers: [Cookie, ChocoBar, Bean], accent: Cookie, label: 'ช็อกโกแลต' },
  blue:       { stickers: [Cloud, Drop, Snow], accent: Cloud, label: 'ฟ้าครามใส' },
  yellow:     { stickers: [Sun, Lemon, Daisy], accent: Sun, label: 'เหลืองสดใส' },
  oreo:       { stickers: [OreoCookie, MilkGlass, CreamSwirl], accent: OreoCookie, label: 'คุกกี้แอนด์ครีม (Oreo)' },
};

export function Sticker({ index = 0, motif = 'strawberry', size, className = '', style }) {
  const set = (MOTIFS[motif] || MOTIFS.strawberry).stickers;
  const C = set[index % set.length];
  return <C size={size} className={className} style={style} />;
}

export function AccentSticker({ motif = 'strawberry', size, className, style }) {
  const C = (MOTIFS[motif] || MOTIFS.strawberry).accent;
  return <C size={size} className={className} style={style} />;
}

/* ------------------------------------------------------------------ */
/* Shop awning (header)                                                */
/* ------------------------------------------------------------------ */
export function Awning() {
  const stripes = Array.from({ length: 12 });
  return (
    <svg className="awning" viewBox="0 0 600 70" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="600" height="38" fill="var(--awning-a)" />
      {stripes.map((_, i) => (
        <g key={i}>
          {i % 2 === 0 && <rect x={i * 50} y="0" width="50" height="38" fill="var(--awning-b)" />}
          <path
            d={`M${i * 50} 38 Q${i * 50 + 25} 74 ${i * 50 + 50} 38Z`}
            fill={i % 2 === 0 ? 'var(--awning-b)' : 'var(--awning-a)'}
            stroke={S} strokeWidth="2.2"
          />
        </g>
      ))}
      <path d="M0 1 L600 1" stroke={S} strokeWidth="3" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Little decorative dividers                                          */
/* ------------------------------------------------------------------ */
export function Stitch() {
  return <div className="stitch" aria-hidden="true" />;
}

export function SectionTitle({ children, motif, sub }) {
  return (
    <div className="section-title">
      <span className="section-title__ribbon" aria-hidden="true"><Bow size={34} /></span>
      <h2>{children}</h2>
      <span className="section-title__sticker" aria-hidden="true"><AccentSticker motif={motif} size={34} /></span>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (UI + contact). All SVG.                                      */
/* ------------------------------------------------------------------ */
const ico = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const ICONS = {
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...ico} />,
  twitter: <path d="M4 4l16 16M20 4L4 20" {...ico} />,
  facebook: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" {...ico} />,
  instagram: (<g {...ico}><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r=".6" /></g>),
  discord: (<g {...ico} transform="translate(12 12.2) scale(1.12) translate(-12 -11.4)"><path d="M7.8 5.6C9.1 5.2 10.5 5 12 5s2.9.2 4.2.6c1.8 2.7 2.8 5.7 3 9.1-1.4 1.1-3 1.9-4.6 2.4l-1-1.7c-.7.2-1.1.2-1.6.2s-.9 0-1.6-.2l-1 1.7c-1.6-.5-3.2-1.3-4.6-2.4.2-3.4 1.2-6.4 3-9.1z" /><circle cx="9.2" cy="11.3" r="1.15" /><circle cx="14.8" cy="11.3" r="1.15" /></g>),
  email: (<g {...ico}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M4 7l8 6 8-6" /></g>),
  tiktok: <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.4 2.6 2 4 5 4.2" {...ico} />,
  line: (<g {...ico}><path d="M12 4C7 4 3.5 7 3.5 10.6c0 3 2.4 5.4 5.8 6.2l-.4 2.6 3.4-2.2c4.6-.2 8.2-3 8.2-6.6C20.5 7 17 4 12 4z" /></g>),
  web: (<g {...ico}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></g>),
  sound: <path d="M4 10v4h3l5 4V6L7 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" {...ico} />,
  soundOff: <path d="M4 10v4h3l5 4V6L7 10H4zM16 9l5 6M21 9l-5 6" {...ico} />,
  play: <path d="M8 5l11 7-11 7V5z" {...ico} fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" {...ico} strokeWidth="3.4" />,
  image: (<g {...ico}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M4 18l5-5 4 4 3-3 4 4" /></g>),
  clock: (<g {...ico}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></g>),
  copy: (<g {...ico}><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></g>),
  close: <path d="M6 6l12 12M18 6L6 18" {...ico} strokeWidth="3" />,
  check: <path d="M5 13l4 4L19 7" {...ico} strokeWidth="3" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" {...ico} />,
  trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" {...ico} />,
  plus: <path d="M12 5v14M5 12h14" {...ico} strokeWidth="3" />,
  minus: <path d="M5 12h14" {...ico} strokeWidth="3" />,
  upload: (<g {...ico}><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></g>),
  reset: (<g {...ico}><path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" /><path d="M4 4.5v4h4" /></g>),
  pin: <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7" {...ico} />,
  up: <path d="M6 14l6-6 6 6" {...ico} strokeWidth="3" />,
  down: <path d="M6 10l6 6 6-6" {...ico} strokeWidth="3" />,
  eye: (<g {...ico}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></g>),
  eyeOff: <path d="M3 3l18 18M10 6c.6-.1 1.3-.2 2-.2 6 0 10 7 10 7s-1.2 2-3.2 3.7M6.5 7.5C3.8 9.3 2 12 2 12s4 7 10 7c1.6 0 3-.4 4.3-1" {...ico} />,
  arrowLeft: <path d="M15 5l-7 7 7 7" {...ico} strokeWidth="3" />,
  arrowRight: <path d="M9 5l7 7-7 7" {...ico} strokeWidth="3" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" {...ico} />,
  logout: <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" {...ico} />,
  warn: <path d="M12 4l9 16H3L12 4zM12 10v4M12 17v.5" {...ico} />,
};

export const CONTACT_ICON_KEYS = ['link', 'twitter', 'facebook', 'instagram', 'discord', 'email', 'tiktok', 'line', 'web'];

export function Icon({ name = 'link', size = 20, className = '', title }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'}>
      {ICONS[name] || ICONS.link}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Illustrated states                                                  */
/* ------------------------------------------------------------------ */
export function EmptyArt({ motif = 'strawberry', variant = 'plate' }) {
  return (
    <div className="empty-art" aria-hidden="true">
      <svg viewBox="0 0 140 90" width="150" height="96">
        <ellipse cx="70" cy="74" rx="52" ry="9" fill="var(--c-main-soft)" stroke={S} strokeWidth="2" />
        <ellipse cx="70" cy="70" rx="42" ry="6" fill="var(--paper)" stroke={S} strokeWidth="1.6" strokeDasharray="4 3" />
        {variant === 'plate' && <path d="M56 38 Q70 30 84 38" fill="none" stroke={S} strokeWidth="2" strokeDasharray="3 4" opacity=".5" />}
      </svg>
      <div className="empty-art__item"><AccentSticker motif={motif} size={46} /></div>
    </div>
  );
}

export function LoadingArt({ motif = 'strawberry' }) {
  return (
    <div className="loading-art" role="status" aria-live="polite">
      <div className="loading-art__bounce"><AccentSticker motif={motif} size={52} /></div>
      <div className="loading-art__plate" aria-hidden="true" />
      <span>กำลังอบขนม รอสักครู่นะ…</span>
    </div>
  );
}
