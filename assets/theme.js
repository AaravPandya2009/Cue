(() => {
  const key = 'cue-theme';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: light)');
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  let button;

  function applyTheme() {
    const light = preference === 'light' || (preference !== 'dark' && system.matches);
    root.dataset.theme = light ? 'light' : 'dark';
    if (button) {
      button.textContent = light ? '☾ Dark' : '☀ Light';
      button.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    }
  }

  applyTheme();
  system.addEventListener('change', applyTheme);
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = event.newValue;
    applyTheme();
  });

  document.addEventListener('DOMContentLoaded', () => {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    const header = document.querySelector('header');
    (header.querySelector('nav') || header).append(button);
    button.addEventListener('click', () => {
      preference = root.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(key, preference); } catch {}
      applyTheme();
    });
    applyTheme();
  });
})();
