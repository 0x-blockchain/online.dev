import JitsiStreamBackgroundEffect from './JitsiStreamBackgroundEffect';
import createTFLiteModule from './vendor/tflite/tflite';
import createTFLiteSIMDModule from './vendor/tflite/tflite-simd';
const models = {
  model96: 'libs/segm_lite_v681.tflite',
  model144: 'libs/segm_full_v679.tflite',
};

const segmentationDimensions = {
  model96: {
    height: 96,
    width: 160,
  },
  model144: {
    height: 144,
    width: 256,
  },
};

/**
 * Creates a new instance of JitsiStreamBackgroundEffect. This loads the Meet background model that is used to
 * extract person segmentation.
 *
 * @param {Object} virtualBackground - The virtual object that contains the background image source and
 * the isVirtualBackground flag that indicates if virtual image is activated.
 * @returns {Promise<JitsiStreamBackgroundEffect>}
 */
export async function createVirtualBackgroundEffect(virtualBackground: any) {
  if (!MediaStreamTrack.prototype.getSettings && !MediaStreamTrack.prototype.getConstraints) {
    throw new Error('JitsiStreamBackgroundEffect not supported!');
  }
  let tflite;
  let wasmCheck;

  // Checks if WebAssembly feature is supported or enabled by/in the browser.
  // Conditional import of wasm-check package is done to prevent
  // the browser from crashing when the user opens the app.

  try {
    wasmCheck = require('wasm-check');
    const tfliteTimeout = 10000;

    if (wasmCheck?.feature?.simd) {
      tflite = await timeout(tfliteTimeout, createTFLiteSIMDModule());
    } else {
      tflite = await timeout(tfliteTimeout, createTFLiteModule());
    }
  } catch (err) {
    console.error('Looks like WebAssembly is disabled or not supported on this browser');
    return;
  }

  const modelBufferOffset = tflite._getModelBufferMemoryOffset();
  const modelResponse = await fetch(wasmCheck.feature.simd ? models.model144 : models.model96);

  if (!modelResponse.ok) {
    throw new Error('Failed to download tflite model!');
  }

  const model = await modelResponse.arrayBuffer();

  tflite.HEAPU8.set(new Uint8Array(model), modelBufferOffset);
  tflite._loadModel(model.byteLength);

  const options = {
    ...(wasmCheck.feature.simd ? segmentationDimensions.model144 : segmentationDimensions.model96),
    virtualBackground,
  };

  return new JitsiStreamBackgroundEffect(tflite, options);
}

export function timeout(milliseconds: number, promise: Promise<any>): Promise<any> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('408'));

      return;
    }, milliseconds);

    promise.then(resolve, reject);
  });
}
