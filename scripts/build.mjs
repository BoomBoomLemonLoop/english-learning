import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sections, scan, walk, escapeHtml as e } from './catalog.mjs';
import { validate } from './validate.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function card(item, prefix) {
  return `<article class="lesson-card" data-url="${e(item.url)}"><div class="card-meta"><span>${e(sections.find(s => s.slug === item.section).label)}</span><span>${e(item.kind)}</span></div><h3><a href="${prefix}${e(item.url)}">${e(item.title)}</a></h3><p>${e(item.description)}</p><div class="card-bottom"><time datetime="${item.date ?? ''}">${item.date ?? 'Undated'}</time><span aria-hidden="true">↗</span></div></article>`;
}
function page(section, items) {
  const prefix = section ? '../' : './';
  const selected = section ? items.filter(i => i.section === section.slug) : items;
  const navigation = sections.map(s => `<a ${section?.slug === s.slug ? 'aria-current="page"' : ''} href="${prefix}${s.slug}/">${e(s.name)}</a>`).join('');
  const categories = section ? '' : `<section class="pathways" aria-label="Learning sections">${sections.map(s => `<a class="pathway" href="${s.slug}/"><span class="pathway-top"><span>${s.icon} / ${s.label}</span><span aria-hidden="true">↗</span></span><h2>${e(s.name)}</h2><p>${e(s.description)}</p><span class="pathway-count">${items.filter(i => i.section === s.slug).length} resources</span></a>`).join('')}</section>`;
  return `<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="description" content="${e(section?.description ?? 'A personal space for speaking, vocabulary, visual English, presentations, and reflection.')}"><title>${e(section?.name ?? 'Your English, in progress')} · English Learning</title><link rel="stylesheet" href="${prefix}assets/site.css"><script src="${prefix}assets/theme.js"></script></head>
<body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="${prefix}"><span class="brand-mark">e<span>·</span></span><span>English Learning<small>A PERSONAL LEARNING SPACE</small></span></a><button id="theme" class="theme-button" aria-label="Switch to light mode" type="button">Light mode</button></header><nav class="navigation" aria-label="Main navigation"><a href="${prefix}" ${section ? '' : 'aria-current="page"'}>Overview</a>${navigation}</nav>
<main id="main"><section class="hero"><div class="eyebrow"><span class="status-dot"></span>${section ? `${section.icon} / ${section.label}` : 'LEARN AT YOUR OWN PACE'}</div><h1>${section ? e(section.name) : 'Your English,<br><em>in progress.</em>'}</h1><p>${e(section?.description ?? 'A place to practice, collect, and reflect. Follow your curiosity — there is no daily streak to keep.')}</p><div class="hero-note">${section ? 'One collection. Room to grow.' : 'Five ways to learn. Your own rhythm.'}</div></section>${categories}
<section class="library" aria-labelledby="library-title"><div class="library-heading"><div><div class="eyebrow">${section ? 'THE COLLECTION' : 'YOUR LIBRARY'}</div><h2 id="library-title">${section ? 'Learning resources' : 'Explore your resources'}</h2></div><span id="count" aria-live="polite">${selected.length} resources</span></div><div class="controls"><label class="search-label"><span class="sr-only">Search learning resources</span><input id="search" type="search" placeholder="Search titles, topics, or content…" autocomplete="off"></label><label class="sort-label"><span>Sort by</span><select id="sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label></div><div id="results" class="lesson-grid">${selected.map(i => card(i, prefix)).join('')}</div><div id="empty" class="empty-state" ${selected.length ? 'hidden' : ''}><span class="empty-symbol" aria-hidden="true">＋</span><h3>${section?.slug === 'dk1000-visual-english' ? 'A space for visual discovery' : 'Room for your next discovery'}</h3><p>${section?.slug === 'dk1000-visual-english' ? 'Your DK1000 collection will live here. No project has been added yet.' : 'New learning resources will appear here when they are added.'}</p></div><noscript><p>All resources are listed above. Enable JavaScript to search and change the sorting order.</p></noscript><p id="load-error" role="status" hidden>Search is temporarily unavailable. You can still open the resources above.</p></section></main><footer><span>English Learning <span class="footer-dot">/</span> A little practice, a wider world.</span><a href="${prefix}">Back to overview ↑</a></footer><script type="module" src="${prefix}assets/site.js" data-section="${section?.slug ?? ''}" data-prefix="${prefix}"></script></body></html>`;
}
export async function build(root = projectRoot) {
  const output = path.resolve(root, '_site');
  if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== '_site') throw new Error('Unsafe output directory');
  const items = await scan(root);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const folder of ['content', 'assets']) {
    for (const file of await walk(path.join(root, folder))) {
      if (path.basename(file) === 'learning.json') continue;
      const dest = path.join(output, path.relative(root, file));
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(file, dest);
    }
  }
  await writeFile(path.join(output, 'catalog.json'), JSON.stringify(items));
  await writeFile(path.join(output, 'index.html'), page(null, items));
  for (const section of sections) {
    await mkdir(path.join(output, section.slug), { recursive: true });
    await writeFile(path.join(output, section.slug, 'index.html'), page(section, items));
  }
  await writeFile(path.join(output, '.nojekyll'), '');
  await validate(output);
  return { output, items };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { items, output } = await build();
  console.log(`Built ${items.length} resources and five sections in ${output}`);
}
