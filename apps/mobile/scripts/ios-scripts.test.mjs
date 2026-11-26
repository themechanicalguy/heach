import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { describe, it } from 'node:test';
import { inflateSync } from 'node:zlib';
import { buildArguments } from './ios-apps.mjs';
import { BRANDS, colourContents, iconPng, infoPlistStrings } from './ios-resources.mjs';

describe('infoPlistStrings', () => {
  it('writes the camera text from the catalogue, escaped for a .strings file', () => {
    const strings = infoPlistStrings({ app: { cameraPurpose: 'Say "cheese" \\ smile' } });
    assert.match(strings, /^"NSCameraUsageDescription" = "Say \\"cheese\\" \\\\ smile";$/m);
  });
});

describe('iconPng', () => {
  const size = 36;
  const png = iconPng(size, BRANDS.patient);
  const pixel = (x, y) => {
    const data = inflateSync(png.subarray(41, png.length - 16));
    const at = y * (1 + size * 3) + 1 + x * 3;
    return [...data.subarray(at, at + 3)];
  };

  it('is an opaque RGB PNG of the asked size', () => {
    assert.deepEqual([...png.subarray(1, 4)], [...Buffer.from('PNG')]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(png[25], 2); // colour type RGB: no transparency
  });

  it('draws a white cross on the brand colour', () => {
    assert.deepEqual(pixel(18, 18), [255, 255, 255]);
    assert.deepEqual(pixel(1, 1), BRANDS.patient);
    assert.deepEqual(pixel(9, 9), BRANDS.patient); // between the arms
  });
});

describe('colourContents', () => {
  it('writes the brand colour as an sRGB colour set', () => {
    const colour = JSON.parse(colourContents(BRANDS.provider)).colors[0].color;
    assert.equal(colour['color-space'], 'srgb');
    assert.deepEqual(colour.components, {
      red: '0x24',
      green: '0x1A',
      blue: '0x38',
      alpha: '1.000',
    });
  });
});

describe('buildArguments', () => {
  it('builds the asked app and passes on only the server settings that are set', () => {
    const args = buildArguments('provider', {
      HEACH_SERVER_URL: 'http://localhost:4000',
      HOME: '/x',
    });
    assert.ok(args.includes('HEACH_AUDIENCE=provider'));
    assert.ok(args.includes('HEACH_SERVER_URL=http://localhost:4000'));
    assert.ok(
      !args.some((arg) => arg.startsWith('HEACH_ALLOW_NAVIGATION') || arg.startsWith('HOME')),
    );
    assert.equal(args.at(-1), 'build');
  });
});
