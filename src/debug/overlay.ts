import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';

/** F3 toggles. On by default in dev or with `?debug`. */
export function createDebugOverlay(engine: Engine, scene: Scene) {
  const el = document.getElementById('debug')!;
  const inst = new SceneInstrumentation(scene);
  let visible = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  el.hidden = !visible;

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F3') return;
    e.preventDefault();
    visible = !visible;
    el.hidden = !visible;
  });

  let last = performance.now();
  let frameMs = 1000 / 60;
  let worstMs = 0;
  let nextUpdate = 0;
  let report: string | null = null;

  return {
    update() {
      const now = performance.now();
      const dt = now - last;
      last = now;
      frameMs += (dt - frameMs) * 0.1;
      worstMs = Math.max(worstMs, dt);
      if (report !== null || !visible || now < nextUpdate) return;
      nextUpdate = now + 250; // DOM writes 4x/s, not every frame
      // performance.memory is Chromium-only
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      el.textContent = [
        `FPS      ${engine.getFps().toFixed(0)}`,
        `frame    ${frameMs.toFixed(1)} ms (max ${worstMs.toFixed(1)})`,
        `draws    ${inst.drawCallsCounter.current}`,
        `meshes   ${scene.getActiveMeshes().length}`,
        mem ? `heap     ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '',
      ]
        .filter(Boolean)
        .join('\n');
      worstMs = 0;
    },
    /** Freezes the overlay on a final report (e.g. benchmark results). */
    showReport(text: string) {
      report = text;
      visible = true;
      el.hidden = false;
      el.textContent = text;
    },
  };
}
