/**
 * Helpers for the Node-side genogram integration tests. Polyfills the
 * handful of browser APIs the pipeline expects so it can run end-to-end
 * against real fixture images without a browser.
 *
 * Used by `pipeline.integration.test.ts`.
 */

import { createCanvas, loadImage, type Canvas, type Image } from 'canvas';
import { readFileSync } from 'fs';

type NodeBlobLike = Blob & { __nodeBuffer?: Uint8Array };

/**
 * Polyfill the browser `createImageBitmap` global by decoding via the
 * node `canvas` package. Idempotent — calling it twice is a no-op.
 */
const TRACE = (msg: string) => {
  if (process.env?.GENOGRAM_DEBUG !== '1') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('fs').writeSync(2, `  [polyfill] ${msg}\n`);
  } catch {
    process.stderr.write(`  [polyfill] ${msg}\n`);
  }
};

export function installCreateImageBitmapPolyfill(): void {
  if (typeof (globalThis as { createImageBitmap?: unknown }).createImageBitmap === 'function') {
    return;
  }
  // Use a permissive signature here — the canvas-package polyfill only
  // supports the Blob overload, but TS sees the browser's wider signature.
  (globalThis as unknown as { createImageBitmap: (blob: Blob) => Promise<ImageBitmap> }).createImageBitmap = async (
    blob: Blob
  ): Promise<ImageBitmap> => {
    TRACE('createImageBitmap polyfill called');
    const buf = await blobToBuffer(blob);
    TRACE(`buffer ready (${buf.length} bytes), loading image…`);
    const img = (await loadImage(buf)) as Image;
    TRACE(`image loaded ${img.width}x${img.height}`);
    return {
      width: img.width,
      height: img.height,
      close: () => {},
      _img: img,
    } as unknown as ImageBitmap;
  };
}

/**
 * Polyfill `document.createElement('canvas')` so the pipeline's
 * preprocess step can draw the decoded image into a 2D context. Other
 * createElement calls fall through to whatever document is already there
 * (jsdom in vitest), or no-op if document is absent.
 */
export function installCanvasCreateElementPolyfill(): void {
  // jsdom provides document, but its canvas is a stub. We replace
  // createElement for 'canvas' tag only.
  if (typeof document === 'undefined') {
    (globalThis as { document: Document }).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return wrapNodeCanvas(createCanvas(1, 1));
        }
        throw new Error(`Stub document.createElement does not handle <${tag}>`);
      },
    } as unknown as Document;
    return;
  }
  const originalCreate = document.createElement.bind(document);
  document.createElement = ((tag: string, opts?: ElementCreationOptions) => {
    if (tag === 'canvas') return wrapNodeCanvas(createCanvas(1, 1));
    return originalCreate(tag, opts);
  }) as typeof document.createElement;
}

/**
 * Wrap a node `Canvas` into a shape the pipeline can use. The pipeline
 * sets `canvas.width = …`, `canvas.height = …`, then calls
 * `getContext('2d')`, `drawImage(bitmap, 0, 0, w, h)`, and `getImageData`.
 */
function wrapNodeCanvas(canvas: Canvas): HTMLCanvasElement {
  // Node Canvas's setter for width/height clears the buffer — matches browser.
  return canvas as unknown as HTMLCanvasElement;
}

/** Read a Blob's bytes into a Buffer for the node decoder. */
async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const cached = (blob as NodeBlobLike).__nodeBuffer;
  if (cached) return Buffer.from(cached);
  const arrayBuf = await blob.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Convenience: load a test-fixture path as a Blob the pipeline accepts.
 * Returns synchronously; caller awaits any pipeline use.
 */
export function fixtureAsBlob(absolutePath: string, mimeType?: string): Blob {
  const buf = readFileSync(absolutePath);
  const guess = absolutePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const blob = new Blob([new Uint8Array(buf)], { type: mimeType ?? guess }) as NodeBlobLike;
  blob.__nodeBuffer = new Uint8Array(buf); // shortcut for the polyfill
  return blob;
}

/**
 * Patch the canvas `drawImage` to accept our polyfilled ImageBitmap (which
 * is actually a wrapper around a node `Image`). Without this, drawImage
 * throws because the ImageBitmap isn't a real one.
 */
export function patchCanvasDrawImage(): void {
  // Node canvas's drawImage accepts any object with a width/height plus the
  // internal _img. The pipeline calls ctx.drawImage(bitmap, 0, 0, w, h);
  // when bitmap._img exists, swap it in.
  const proto = (createCanvas(1, 1).getContext('2d') as unknown as { __proto__: object }).__proto__;
  const original = (proto as { drawImage: (...a: unknown[]) => void }).drawImage;
  (proto as { drawImage: (...a: unknown[]) => void }).drawImage = function (
    this: unknown,
    src: unknown,
    ...rest: unknown[]
  ) {
    const realSrc = (src as { _img?: Image })._img ?? src;
    return original.call(this, realSrc, ...rest);
  };
}
