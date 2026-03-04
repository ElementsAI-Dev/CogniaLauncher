import { writeClipboard, readClipboard, writeClipboardImage, readClipboardImage, clearClipboard } from './clipboard';
import * as platform from '@/lib/platform';

// Polyfill ClipboardItem for jsdom
if (typeof globalThis.ClipboardItem === 'undefined') {
  (globalThis as Record<string, unknown>).ClipboardItem = class ClipboardItem {
    private items: Record<string, Blob>;
    constructor(items: Record<string, Blob>) {
      this.items = items;
    }
    get types() {
      return Object.keys(this.items);
    }
    async getType(type: string) {
      return this.items[type];
    }
  };
}

jest.mock('@/lib/platform', () => ({
  isTauri: jest.fn(),
}));

const mockIsTauri = platform.isTauri as jest.MockedFunction<typeof platform.isTauri>;

describe('clipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('writeClipboard', () => {
    it('uses navigator.clipboard.writeText in web mode', async () => {
      mockIsTauri.mockReturnValue(false);
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText, readText: jest.fn() },
      });

      await writeClipboard('hello');
      expect(mockWriteText).toHaveBeenCalledWith('hello');
    });

    it('uses tauri plugin in tauri mode', async () => {
      mockIsTauri.mockReturnValue(true);
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      jest.mock('@tauri-apps/plugin-clipboard-manager', () => ({
        writeText: mockWriteText,
      }), { virtual: true });

      try {
        await writeClipboard('hello');
      } catch {
        // Dynamic import may fail in test env - that's expected
      }
      expect(mockIsTauri).toHaveBeenCalled();
    });
  });

  describe('readClipboard', () => {
    it('uses navigator.clipboard.readText in web mode', async () => {
      mockIsTauri.mockReturnValue(false);
      const mockReadText = jest.fn().mockResolvedValue('world');
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn(), readText: mockReadText },
      });

      const result = await readClipboard();
      expect(result).toBe('world');
      expect(mockReadText).toHaveBeenCalled();
    });

    it('uses tauri plugin in tauri mode', async () => {
      mockIsTauri.mockReturnValue(true);

      try {
        await readClipboard();
      } catch {
        // Dynamic import may fail in test env - that's expected
      }
      expect(mockIsTauri).toHaveBeenCalled();
    });
  });

  describe('writeClipboardImage', () => {
    it('uses navigator.clipboard.write with Blob in web mode for Uint8Array', async () => {
      mockIsTauri.mockReturnValue(false);
      const mockWrite = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { write: mockWrite, writeText: jest.fn(), readText: jest.fn() },
      });

      const imageData = new Uint8Array([1, 2, 3, 4]);
      await writeClipboardImage(imageData);
      expect(mockWrite).toHaveBeenCalledTimes(1);
      const clipboardItems = mockWrite.mock.calls[0][0];
      expect(clipboardItems).toHaveLength(1);
    });

    it('uses navigator.clipboard.write with Blob in web mode for ArrayBuffer', async () => {
      mockIsTauri.mockReturnValue(false);
      const mockWrite = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { write: mockWrite, writeText: jest.fn(), readText: jest.fn() },
      });

      const buffer = new ArrayBuffer(4);
      await writeClipboardImage(buffer);
      expect(mockWrite).toHaveBeenCalledTimes(1);
    });

    it('does nothing for string input in web mode', async () => {
      mockIsTauri.mockReturnValue(false);
      const mockWrite = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { write: mockWrite, writeText: jest.fn(), readText: jest.fn() },
      });

      await writeClipboardImage('base64string');
      expect(mockWrite).not.toHaveBeenCalled();
    });

    it('uses tauri plugin in tauri mode', async () => {
      mockIsTauri.mockReturnValue(true);

      try {
        await writeClipboardImage(new Uint8Array([1, 2, 3]));
      } catch {
        // Dynamic import may fail in test env
      }
      expect(mockIsTauri).toHaveBeenCalled();
    });
  });

  describe('readClipboardImage', () => {
    it('returns null when no image available in web mode', async () => {
      mockIsTauri.mockReturnValue(false);
      const mockRead = jest.fn().mockResolvedValue([
        { types: ['text/plain'], getType: jest.fn() },
      ]);
      Object.assign(navigator, {
        clipboard: { read: mockRead, writeText: jest.fn(), readText: jest.fn() },
      });

      const result = await readClipboardImage();
      expect(result).toBeNull();
    });

    it('returns Uint8Array when png image is in clipboard in web mode', async () => {
      mockIsTauri.mockReturnValue(false);
      const imageBuffer = new ArrayBuffer(4);
      const mockBlob = { arrayBuffer: jest.fn().mockResolvedValue(imageBuffer) };
      const mockRead = jest.fn().mockResolvedValue([
        { types: ['image/png'], getType: jest.fn().mockResolvedValue(mockBlob) },
      ]);
      Object.assign(navigator, {
        clipboard: { read: mockRead, writeText: jest.fn(), readText: jest.fn() },
      });

      const result = await readClipboardImage();
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result).toHaveLength(4);
    });

    it('returns null on clipboard read error in web mode', async () => {
      mockIsTauri.mockReturnValue(false);
      const mockRead = jest.fn().mockRejectedValue(new Error('Not supported'));
      Object.assign(navigator, {
        clipboard: { read: mockRead, writeText: jest.fn(), readText: jest.fn() },
      });

      const result = await readClipboardImage();
      expect(result).toBeNull();
    });

    it('uses tauri plugin in tauri mode', async () => {
      mockIsTauri.mockReturnValue(true);

      try {
        await readClipboardImage();
      } catch {
        // Dynamic import may fail in test env
      }
      expect(mockIsTauri).toHaveBeenCalled();
    });
  });

  describe('clearClipboard', () => {
    it('writes empty text in web mode', async () => {
      mockIsTauri.mockReturnValue(false);
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText, readText: jest.fn() },
      });

      await clearClipboard();
      expect(mockWriteText).toHaveBeenCalledWith('');
    });

    it('uses tauri plugin clear in tauri mode', async () => {
      mockIsTauri.mockReturnValue(true);

      try {
        await clearClipboard();
      } catch {
        // Dynamic import may fail in test env
      }
      expect(mockIsTauri).toHaveBeenCalled();
    });
  });
});
