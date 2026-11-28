import { loadTheme, applyTheme, toggleTheme, type Theme } from './core/theme';
import { parseHash, renderHeader, renderFooter, showRoute, type Route } from './ui/shell';
import { renderGenerate, defaultGenerateState, type GenerateState } from './ui/generate';
import { renderPack } from './ui/pack';
import { renderGuide } from './ui/guide';
import { renderAbout } from './ui/about';
import type { SourceImage } from './core/types';

const state: GenerateState = defaultGenerateState();
let theme: Theme = loadTheme();

function currentRoute(): Route {
  return parseHash(location.hash);
}

function renderHeaderBar(): void {
  const header = document.getElementById('app-header');
  if (!header) return;
  renderHeader(header, currentRoute(), {
    theme,
    onThemeToggle: () => {
      theme = toggleTheme(theme);
      renderHeaderBar();
    },
  });
}

function renderActiveView(): void {
  const route = currentRoute();
  showRoute(route);
  const gen = document.getElementById('view-generate');
  const pack = document.getElementById('view-pack');
  const guide = document.getElementById('view-guide');
  const about = document.getElementById('view-about');
  if (route === 'generate' && gen) {
    renderGenerate(gen, state, {
      onSourceChange: (_src: SourceImage | null) => {
        // Source changed; pack view re-renders on next visit.
      },
    });
  } else if (route === 'pack' && pack) {
    renderPack(pack, state);
  } else if (route === 'guide' && guide) {
    renderGuide(guide);
  } else if (route === 'about' && about) {
    renderAbout(about);
  }
}

function renderAll(): void {
  renderHeaderBar();
  renderActiveView();
}

function init(): void {
  applyTheme(theme);
  const footer = document.getElementById('app-footer');
  if (footer) renderFooter(footer);
  renderAll();
  window.addEventListener('hashchange', renderAll);
}

init();