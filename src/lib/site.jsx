import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, unwrap } from './supabase.js';
import { PALETTES, DEFAULT_FONTS } from '../themes/palettes.js';
import { configureSfx } from './sound.js';

const SiteContext = createContext(null);
export const useSite = () => useContext(SiteContext);

/** Merge a theme row into a concrete look: css vars + fonts + assets. */
export function resolveTheme(themeRow) {
  const cfg = themeRow?.config || {};
  const motif = PALETTES[cfg.motif] ? cfg.motif : 'strawberry';
  return {
    slug: themeRow?.slug || 'strawberry',
    name: themeRow?.name || 'Strawberry Café',
    motif,
    vars: { ...PALETTES[motif], ...(cfg.vars || {}) },
    fonts: { ...DEFAULT_FONTS, ...(cfg.fonts || {}) },
    bgImage: cfg.bg_image_url || '',
    headerImage: cfg.header_image_url || '',
    stickerUrls: Array.isArray(cfg.sticker_urls) ? cfg.sticker_urls.filter(Boolean) : [],
    sfxPitch: Number(cfg.sfx_pitch) || 1,
  };
}

/** Writes theme variables onto <html>. Called by the public site (and the admin preview). */
export function applyTheme(theme) {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.setProperty('--font-display', `'${theme.fonts.display}', 'Mali', sans-serif`);
  root.style.setProperty('--font-body', `'${theme.fonts.body}', 'Noto Sans Thai Looped', sans-serif`);
  root.style.setProperty('--font-label', `'${theme.fonts.label}', 'Itim', sans-serif`);
  root.style.setProperty('--bg-image', theme.bgImage ? `url("${theme.bgImage}")` : 'none');
  root.dataset.theme = theme.slug;
  root.dataset.motif = theme.motif;
}

export function SiteProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: s.data ? false : true, error: null }));
    try {
      const [profile, settings, services, contacts] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', 1).maybeSingle().then(unwrap),
        supabase.from('site_settings').select('*').eq('id', 1).maybeSingle().then(unwrap),
        supabase.from('services').select('*, steps:service_steps(*)').eq('is_visible', true).order('sort_order').then(unwrap),
        supabase.from('contact_links').select('*').eq('is_active', true).order('sort_order').then(unwrap),
      ]);
      let themeRow = null;
      if (settings?.active_theme_id) {
        themeRow = await supabase.from('themes').select('*').eq('id', settings.active_theme_id).maybeSingle().then(unwrap);
      }
      setState({ loading: false, error: null, data: { profile, settings, services, contacts, themeRow } });
    } catch (e) {
      setState((s) => ({ loading: false, error: e, data: s.data }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const theme = useMemo(() => resolveTheme(state.data?.themeRow), [state.data?.themeRow]);

  useEffect(() => {
    applyTheme(theme);
    configureSfx({ enabled: state.data?.settings?.sfx_enabled ?? true, pitch: theme.sfxPitch });
  }, [theme, state.data?.settings]);

  const value = useMemo(() => ({ ...state, ...(state.data || {}), theme, reload: load }), [state, theme, load]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
