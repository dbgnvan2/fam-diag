/**
 * Source-level regression test for the File-menu label of the image import.
 *
 * AppRibbon takes a large number of props/handlers, so — following the same
 * source-assertion pattern used in ImageDiagramModal.test.tsx — this reads the
 * component source and checks the menu entry rather than fully rendering it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('AppRibbon — File menu image-import label', () => {
  const source = readFileSync(join(__dirname, 'AppRibbon.tsx'), 'utf8');

  it('labels the image-import entry "Import Family Diagram"', () => {
    expect(source).toMatch(/label:\s*'Import Family Diagram',\s*action:\s*handleImageDiagramPicker/);
  });

  it('no longer uses the old "Image Diagram" label', () => {
    expect(source).not.toMatch(/label:\s*'Image Diagram'/);
  });
});
