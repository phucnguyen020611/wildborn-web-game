import { onSettings } from '../settings/settings';
import { track } from '../core/loading';

const urls = import.meta.glob<string>('../assets/audio/*.m4a', {
  query: '?url',
  import: 'default',
  eager: true,
});
const nameOf = (path: string) => path.split('/').pop()!.replace('.m4a', '');

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Web Audio with two buses (sfx, ambience) under a master gain.
 * Browsers block audio until a user gesture, so call `unlock()` from a click handler.
 */
export function createAudio() {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  const sfx = ctx.createGain();
  const ambience = ctx.createGain();
  master.connect(ctx.destination);
  sfx.connect(master);
  ambience.connect(master);
  onSettings((st) => {
    master.gain.value = st.master;
    sfx.gain.value = st.sfx;
    ambience.gain.value = st.ambience;
  });

  const buffers = new Map<string, AudioBuffer>();
  for (const [path, url] of Object.entries(urls)) {
    track(
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => buffers.set(nameOf(path), buf)),
    ).catch((err) => console.error(`Failed to load sound ${path}`, err));
  }

  let unlocked = false;
  let ambienceSource: AudioBufferSourceNode | null = null;
  document.addEventListener('visibilitychange', () => {
    if (!unlocked) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  /** `name` matches a file in src/assets/audio; "sfx_hit" also picks among sfx_hit_1..n. */
  function play(name: string, at?: Vec3) {
    const variants = [...buffers.keys()].filter((k) => k === name || k.startsWith(`${name}_`));
    const buf = buffers.get(variants[Math.floor(Math.random() * variants.length)]);
    if (!buf || !unlocked) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.95 + Math.random() * 0.1; // small pitch variation so repeats don't sound copy-pasted
    if (at) {
      const panner = new PannerNode(ctx, {
        panningModel: 'equalpower',
        distanceModel: 'inverse',
        refDistance: 2,
        positionX: at.x,
        positionY: at.y,
        positionZ: -at.z, // left- to right-handed
      });
      src.connect(panner).connect(sfx);
    } else {
      src.connect(sfx);
    }
    src.start();
  }

  function startAmbience() {
    const buf = buffers.get('amb_forest');
    if (!buf || ambienceSource) return;
    ambienceSource = ctx.createBufferSource();
    ambienceSource.buffer = buf;
    ambienceSource.loop = true;
    ambienceSource.connect(ambience);
    ambienceSource.start();
  }

  return {
    play,
    unlock() {
      unlocked = true;
      ctx.resume();
      startAmbience();
    },
    /** Called every frame. Babylon is left-handed (+z forward); Web Audio is right-handed, so z is flipped. */
    setListener(pos: Vec3, yaw: number, pitch: number) {
      if (ambienceSource === null && unlocked) startAmbience(); // ambience may finish loading after unlock
      const l = ctx.listener;
      const cp = Math.cos(pitch);
      const f = { x: Math.sin(yaw) * cp, y: -Math.sin(pitch), z: -Math.cos(yaw) * cp };
      if (l.positionX) {
        const t = ctx.currentTime;
        l.positionX.setValueAtTime(pos.x, t);
        l.positionY.setValueAtTime(pos.y, t);
        l.positionZ.setValueAtTime(-pos.z, t);
        l.forwardX.setValueAtTime(f.x, t);
        l.forwardY.setValueAtTime(f.y, t);
        l.forwardZ.setValueAtTime(f.z, t);
        l.upX.setValueAtTime(0, t);
        l.upY.setValueAtTime(1, t);
        l.upZ.setValueAtTime(0, t);
      } else {
        // Firefox: AudioParam-based listener not available
        l.setPosition(pos.x, pos.y, -pos.z);
        l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
      }
    },
  };
}
