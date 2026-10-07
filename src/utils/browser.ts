import type { Chat } from '../types';
import { plain, withName } from '../engine/aikoEngine';

export async function copyText(text: string): Promise<void> {
  const fallback = (): void => {
    const active = document.activeElement as HTMLElement | null;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); } catch { /* no clipboard available */ }
    textarea.remove();
    try { active?.focus(); } catch { /* detached element */ }
  };
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else fallback();
  } catch {
    fallback();
  }
}

export function downloadBlob(content: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

export function plainCopy(source: string): string {
  return String(source)
    .replace(/```[\w+#.-]*\n?/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

export function activeAssistantText(chat: Chat): string | null {
  for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
    const message = chat.messages[index];
    if (message.role === 'assistant') return message.variants[message.vi] || '';
  }
  return null;
}

export function exportChatMarkdown(chat: Chat, assistantName: string): void {
  const name = assistantName || 'Aiko';
  const lines = [
    `# ${chat.title || 'Neuer Chat'}`,
    '',
    `_Exportiert am ${new Date().toLocaleString('de-DE')} · ${name}_`,
    '',
    '---',
    '',
  ];
  chat.messages.forEach((message) => {
    if (message.role === 'user') lines.push(`**Du:** ${message.content.replace(/\n/g, '\n\n')}`, '');
    else lines.push(`**${name}:** ${plain(withName(message.variants[message.vi] || ''))}`, '');
  });
  const filename = (chat.title || name || 'Aiko').replace(/[\\/:*?"<>|]/g, '-').slice(0, 40) || 'Aiko';
  downloadBlob(lines.join('\n'), 'text/markdown;charset=utf-8', `${filename}.md`);
}

export async function shareText(text: string): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return true;
    }
  } catch {
    return false;
  }
  await copyText(text);
  return false;
}

export function resizeAvatar(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas wird nicht unterstützt');
          const side = Math.min(image.width, image.height);
          context.drawImage(
            image,
            (image.width - side) / 2,
            (image.height - side) / 2,
            side,
            side,
            0,
            0,
            size,
            size,
          );
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Bild konnte nicht gelesen werden'));
        }
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
