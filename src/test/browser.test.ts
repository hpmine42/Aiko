import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, shareText } from '../utils/browser';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('clipboard and share feedback', () => {
  it('reports a successful native clipboard write', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    expect(await copyText('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('reports failure when the clipboard fallback fails', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    expect(await copyText('hello')).toBe(false);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('distinguishes a completed share from user cancellation', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    expect(await shareText('hello')).toBe('shared');

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException('Dismissed', 'AbortError')),
    });
    expect(await shareText('hello')).toBe('cancelled');
  });

  it('falls back to copying after share failure and reports failed fallback accurately', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('share unavailable')),
    });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    expect(await shareText('hello')).toBe('copied');

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => false) });
    expect(await shareText('hello')).toBe('failed');
  });
});
