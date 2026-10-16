// Optimizes every .glb/.gltf in art-source/ into src/assets/ (same relative path, always .glb);
// .blend/.fbx are first exported to glTF by headless Blender (set BLENDER=/path if not in a standard place),
// encodes art-source/audio/* to AAC (.m4a), which every target browser can decode, Safari included,
// and art-source/textures/* to KTX2.
// Game code imports outputs with `?url`, so Vite adds content hashes for long-term caching.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';

const SRC = 'art-source';
const OUT = 'src/assets';
const CLI = 'node_modules/.bin/gltf-transform';

const hasKtx = spawnSync('ktx', ['--version']).status === 0;
if (!hasKtx)
  console.warn('! `ktx` CLI not found: textures -> WebP. Install KTX-Software to get KTX2.\n');

function run(...args) {
  const r = spawnSync(CLI, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stdout);
    process.exit(r.status ?? 1);
  }
  return r.stdout;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const MAC_BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';
const BLENDER = process.env.BLENDER ?? (existsSync(MAC_BLENDER) ? MAC_BLENDER : 'blender');

/** Exports a .blend/.fbx to a temporary .glb with headless Blender; returns its path. */
function blenderExport(file) {
  const tmp = join(tmpdir(), `${basename(file)}.glb`);
  const script = 'tools/asset-pipeline/blender_export.py';
  const args = file.endsWith('.blend')
    ? ['-b', file, '--python', script, '--', file, tmp]
    : ['-b', '--factory-startup', '--python', script, '--', file, tmp];
  const r = spawnSync(BLENDER, args, { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(tmp)) {
    console.error(r.error ? `! cannot run Blender (${BLENDER})` : r.stdout + r.stderr);
    process.exit(1);
  }
  return tmp;
}

const filter = process.argv[2]; // optional: only rebuild sources whose path contains this text

for (const file of walk(SRC)) {
  if (filter && !file.includes(filter)) continue;
  if (/^art-source\/audio\//.test(file.replaceAll('\\', '/'))) {
    if (!hasFfmpeg) {
      console.error('! `ffmpeg` not found: cannot encode audio.');
      process.exit(1);
    }
    const out = join(OUT, relative(SRC, file)).replace(/\.\w+$/, '.m4a');
    mkdirSync(dirname(out), { recursive: true });
    const ambience = /\/amb_/.test(file);
    // SFX: mono 96 kbps; ambience loops: stereo 64 kbps per channel is plenty for a bed of noise.
    const args = ambience ? ['-ac', '2', '-b:a', '128k'] : ['-ac', '1', '-b:a', '96k'];
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-c:a', 'aac', ...args, out], {
      stdio: 'inherit',
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log(`${file} (${kb(file)}) -> ${out} (${kb(out)})`);
    continue;
  }
  if (/^art-source\/textures\/.*\.(png|jpe?g)$/i.test(file.replaceAll('\\', '/'))) {
    // Standalone textures (terrain): KTX2 with mipmaps. Colour: ETC1S at full size. Normal maps (`_nor`):
    // UASTC at half size, linear, RDO + zstd: from walking height 512² is plenty and a quarter the bytes.
    if (!hasKtx) {
      console.error('! `ktx` CLI not found: cannot encode textures.');
      process.exit(1);
    }
    const out = join(OUT, relative(SRC, file)).replace(/\.\w+$/, '.ktx2');
    mkdirSync(dirname(out), { recursive: true });
    const args = /_nor\./.test(file)
      ? [
          '--format',
          'R8G8B8_UNORM',
          '--assign-tf',
          'linear',
          '--scale',
          '0.5',
          '--encode',
          'uastc',
        ].concat(['--uastc-quality', '2', '--uastc-rdo', '--zstd', '18', '--normal-mode'])
      : ['--format', 'R8G8B8_SRGB', '--encode', 'basis-lz'];
    const r = spawnSync('ktx', ['create', ...args, '--generate-mipmap', file, out], {
      stdio: 'inherit',
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log(`${file} (${kb(file)}) -> ${out} (${kb(out)})`);
    continue;
  }
  const fromBlender = /\.(blend|fbx)$/i.test(file);
  if (!fromBlender && !/\.(glb|gltf)$/i.test(file)) continue;
  const out = join(OUT, relative(SRC, file)).replace(/\.\w+$/, '.glb');
  mkdirSync(dirname(out), { recursive: true });
  let input = fromBlender ? blenderExport(file) : file;
  // Quaternius exports vertex colors like 1.0002 (float rounding): harmless, so not fatal.
  run('validate', input, '--ignore', 'ACCESSOR_NON_CLAMPED');
  const tmps = fromBlender ? [input] : [];
  if (/environment/.test(file)) {
    // Bark normal maps are most of the kit's size (UASTC); seen from walking height 512² looks the same.
    // The pattern matches substrings, so '_Normal' would also catch the colour map 'Bark_NormalTree'.
    const small = join(tmpdir(), `${basename(file)}.normals.glb`);
    run('resize', input, small, '--pattern', 'Tree_Normal', '--width', '512', '--height', '512');
    tmps.push((input = small));
  }
  run(
    'optimize',
    input,
    out,
    '--compress',
    'meshopt',
    '--texture-compress',
    hasKtx ? 'ktx2' : 'webp',
    '--texture-size',
    '1024', // spec 10.4: start at 1K; raise per asset only with a reason
    '--join-named',
    'false', // keep named nodes (attach points, hitboxes) separate
  );
  tmps.forEach((t) => rmSync(t));
  console.log(`${file} (${kb(file)}) -> ${out} (${kb(out)})`);
}
