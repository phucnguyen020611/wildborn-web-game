// glTF loading setup shared by every model loader. Import this instead of the Babylon loader directly.
import '@babylonjs/loaders/glTF/2.0';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
// Self-host the decoder instead of Babylon's CDN default; the package's exports map hides this file, hence the path.
import meshoptDecoderUrl from '../../node_modules/meshoptimizer/meshopt_decoder.cjs?url';

MeshoptCompression.Configuration = { decoder: { url: meshoptDecoderUrl } };
// shortcut: KTX2 textures use Babylon's default decoder from cdn.babylonjs.com; self-host (KhronosTextureContainer2.URLConfig) before release.

import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { Scene } from '@babylonjs/core/scene';
import { track } from '../core/loading';

/** Loads a glTF into an AssetContainer and counts it toward the loading screen. */
export const loadContainer = (url: string, scene: Scene) =>
  track(LoadAssetContainerAsync(url, scene));
