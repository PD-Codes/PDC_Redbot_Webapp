// Conservative server-side HTML sanitizer for owner-authored legacy page HTML
// that is rendered via {@html}. Whitelist approach: only known-safe tags and
// attributes survive; everything else is removed or escaped. Deliberately has
// no external dependency (dependency-free build, no lockfile churn).
//
// Guarantees:
// - script/style/iframe/object/embed (and similar) are removed INCLUDING content
// - all event handler attributes (on*) and any non-whitelisted attribute are dropped
// - href/src only allow http(s), mailto and site-relative URLs (no javascript:/data:)
// - output only ever contains tags emitted by this module, so it stays well-formed

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'a',
  'b',
  'i',
  'strong',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'code',
  'pre',
  'img',
  'span',
  'div',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th'
]);

const VOID_TAGS = new Set(['br', 'img']);

const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'class']);

// Dangerous elements whose entire CONTENT must be dropped, not just the tags.
const DROP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'svg',
  'math',
  'template',
  'title',
  'textarea'
]);

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Allow only http(s), mailto and site-relative URLs; null = drop the attribute. */
function safeUrl(raw: string): string | null {
  // Browsers strip ASCII control chars (tab/newline/...) when parsing URLs, so
  // remove them BEFORE the scheme check ("java\tscript:" would otherwise slip by).
  const v = raw.replace(/[\u0000-\u001f]/g, '').trim();
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (v.startsWith('//')) return null; // protocol-relative → foreign origin
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return v; // no scheme at all → relative URL
  return null; // any other scheme (javascript:, data:, vbscript:, ...)
}

const ATTR_RE = /([a-zA-Z_][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|[^\s"'`=<>]+))?/g;

/** Rebuild the attribute string keeping only whitelisted, safe attributes. */
function sanitizeAttributes(raw: string): string {
  let out = '';
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (!ALLOWED_ATTRS.has(name)) continue; // also drops every on* handler
    let value = m[3] ?? m[4] ?? (m[2] !== undefined ? m[2] : '');
    if (name === 'href' || name === 'src') {
      const safe = safeUrl(value);
      if (safe === null) continue;
      value = safe;
    }
    out += ` ${name}="${escapeAttr(value)}"`;
  }
  return out;
}

/**
 * Sanitize owner-authored legacy HTML with a strict whitelist. The output is
 * rebuilt from scratch (never echoes raw input markup) and safe for {@html}.
 */
export function sanitizeHtml(input: string): string {
  const src = String(input ?? '');
  const out: string[] = [];
  const open: string[] = []; // stack of emitted open tags → balanced output
  let dropUntil: string | null = null; // inside a DROP_CONTENT element
  let i = 0;

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      if (!dropUntil) out.push(escapeText(src.slice(i)));
      break;
    }
    if (lt > i && !dropUntil) out.push(escapeText(src.slice(i, lt)));

    // HTML comments (incl. conditional comments) are removed entirely.
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }

    const gt = src.indexOf('>', lt);
    if (gt === -1) {
      // Unterminated tag at EOF → escape the remainder as text.
      if (!dropUntil) out.push(escapeText(src.slice(lt)));
      break;
    }
    const rawTag = src.slice(lt + 1, gt);
    i = gt + 1;

    // Doctype / processing instructions / malformed tags → drop.
    const m = rawTag.match(/^(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*?)\/?\s*$/);
    if (!m) continue;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrPart = m[3] ?? '';

    if (dropUntil) {
      if (closing && name === dropUntil) dropUntil = null;
      continue;
    }
    if (DROP_CONTENT_TAGS.has(name)) {
      if (!closing) dropUntil = name;
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue; // strip unknown tag, keep surrounding text

    if (closing) {
      // Only close what we actually opened; implicitly close inner tags first.
      const idx = open.lastIndexOf(name);
      if (idx !== -1) {
        while (open.length > idx) out.push(`</${open.pop()}>`);
      }
      continue;
    }

    const attrs = sanitizeAttributes(attrPart);
    if (VOID_TAGS.has(name)) {
      out.push(`<${name}${attrs} />`);
    } else {
      out.push(`<${name}${attrs}>`);
      open.push(name);
    }
  }

  // Close anything left open so the fragment cannot leak into the page.
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join('');
}
