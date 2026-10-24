import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for the browser's Image: URLs containing "bad" fail, the rest load (a tick later). */
class FakeImage {
  static created: string[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(url: string) {
    FakeImage.created.push(url);
    setTimeout(() => (url.includes('bad') ? this.onerror?.() : this.onload?.()), 0);
  }
}

describe('preloading pictures before a screen shows them', () => {
  beforeEach(() => {
    FakeImage.created = [];
    vi.stubGlobal('Image', FakeImage);
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the first URL that works, once, and says when every picture has settled', async () => {
    const { imagesSettled, preloadImage, preloadImages } = await import('./image-preload');
    const lists = [['bad/masters.png', 'good/usual.png'], ['good/other.png']];
    expect(imagesSettled(lists)).toBe(false);
    await preloadImages(lists);
    expect(imagesSettled(lists)).toBe(true);
    // Both pictures load at once; the first falls back to its next URL.
    expect([...FakeImage.created].sort()).toEqual(['bad/masters.png', 'good/other.png', 'good/usual.png']);
    // Loaded already: nothing loads again.
    await preloadImage(lists[0]);
    expect(FakeImage.created).toHaveLength(3);
  });

  it('counts a picture whose URLs all fail as settled (the screen shows its placeholder; nothing to wait for)', async () => {
    const { imagesSettled, preloadImage } = await import('./image-preload');
    await preloadImage(['bad/a.png', 'bad/b.png']);
    expect(imagesSettled([['bad/a.png', 'bad/b.png']])).toBe(true);
  });

  it('shares one load between screens asking for the same picture at once', async () => {
    const { preloadImage } = await import('./image-preload');
    await Promise.all([preloadImage(['good/x.png']), preloadImage(['good/x.png'])]);
    expect(FakeImage.created).toEqual(['good/x.png']);
  });
});
