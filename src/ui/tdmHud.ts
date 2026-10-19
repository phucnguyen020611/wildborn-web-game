import { FIGHTER, WEAPON_ORDER } from '../config/arsenal';
import type { Match } from '../sim/tdm';
import { t } from '../i18n';

const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!;

/** Tribal War HUD: score and clock, kill feed, weapon slots with ammo, respawn countdown, health. */
export function createTdmHud() {
  $('.tdm').hidden = false;
  $('.hud-objective').hidden = true;
  $('.hud-spear').hidden = true;
  $('.hud-bag').hidden = true;
  const points = [$('.team0 .tdm-points'), $('.team1 .tdm-points')];
  const clock = $('.tdm-clock');
  const feed = $('.tdm-feed');
  const respawn = $('.tdm-respawn');
  const fill = $('.hud-player .bar-fill');
  const hp = $('.hud-hp-value');
  const slots = $('.tdm-weapons');
  slots.replaceChildren(
    ...WEAPON_ORDER.map((id, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="key">${i + 1}</span><span class="name"></span><span class="ammo"></span>`;
      li.querySelector('.name')!.textContent = t(`weapon.${id}`);
      return li;
    }),
  );
  const name = (i: number) => (i === 0 ? t('tdm.you') : t('tdm.bot', { n: i }));
  let last = '';

  return {
    update(m: Match) {
      const me = m.fighters[0];
      const left = Math.max(0, Math.ceil(m.timeLimit - m.time));
      const key = `${m.score}|${left}|${me.hp}|${me.weapon}|${Object.values(me.ammo)}|${me.alive}|${Math.ceil(me.respawn)}`;
      if (key === last) return;
      last = key;
      points[0].textContent = String(m.score[0]);
      points[1].textContent = String(m.score[1]);
      clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      fill.style.transform = `scaleX(${me.hp / FIGHTER.hp})`;
      hp.textContent = String(Math.ceil(me.hp));
      WEAPON_ORDER.forEach((id, i) => {
        const li = slots.children[i] as HTMLElement;
        li.classList.toggle('on', id === me.weapon);
        const ammo = id === 'spear' || id === 'javelin' || id === 'bow' ? String(me.ammo[id]) : '';
        li.querySelector('.ammo')!.textContent = ammo;
      });
      respawn.hidden = me.alive;
      if (!me.alive)
        respawn.textContent = t('tdm.respawn', { s: Math.max(1, Math.ceil(me.respawn)) });
    },
    kill(killer: number, victim: number, team: 0 | 1) {
      const li = document.createElement('li');
      li.textContent = t('tdm.killed', { killer: name(killer), victim: name(victim) });
      li.style.boxShadow = `inset 3px 0 0 ${team === 0 ? '#c0391b' : '#2563c9'}`;
      feed.prepend(li);
      setTimeout(() => li.remove(), 4000);
    },
  };
}
