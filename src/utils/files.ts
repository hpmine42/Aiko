import type { FileAttachment } from '../types';

export const MAX_ATTACHMENTS = 10;

export function toFileAttachment(file: File): FileAttachment {
  return {
    name: file.name.slice(0, 255),
    size: Math.max(0, file.size),
    type: file.type.slice(0, 128),
    lastModified: Math.max(0, file.lastModified || 0),
  };
}

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size < 0) return 'Unbekannte Größe';
  if (size < 1_000) return `${size} B`;
  if (size < 1_000_000) return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(size / 1_000)} kB`;
  if (size < 1_000_000_000) return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(size / 1_000_000)} MB`;
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(size / 1_000_000_000)} GB`;
}
