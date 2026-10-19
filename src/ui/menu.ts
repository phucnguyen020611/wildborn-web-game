import { getLang, setLang, t, type Lang } from '../i18n';
import { bindSettingsForm } from './settingsForm';
import { onLoadProgress } from '../core/loading';

export type Screen = 'menu' | 'pause' | 'settings' | 'end' | 'error' | 'acts' | 'craft' | null;

export interface EndStats {
  outcome: 'won' | 'lost';
  time: number; // seconds
  hits: number;
  attacks: number;
  unlocked?: string; // name of the act this win opened
}

const byId = (id: string) => document.getElementById(id)!;

/** Shows one overlay screen at a time; `null` = in-game (HUD only). */
export function createMenus(onPlay: () => void, onMenu: () => void, onActs: () => void) {
  const screens = {
    menu: byId('menu-main'),
    pause: byId('menu-pause'),
    settings: byId('menu-settings'),
    end: byId('menu-end'),
    error: byId('error'),
    acts: byId('menu-acts'),
    craft: byId('menu-craft'),
  };
  const hud = byId('hud');
  const relockHints = document.querySelectorAll<HTMLElement>('.relock-hint');
  const langButtons = document.querySelectorAll<HTMLButtonElement>('[data-lang]');

  document
    .querySelectorAll('[data-action="play"]')
    .forEach((b) => b.addEventListener('click', onPlay));
  document
    .querySelectorAll('[data-action="menu"]')
    .forEach((b) => b.addEventListener('click', onMenu));
  document
    .querySelectorAll('[data-action="acts"]')
    .forEach((b) => b.addEventListener('click', onActs));

  // Settings opens from the main or pause menu and returns to whichever opened it.
  bindSettingsForm(screens.settings);
  let current: Screen = null;
  let returnTo: Screen = 'menu';
  document.querySelectorAll('[data-action="settings"]').forEach((b) =>
    b.addEventListener('click', () => {
      returnTo = current;
      show('settings');
    }),
  );
  const back = () => show(returnTo);
  document.querySelector('[data-action="back"]')!.addEventListener('click', back);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current === 'settings') back();
  });

  const syncLang = () =>
    langButtons.forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())),
    );
  langButtons.forEach((b) =>
    b.addEventListener('click', () => {
      setLang(b.dataset.lang as Lang);
      syncLang();
    }),
  );
  syncLang();

  // Loading screen: the main menu's Play stays disabled until every model and sound has settled.
  const loading = screens.menu.querySelector<HTMLElement>('.loading')!;
  const loadingFill = loading.querySelector<HTMLElement>('.bar-fill')!;
  const loadingText = loading.querySelector<HTMLElement>('.loading-text')!;
  const playButton = screens.menu.querySelector<HTMLButtonElement>('[data-action="acts"]')!;
  onLoadProgress(({ done, total }) => {
    const ready = total > 0 && done === total;
    const percent = total ? Math.round((done / total) * 100) : 0;
    loadingFill.style.transform = `scaleX(${percent / 100})`;
    loadingText.textContent = t('loading.progress', { percent });
    loading.hidden = ready;
    playButton.disabled = !ready;
    if (ready && current === 'menu') playButton.focus();
  });

  function show(screen: Screen) {
    for (const [name, el] of Object.entries(screens)) el.hidden = name !== screen;
    hud.hidden = screen !== null;
    relockHints.forEach((el) => (el.hidden = true));
    current = screen;
    if (screen) screens[screen].querySelector<HTMLElement>('button, input')?.focus();
  }

  function showEnd(s: EndStats) {
    const panel = screens.end;
    panel.querySelector('.end-title')!.textContent = t(
      s.outcome === 'won' ? 'end.won' : 'end.lost',
    );
    const secs = Math.floor(s.time);
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    panel.querySelector('.end-stats')!.textContent = t('end.stats', {
      time,
      hits: s.hits,
      attacks: s.attacks,
    });
    const unlock = panel.querySelector<HTMLElement>('.end-unlock')!;
    unlock.hidden = !s.unlocked;
    if (s.unlocked) unlock.textContent = t('end.unlock', { act: s.unlocked });
    show('end');
  }

  return {
    show,
    showEnd,
    showRelockHint: () => relockHints.forEach((el) => (el.hidden = false)),
  };
}
