import { orderItems, matchesQuery } from './library.js';
const script = document.querySelector('script[data-section]');
const { section, prefix } = script.dataset;
const search = document.querySelector('#search');
const sort = document.querySelector('#sort');
const results = document.querySelector('#results');
const empty = document.querySelector('#empty');
const cards = new Map([...results.children].map(card => [card.dataset.url, card]));
try {
  const response = await fetch(`${prefix}catalog.json`);
  if (!response.ok) throw new Error(`Catalog: ${response.status}`);
  const all = await response.json();
  const items = all.filter(item => !section || item.section === section);
  function render() {
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const hits = orderItems(items.filter(item => matchesQuery(item, search.value)), sort.value);
    results.replaceChildren(...hits.map(item => cards.get(item.url)));
    document.querySelector('#count').textContent = `${hits.length} ${hits.length === 1 ? 'resource' : 'resources'}`;
    empty.hidden = hits.length > 0;
    if (!hits.length && terms.length) {
      empty.querySelector('h3').textContent = 'No matching resources';
      empty.querySelector('p').textContent = 'Try a different word or a shorter search.';
    } else if (!hits.length) {
      empty.querySelector('h3').textContent = 'Room for your next discovery';
      empty.querySelector('p').textContent = 'New learning resources will appear here when they are added.';
    }
  }
  search.addEventListener('input', render);
  sort.addEventListener('change', render);
} catch (error) {
  document.querySelector('#load-error').hidden = false;
  search.disabled = true;
  sort.disabled = true;
  console.error(error);
}
