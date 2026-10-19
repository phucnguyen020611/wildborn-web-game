import { ITEMS, RECIPES, type RecipeId } from '../config/items';
import { canCraft, craft, type World } from '../sim/world';
import { t } from '../i18n';

/** Fills the bag screen (opened with Tab, game paused): what you carry, and recipes to craft from it. */
export function renderBag(el: HTMLElement, w: World) {
  const items = el.querySelector<HTMLElement>('.bag-items')!;
  items.replaceChildren(
    ...ITEMS.map((id) => {
      const li = document.createElement('li');
      li.className = w.inventory[id] ? '' : 'none';
      li.innerHTML = `<span></span><span class="count"></span>`;
      li.firstElementChild!.textContent = t(`item.${id}`);
      li.lastElementChild!.textContent = String(w.inventory[id]);
      return li;
    }),
  );
  el.querySelector('.bag-spear')!.textContent = t('bag.spear', {
    tip: t(`spear.tier${w.spearTier}`),
  });

  const recipes = el.querySelector<HTMLElement>('.recipes')!;
  recipes.replaceChildren(
    ...(Object.keys(RECIPES) as RecipeId[]).map((id) => {
      const li = document.createElement('li');
      const cost = Object.entries(RECIPES[id].cost)
        .map(([item, n]) => `${n} ${t(`item.${item}`)}`)
        .join(' + ');
      li.innerHTML = `<span><span class="recipe-name"></span><span class="recipe-cost hint"></span></span><button class="btn btn-small"></button>`;
      li.querySelector('.recipe-name')!.textContent = t(`recipe.${id}`);
      li.querySelector('.recipe-cost')!.textContent = cost;
      const make = li.querySelector('button')!;
      make.textContent = t('bag.make');
      make.disabled = !canCraft(w, id);
      make.addEventListener('click', () => {
        craft(w, id);
        renderBag(el, w);
        el.querySelector<HTMLButtonElement>('[data-action="play"]')?.focus();
      });
      return li;
    }),
  );
}
