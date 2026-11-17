import { orderItems } from '../assets/library.js';
export { orderItems } from '../assets/library.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const sections = [
  { slug: 'scenario-speaking', name: 'Scenario Speaking', label: 'SPEAK', icon: '01', description: 'Everyday situations. A little more confidence, one conversation at a time.' },
  { slug: 'vocabulary-expressions', name: 'Vocabulary & Expressions', label: 'COLLECT', icon: '02', description: 'Words, phrases, and useful expressions worth keeping close.' },
  { slug: 'dk1000-visual-english', name: 'DK1000 Visual English', label: 'DISCOVER', icon: '03', description: 'Connect the things you see with the English you use.' },
  { slug: 'seminars-presentations', name: 'Seminars & Presentations', label: 'PRESENT', icon: '04', description: 'Build clear ideas, thoughtful talks, and confident academic conversations.' },
  { slug: 'reading-reflections', name: 'Reading & Reflections', label: 'REFLECT', icon: '05', description: 'Read with curiosity. Make space for your own thoughts.' }
];
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function decode(value) {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi, (m, n, named) => {
    if (n) { const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m; }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[named.toLowerCase()];
  });
}
export function attributes(tag) {
  const result = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4]);
  return result;
}
export const plainText = html => decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
export async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.') || ['node_modules', 'README.md'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${file}`);
    if (entry.isDirectory()) files.push(...await walk(file)); else files.push(file);
  }
  return files;
}
export function validDate(value) {
  const match = String(value ?? '').match(/^\d{4}-\d{2}-\d{2}(?=$|T|\s)/);
  if (!match) return null;
  const date = new Date(match[0]);
  return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === match[0] ? match[0] : null;
}
function gitDate(root, file) {
  try { return validDate(execFileSync('git', ['log', '-1', '--format=%cs', '--', path.relative(root, file)], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { return null; }
}
export async function scan(root) {
  const items = [];
  for (const section of sections) {
    const dir = path.join(root, 'content', section.slug);
    const files = await walk(dir);
    const roots = new Map();
    for (const file of files) {
      const relative = path.relative(dir, file);
      const first = relative.split(path.sep)[0];
      if (!roots.has(first)) roots.set(first, []);
      roots.get(first).push(file);
    }
    for (const [name, members] of roots) {
      const candidate = path.join(dir, name);
      const isProject = (await stat(candidate)).isDirectory();
      const htmlFiles = members.filter(f => /\.html?$/i.test(f));
      if (!htmlFiles.length) continue;
      let options = {};
      const config = path.join(candidate, 'learning.json');
      if (isProject && members.includes(config)) options = JSON.parse(await readFile(config, 'utf8'));
      let entry = candidate;
      if (isProject) {
        if (options.entry) {
          entry = path.resolve(candidate, options.entry);
          if (!entry.startsWith(candidate + path.sep) || !htmlFiles.includes(entry)) throw new Error(`Invalid project entry: ${config}`);
        } else {
          entry = htmlFiles.find(f => path.relative(candidate, f) === 'index.html') ?? (htmlFiles.length === 1 ? htmlFiles[0] : null);
          if (!entry) throw new Error(`Project needs index.html (or learning.json entry): ${candidate}`);
        }
      }
      const html = await readFile(entry, 'utf8');
      const meta = {};
      for (const m of html.matchAll(/<meta\b[^>]*>/gi)) { const a = attributes(m[0]); meta[(a.name ?? a.property ?? '').toLowerCase()] = a.content; }
      const title = String(options.title ?? plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')).trim() || name.replace(/\.html?$/i, '').replace(/[-_]/g, ' ');
      const date = validDate(options.date) ?? validDate(meta.date) ?? validDate(meta['article:published_time']) ?? validDate(name.match(/\d{4}-\d{2}-\d{2}/)?.[0]) ?? gitDate(root, entry);
      const description = String(options.description ?? meta.description ?? meta['og:description'] ?? plainText(html).slice(0, 170));
      const tags = Array.isArray(options.tags) ? options.tags.map(String) : [];
      const text = (await Promise.all(htmlFiles.map(async f => plainText(await readFile(f, 'utf8'))))).join(' ');
      const url = path.relative(root, entry).split(path.sep).map(encodeURIComponent).join('/');
      items.push({ section: section.slug, title, description, date, tags, url, kind: isProject ? 'Project' : 'Page', text });
    }
  }
  return orderItems(items);
}
