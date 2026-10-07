// Tiny, dependency-free rich text for Bio / descriptions.
// Stored value = a small HTML subset (b, i, u, br, p, ul, ol, li, no attributes at all).
// The sanitiser BUILDS the output from scratch (text is escaped, only whitelisted bare tags are emitted),
// so nothing the user types or pastes can become a script, an event handler or a link.
// Old plain-text values keep working: they are escaped and their line breaks are kept.

const TAG_MAP = { b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', br: 'br', p: 'p', div: 'p', ul: 'ul', ol: 'ol', li: 'li' };
const VOID = new Set(['br']);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'textarea', 'title', 'svg', 'math']);

const escapeText = (t) => t
  .replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp);)/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export function escapeAll(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sanitizeHtml(input) {
  const src = String(input ?? '');
  const out = [];
  const stack = [];
  let i = 0;
  const closeTop = () => { const t = stack.pop(); out.push(`</${t}>`); };
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { out.push(escapeText(src.slice(i))); break; }
    if (lt > i) out.push(escapeText(src.slice(i, lt)));
    if (src.startsWith('<!--', lt)) {                       // comment: drop it entirely
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/.exec(src.slice(lt, lt + 400));
    if (!m) { out.push('&lt;'); i = lt + 1; continue; }     // a stray "<" is just text
    i = lt + m[0].length;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (!closing && DROP_WITH_CONTENT.has(name)) {          // <script>…</script>: drop tag AND content
      const re = new RegExp(`</${name}\\s*>`, 'i');
      const rest = src.slice(i);
      const found = re.exec(rest);
      i = found ? i + found.index + found[0].length : src.length;
      continue;
    }
    const tag = TAG_MAP[name];
    if (!tag) continue;                                     // unknown tag: unwrap, keep its text
    if (VOID.has(tag)) { if (!closing) out.push('<br>'); continue; }
    if (!closing) {
      if (tag === 'li' && !stack.includes('ul') && !stack.includes('ol')) continue;   // <li> only inside a list
      if (tag === 'p') while (stack[stack.length - 1] === 'p') closeTop();   // <p> never nests in <p>
      if (tag === 'li') while (stack.length && !['ul', 'ol'].includes(stack[stack.length - 1])) closeTop();
      stack.push(tag);
      out.push(`<${tag}>`);
    } else {
      const at = stack.lastIndexOf(tag);
      if (at === -1) continue;                              // stray closing tag
      while (stack.length > at) closeTop();
    }
  }
  while (stack.length) closeTop();
  return out.join('');
}

const LOOKS_LIKE_HTML = /<\/?(b|i|u|p|br|ul|ol|li|strong|em|div)\b/i;

/** Anything stored (plain text from older versions, or the small HTML subset) -> safe HTML to render. */
export function toRichHtml(value) {
  const v = String(value ?? '');
  if (!v.trim()) return '';
  if (LOOKS_LIKE_HTML.test(v)) return sanitizeHtml(v);
  return escapeAll(v).replace(/\r?\n/g, '<br>');
}

/** Visible text length (what the author actually typed), used for limits and "is it empty". */
export function plainText(html) {
  return String(html ?? '')
    .replace(/<\/(p|li|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** What gets saved: sanitised HTML, or null when there is no visible text. */
export function cleanForSave(html) {
  const safe = sanitizeHtml(html);
  return plainText(safe) ? safe : null;
}
