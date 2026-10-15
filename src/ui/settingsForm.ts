import { onSettings, updateSettings, type Quality, type Settings } from '../settings/settings';

const FORMAT: Record<string, (v: number) => string> = {
  x: (v) => `${v.toFixed(1)}×`,
  deg: (v) => `${v}°`,
  pct: (v) => `${Math.round(v * 100)}%`,
};

/** Binds every `[data-setting]` control and `[data-quality]` button in `root` to the settings store. */
export function bindSettingsForm(root: HTMLElement) {
  const inputs = root.querySelectorAll<HTMLInputElement>('input[data-setting]');
  const qualityButtons = root.querySelectorAll<HTMLButtonElement>('[data-quality]');

  for (const input of inputs) {
    const key = input.dataset.setting as keyof Settings;
    input.addEventListener('input', () =>
      updateSettings({ [key]: input.type === 'checkbox' ? input.checked : Number(input.value) }),
    );
  }
  for (const b of qualityButtons) {
    b.addEventListener('click', () => updateSettings({ quality: b.dataset.quality as Quality }));
  }

  onSettings((s) => {
    for (const input of inputs) {
      const value = s[input.dataset.setting as keyof Settings];
      if (input.type === 'checkbox') input.checked = value as boolean;
      else {
        input.value = String(value);
        const out = input.nextElementSibling as HTMLOutputElement | null;
        if (out) out.textContent = FORMAT[input.dataset.format ?? 'pct'](value as number);
      }
    }
    for (const b of qualityButtons)
      b.setAttribute('aria-pressed', String(b.dataset.quality === s.quality));
  });
}
