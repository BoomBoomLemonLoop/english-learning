import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { walk, attributes } from './catalog.mjs';

// Only inspect actual CSS and markup. JavaScript (including JSON payloads and
// HTML template strings) is runtime content, not a list of static file paths.
function htmlSources(text) {
  const styles = [];
  const markup = text.replace(/<!--[\s\S]*?(?:-->|$)|(<(script|style|textarea|title)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>)([\s\S]*?)(?:<\/\2\s*>|$)/gi, (match, opening, tag, body) => {
    if (!tag) return '';
    if (tag.toLowerCase() === 'style') styles.push(body);
    // Retain the opening tag so external script src and style attributes
    // still receive the same static dependency checks as other HTML tags.
    return opening;
  });
  return { markup, styles };
}

function cssReferences(css) {
  const references = [];
  // Consume comments and ordinary strings without treating their contents as
  // URL functions. Quoted @import and url(...) are the resource-bearing tokens.
  const tokens = /\/\*[\s\S]*?(?:\*\/|$)|@import\s+(?:"([^"]*)"|'([^']*)')|(?<![\w-])url\(\s*(?:"([^"]*)"|'([^']*)'|([^'"()]*?))\s*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gi;
  for (const match of css.matchAll(tokens)) {
    const reference = match.slice(1).find(value => value !== undefined);
    if (reference) references.push(reference.trim());
  }
  return references;
}

export async function validate(output) {
  const files = await walk(output);
  const names = new Set(files.map(f => path.relative(output, f).split(path.sep).join('/')));
  const errors = [];
  function check(source, reference, checkAnchor = false) {
    if (!reference || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(reference)) return;
    if (reference.startsWith('/')) { errors.push(`${source}: root-absolute URL is incompatible with project Pages: ${reference}`); return; }
    const [raw, fragment] = reference.split('#');
    let pathname;
    try { pathname = decodeURIComponent(raw.split('?')[0]); } catch { errors.push(`${source}: invalid URL ${reference}`); return; }
    let target = pathname ? path.posix.normalize(path.posix.join(path.posix.dirname(source), pathname)) : source;
    if (target === '.' || target.endsWith('/')) target = path.posix.normalize(target === '.' ? 'index.html' : target + 'index.html');
    if (!names.has(target) && names.has(target + '/index.html')) target += '/index.html';
    if (!names.has(target)) errors.push(`${source}: missing or wrong-case target ${reference}`);
    if (checkAnchor && fragment && names.has(target) && /\.html?$/i.test(target)) return { target, fragment };
  }
  for (const file of files) {
    const relative = path.relative(output, file).split(path.sep).join('/');
    if (!/\.(html?|css|js|mjs)$/i.test(file)) continue;
    const text = await readFile(file, 'utf8');
    const styles = [];
    if (/\.html?$/i.test(file)) {
      const html = htmlSources(text);
      styles.push(...html.styles);
      for (const match of html.markup.matchAll(/<([a-z][\w:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
        const attrs = attributes(match[0]);
        if (attrs.style) styles.push(attrs.style);
        if (!/^(a|link|script|img|source|video|audio|iframe|object)$/i.test(match[1])) continue;
        for (const key of ['href', 'src', 'poster', 'data']) {
          if (!attrs[key]) continue;
          const anchor = check(relative, attrs[key], key === 'href');
          if (anchor) {
            const html = await readFile(path.join(output, anchor.target), 'utf8');
            const ids = [...html.matchAll(/\b(?:id|name)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => m[1] ?? m[2]);
            if (!ids.includes(decodeURIComponent(anchor.fragment))) errors.push(`${relative}: missing anchor ${attrs[key]}`);
          }
        }
        if (attrs.srcset && !attrs.srcset.includes('data:')) for (const part of attrs.srcset.split(',')) check(relative, part.trim().split(/\s+/)[0]);
      }
    }
    if (/\.css$/i.test(file)) styles.push(text);
    for (const css of styles) for (const reference of cssReferences(css)) check(relative, reference);
    if (/\.(?:js|mjs)$/i.test(file)) for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.[^"']+)["']/g)) check(relative, match[1]);
  }
  if (errors.length) throw new Error(`Link validation failed:\n${errors.join('\n')}`);
  return { files: files.length };
}
