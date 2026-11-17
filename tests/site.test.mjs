import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { scan, validDate, orderItems, sections, walk } from '../scripts/catalog.mjs';
import { build } from '../scripts/build.mjs';
import { validate } from '../scripts/validate.mjs';
import { createServer } from '../scripts/preview.mjs';
import { matchesQuery } from '../assets/library.js';
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'english-learning-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(source, 'assets'), path.join(root, 'assets'), { recursive: true });
  return { root, put: async (file, text) => { const dest = path.join(root, file); await mkdir(path.dirname(dest), { recursive: true }); await writeFile(dest, text); } };
}
const folder = 'content/scenario-speaking/';
test('object URL APIs in inline and external scripts are not CSS file references', async t => {
  const { root, put } = await fixture(t);
  const script = "const url = URL.createObjectURL(blob); URL.revokeObjectURL(url);";
  await put('_site/index.html', `<script>${script}</script><script src="download.js"></script>`);
  await put('_site/download.js', script);
  await validate(path.join(root, '_site'));
});
test('HTML script strings and comments are not static markup or CSS', async t => {
  const { root, put } = await fixture(t);
  await put('_site/index.html', `<!-- <img src="comment.png"><style>p{background:url(comment.svg)}</style> -->
    <script>const template = '<img src="dynamic.png">'; const css = 'url(runtime.svg)';</script>
    <textarea><img src="example.png"></textarea>
    <style>/* url(comment.svg) */p::before{content:"url(example.svg)"}</style>`);
  await validate(path.join(root, '_site'));
});
test('CSS references in stylesheets, style blocks and style attributes remain validated', async t => {
  const { root, put } = await fixture(t);
  await put('_site/index.html', `<link rel="stylesheet" href="css/main.css"><style>@import "theme.css";p{background:url(block.svg)}</style><div style="background:url(inline.svg)"></div>`);
  await put('_site/css/main.css', '@import "nested.css";p{background:url(../external.svg)}');
  const targets = ['theme.css', 'block.svg', 'inline.svg', 'nested.css', '../external.svg'];
  await assert.rejects(validate(path.join(root, '_site')), error => targets.every(target => error.message.includes(target)));
  for (const file of ['theme.css', 'block.svg', 'inline.svg', 'css/nested.css', 'external.svg']) await put('_site/' + file, '');
  await validate(path.join(root, '_site'));
});
test('script source and JS module files are still checked', async t => {
  const { root, put } = await fixture(t);
  await put('_site/index.html', '<script src="missing.js"></script>');
  await put('_site/app.js', 'import { value } from "./missing-module.js";');
  await assert.rejects(validate(path.join(root, '_site')), error => error.message.includes('missing.js') && error.message.includes('missing-module.js'));
});
test('the current uploaded collection builds with every content file preserved byte-for-byte', async t => {
  const { root } = await fixture(t);
  // Exercise real uploads too, without tying the suite to a lesson that the
  // owner may later rename or replace as part of normal content maintenance.
  await cp(path.join(source, 'content'), path.join(root, 'content'), { recursive: true });
  const { output, items } = await build(root);
  for (const file of await walk(path.join(root, 'content'))) {
    if (path.basename(file) === 'learning.json') continue;
    assert.deepEqual(await readFile(path.join(output, path.relative(root, file))), await readFile(file));
  }
  for (const item of items) {
    assert.deepEqual(await readFile(path.join(output, decodeURIComponent(item.url))), await readFile(path.join(root, decodeURIComponent(item.url))));
  }
});
test('standalone upload needs no metadata; filename supplies date and title entities decode', async t => {
  const { root, put } = await fixture(t);
  await put(folder + '2026-11-17-coffee.html', '<title>Coffee &amp; conversation</title><p>Order politely.</p>');
  const items = await scan(root);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Coffee & conversation');
  assert.equal(items[0].date, '2026-11-17');
  assert.match(items[0].description, /Order politely/);
});
test('multi-file upload creates one card and preserves HTML, CSS, JS, image and nested pages byte-for-byte', async t => {
  const { root, put } = await fixture(t);
  const files = {
    'index.html': '<title>Kitchen project</title><meta name="description" content="Visual vocabulary"><link rel="stylesheet" href="css/main.css"><img src="images/cup.svg"><a href="pages/detail.html#cup">More</a><script src="js/main.js"></script>',
    'css/main.css': 'body{background-image:url(../images/cup.svg)}',
    'js/main.js': 'document.body.dataset.loaded="yes";',
    'images/cup.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8"/></svg>',
    'pages/detail.html': '<h1 id="cup">porcelain-secret-search-term</h1><a href="../index.html">Back</a>'
  };
  for (const [file, text] of Object.entries(files)) await put(folder + 'kitchen/' + file, text);
  const { items, output } = await build(root);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'Project');
  assert.match(items[0].text, /porcelain-secret-search-term/);
  for (const [file, text] of Object.entries(files)) assert.equal(await readFile(path.join(output, folder, 'kitchen', file), 'utf8'), text);
  assert.equal(((await readFile(path.join(output, 'index.html'), 'utf8')).match(/class="lesson-card"/g) ?? []).length, 1);
});
test('root index.html is standalone content without overwriting section navigation', async t => {
  const { root, put } = await fixture(t);
  await put(folder + 'index.html', '<title>Standalone index</title>');
  const { output } = await build(root);
  assert.match(await readFile(path.join(output, folder, 'index.html'), 'utf8'), /Standalone index/);
  assert.match(await readFile(path.join(output, 'scenario-speaking/index.html'), 'utf8'), /Main navigation/);
});
test('optional metadata selects entry; escape outside project is rejected', async t => {
  const { root, put } = await fixture(t);
  await put(folder + 'project/start.html', '<title>Original</title>');
  await put(folder + 'project/other.html', '<title>Other</title>');
  await put(folder + 'project/learning.json', JSON.stringify({ entry: 'start.html', title: 'Custom', date: '2026-11-16', tags: ['coffee'] }));
  assert.equal((await scan(root))[0].title, 'Custom');
  await put(folder + 'project/learning.json', JSON.stringify({ entry: '../outside.html' }));
  await assert.rejects(scan(root), /Invalid project entry/);
});
test('ambiguous project fails with an actionable message', async t => {
  const { root, put } = await fixture(t);
  await put(folder + 'project/a.html', '<title>A</title>');
  await put(folder + 'project/b.html', '<title>B</title>');
  await assert.rejects(scan(root), /needs index.html/);
});
test('spaces and Unicode URLs are encoded and HTML metadata cannot inject cards', async t => {
  const { root, put } = await fixture(t);
  await put(folder + '我的 lesson.html', '<title>&lt;img src=x onerror=alert(1)&gt;</title>');
  const { output, items } = await build(root);
  assert.match(items[0].url, /%20/);
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x/);
});
test('dates are calendar-validated and undated content stays last in either date order', () => {
  assert.equal(validDate('2026-02-30'), null);
  assert.equal(validDate('2024-02-29'), '2024-02-29');
  const items = [{ title: 'B', date: null, url: 'b' }, { title: 'A', date: '2026-01-01', url: 'a' }, { title: 'C', date: '2026-11-17', url: 'c' }];
  assert.deepEqual(orderItems(items).map(i => i.title), ['C', 'A', 'B']);
  assert.deepEqual(orderItems(items, 'oldest').map(i => i.title), ['A', 'C', 'B']);
  assert.deepEqual(orderItems(items, 'title').map(i => i.title), ['A', 'B', 'C']);
});
test('validation catches missing files, Linux case errors, anchors and root-absolute URLs', async t => {
  const { root, put } = await fixture(t);
  await put('_site/index.html', '<img src="missing.png"><a href="Other.html">Case</a><a href="other.html#missing">Anchor</a><script src="/app.js"></script>');
  await put('_site/other.html', '<h1 id="exists">Other</h1>');
  await assert.rejects(validate(path.join(root, '_site')), error => ['missing.png', 'Other.html', 'missing anchor', 'root-absolute'].every(part => error.message.includes(part)));
});
test('five empty sections render and old learning material is not published', async t => {
  const { root, put } = await fixture(t);
  await put('old-learning.html', '<title>Old</title>');
  const { output, items } = await build(root);
  assert.equal(items.length, 0);
  for (const section of sections) assert.match(await readFile(path.join(output, section.slug, 'index.html'), 'utf8'), /id="empty"/);
  await assert.rejects(readFile(path.join(output, 'old-learning.html')), /ENOENT/);
});
test('HTTP preview serves real project prefix and loads project resources', async t => {
  const { root, put } = await fixture(t);
  await put(folder + 'project/index.html', '<title>HTTP demo</title><link rel="stylesheet" href="style.css"><script src="app.js"></script><img src="image.svg">');
  await put(folder + 'project/style.css', 'body{color:green}');
  await put(folder + 'project/app.js', 'window.demo=true');
  await put(folder + 'project/image.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const { output } = await build(root);
  const server = createServer(output);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}/english-learning/`;
  for (const file of ['index.html', 'catalog.json', 'assets/site.js', 'assets/library.js', ...sections.map(s => s.slug + '/'), ...['index.html', 'style.css', 'app.js', 'image.svg'].map(f => folder + 'project/' + f)]) assert.equal((await fetch(base + file)).status, 200, file);
  assert.equal((await fetch(base + 'missing.html')).status, 404);
});
test('search matches case-insensitive title, body, tags and date with AND terms', () => {
  const item = { title: 'Coffee', description: 'A lesson', text: 'porcelain cup', tags: ['口语'], date: '2026-11-17' };
  assert.equal(matchesQuery(item, 'COFFEE porcelain'), true);
  assert.equal(matchesQuery(item, '口语 2026-11'), true);
  assert.equal(matchesQuery(item, 'coffee missing'), false);
  assert.equal(matchesQuery(item, ' '), true);
});
test('adding and removing uploads regenerates both section and global catalog without manual indexing', async t => {
  const { root, put } = await fixture(t);
  await put(folder + 'a.html', '<title>Alpha</title><meta name="date" content="2026-11-16">');
  await build(root);
  await put(folder + 'b.html', '<title>Beta</title><meta name="date" content="2026-11-17"><meta name="description" content="Explicit summary">');
  let result = await build(root);
  assert.deepEqual(result.items.map(i => i.title), ['Beta', 'Alpha']);
  assert.equal(result.items[0].description, 'Explicit summary');
  const before = await readFile(path.join(result.output, 'catalog.json'), 'utf8');
  assert.equal(JSON.parse(before).length, 2);
  await rm(path.join(root, folder, 'a.html'));
  result = await build(root);
  assert.equal(result.items.length, 1);
  await assert.rejects(readFile(path.join(result.output, folder, 'a.html')), /ENOENT/);
  for (const file of ['index.html', 'scenario-speaking/index.html']) {
    const html = await readFile(path.join(result.output, file), 'utf8');
    assert.match(html, /Beta/);
    assert.doesNotMatch(html, /Alpha/);
  }
});
