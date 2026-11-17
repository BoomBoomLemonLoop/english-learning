(() => {
  try { document.documentElement.dataset.theme = localStorage.getItem('english-learning-theme') === 'light' ? 'light' : 'dark'; } catch {}
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('#theme');
    function update() {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      button.textContent = `${next === 'light' ? 'Light' : 'Dark'} mode`;
      button.setAttribute('aria-label', `Switch to ${next} mode`);
    }
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('english-learning-theme', next); } catch {}
      update();
    });
    update();
  });
})();
