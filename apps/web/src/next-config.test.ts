// @vitest-environment node
import nextConfig from '../next.config';

describe('next.config', () => {
  it('PF-05.1 serves images as AVIF or WebP only', () => {
    expect(nextConfig.images?.formats).toEqual(['image/avif', 'image/webp']);
  });
});
