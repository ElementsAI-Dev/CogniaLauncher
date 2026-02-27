import {
  getBackgroundImage,
  setBackgroundImageData,
  removeBackgroundImage,
  notifyBackgroundChange,
  compressImage,
  BG_CHANGE_EVENT,
} from './background';

describe('background', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getBackgroundImage', () => {
    it('returns null when no image is stored', () => {
      expect(getBackgroundImage()).toBeNull();
    });

    it('returns stored image data URL', () => {
      localStorage.setItem('cognia-bg-image', 'data:image/jpeg;base64,abc');
      expect(getBackgroundImage()).toBe('data:image/jpeg;base64,abc');
    });

    it('returns null when localStorage throws', () => {
      const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('quota');
      });
      expect(getBackgroundImage()).toBeNull();
      spy.mockRestore();
    });
  });

  describe('setBackgroundImageData', () => {
    it('stores data URL in localStorage', () => {
      setBackgroundImageData('data:image/png;base64,xyz');
      expect(localStorage.getItem('cognia-bg-image')).toBe('data:image/png;base64,xyz');
    });

    it('overwrites existing data', () => {
      setBackgroundImageData('data:image/png;base64,first');
      setBackgroundImageData('data:image/png;base64,second');
      expect(localStorage.getItem('cognia-bg-image')).toBe('data:image/png;base64,second');
    });
  });

  describe('removeBackgroundImage', () => {
    it('removes the stored image', () => {
      localStorage.setItem('cognia-bg-image', 'data:image/png;base64,xyz');
      removeBackgroundImage();
      expect(localStorage.getItem('cognia-bg-image')).toBeNull();
    });

    it('does not throw when nothing is stored', () => {
      expect(() => removeBackgroundImage()).not.toThrow();
    });

    it('does not throw when localStorage throws', () => {
      const spy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('quota');
      });
      expect(() => removeBackgroundImage()).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('notifyBackgroundChange', () => {
    it('dispatches a custom event', () => {
      const handler = jest.fn();
      window.addEventListener(BG_CHANGE_EVENT, handler);

      notifyBackgroundChange();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.any(CustomEvent));

      window.removeEventListener(BG_CHANGE_EVENT, handler);
    });
  });

  describe('BG_CHANGE_EVENT', () => {
    it('is a string constant', () => {
      expect(typeof BG_CHANGE_EVENT).toBe('string');
      expect(BG_CHANGE_EVENT).toBe('cognia-bg-change');
    });
  });

  describe('compressImage', () => {
    let mockCanvas: {
      width: number;
      height: number;
      getContext: jest.Mock;
      toDataURL: jest.Mock;
    };
    let mockCtx: { drawImage: jest.Mock };

    beforeEach(() => {
      mockCtx = { drawImage: jest.fn() };
      mockCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue(mockCtx),
        toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,abc'),
      };
      jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return document.createElement(tag);
      });
      globalThis.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      globalThis.URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns a data URL string', async () => {
      // Mock Image loading
      const mockImage = {
        naturalWidth: 800,
        naturalHeight: 600,
        onload: null as (() => void) | null,
        onerror: null as ((e: unknown) => void) | null,
        set src(_: string) {
          setTimeout(() => this.onload?.(), 0);
        },
      };
      jest.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const blob = new Blob(['test'], { type: 'image/png' });
      const result = await compressImage(blob);

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('scales down images larger than 1920px', async () => {
      const mockImage = {
        naturalWidth: 3840,
        naturalHeight: 2160,
        onload: null as (() => void) | null,
        onerror: null as ((e: unknown) => void) | null,
        set src(_: string) {
          setTimeout(() => this.onload?.(), 0);
        },
      };
      jest.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const blob = new Blob(['test'], { type: 'image/png' });
      await compressImage(blob);

      // Canvas should be scaled down to fit within 1920
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);
    });

    it('reduces quality iteratively if image is too large', async () => {
      const mockImage = {
        naturalWidth: 800,
        naturalHeight: 600,
        onload: null as (() => void) | null,
        onerror: null as ((e: unknown) => void) | null,
        set src(_: string) {
          setTimeout(() => this.onload?.(), 0);
        },
      };
      jest.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      // Return a large data URL that exceeds maxSizeKB=1 on first calls, then a small one
      let callCount = 0;
      mockCanvas.toDataURL.mockImplementation(() => {
        callCount++;
        if (callCount <= 7) {
          // Each 'A' in base64 → ~0.75 bytes, so 2000 chars ≈ 1500 bytes > 1KB
          return 'data:image/jpeg;base64,' + 'A'.repeat(2000);
        }
        return 'data:image/jpeg;base64,tiny';
      });

      const blob = new Blob(['test'], { type: 'image/png' });
      const result = await compressImage(blob, 1); // 1KB max forces iteration

      expect(result).toContain('data:image/jpeg;base64,');
      expect(mockCanvas.toDataURL.mock.calls.length).toBeGreaterThan(1);
    });

    it('does not scale images within 1920px', async () => {
      const mockImage = {
        naturalWidth: 1000,
        naturalHeight: 800,
        onload: null as (() => void) | null,
        onerror: null as ((e: unknown) => void) | null,
        set src(_: string) {
          setTimeout(() => this.onload?.(), 0);
        },
      };
      jest.spyOn(globalThis, 'Image').mockImplementation(() => mockImage as unknown as HTMLImageElement);

      const blob = new Blob(['test'], { type: 'image/png' });
      await compressImage(blob);

      expect(mockCanvas.width).toBe(1000);
      expect(mockCanvas.height).toBe(800);
    });
  });
});
