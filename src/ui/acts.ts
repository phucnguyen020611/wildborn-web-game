import { ACTS, type ActId } from '../config/acts';
import { completedActs, isUnlocked } from '../core/progress';
import { t } from '../i18n';

/** Fills the act-select screen: one card per act; only open, built acts can be entered. */
export function renderActs(el: HTMLElement, onStart: (id: ActId) => void) {
  const list = el.querySelector<HTMLElement>('.acts')!;
  list.replaceChildren(
    ...ACTS.map((act) => {
      const open = act.playable && isUnlocked(act.id);
      const status = completedActs().includes(act.id)
        ? t('acts.done')
        : !act.playable
          ? t('acts.soon')
          : open
            ? ''
            : t('acts.locked');
      const card = document.createElement('button');
      card.className = 'btn act-card';
      card.disabled = !open;
      card.innerHTML = `<span class="act-title"></span><span class="act-boss"></span><span class="act-status"></span>`;
      card.querySelector('.act-title')!.textContent = t(`act.${act.id}.title`);
      card.querySelector('.act-boss')!.textContent = t(`act.${act.id}.boss`);
      card.querySelector('.act-status')!.textContent = status;
      card.addEventListener('click', () => onStart(act.id));
      return card;
    }),
  );
  list.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
}
