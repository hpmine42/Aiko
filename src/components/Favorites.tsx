import { useMemo } from 'react';
import { useModalFocus } from '../hooks/useModalFocus';
import { plain } from '../engine/aikoEngine';
import { Icon } from './Icon';
import type { Chat } from '../types';

/* Favoriten: übergreifende Liste aller mit Stern markierten Antworten.
   Eintrag antippen öffnet den Chat, der Stern entfernt die Markierung. */

interface FavoritesProps {
  open: boolean;
  chats: Chat[];
  onClose: () => void;
  onOpenChat: (id: string) => void;
  onRemove: (chatId: string, index: number) => void;
}

interface FavoriteEntry {
  chatId: string;
  chatTitle: string;
  index: number;
  text: string;
  ts: number;
}

const excerpt = (text: string, length = 180): string => {
  const flat = plain(text).replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
};

export function Favorites({ open, chats, onClose, onOpenChat, onRemove }: FavoritesProps) {
  const pageRef = useModalFocus<HTMLDivElement>(open, { onEscape: onClose });

  const entries = useMemo<FavoriteEntry[]>(() => {
    const list: FavoriteEntry[] = [];
    for (const chat of chats) {
      if (chat.temp) continue;
      chat.messages.forEach((message, index) => {
        if (message.role !== 'assistant' || !message.fav) return;
        list.push({
          chatId: chat.id,
          chatTitle: chat.title,
          index,
          text: excerpt(message.variants[message.vi] || message.variants[0] || ''),
          ts: message.ts,
        });
      });
    }
    return list.sort((a, b) => b.ts - a.ts);
  }, [chats]);

  return (
    <section
      ref={pageRef}
      className={`page${open ? ' open' : ''}`}
      id="favPage"
      role="dialog"
      aria-modal="true"
      aria-labelledby="favorites-title"
      tabIndex={-1}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <div className="ph">
        <button type="button" className="ib" aria-label="Schließen" onClick={onClose} disabled={!open}><Icon name="close" /></button>
        <h2 id="favorites-title">Favoriten</h2>
        <span style={{ width: 40 }} />
      </div>
      <div className="pb">
        <div className="pbi">
          {entries.length === 0 ? (
            <div className="card">
              <div className="help" style={{ padding: '14px 6px' }}>
                Noch keine Favoriten. Tippe bei einer Antwort auf den ☆-Stern – hier landen dann deine wichtigsten
                Antworten aus allen Chats, solange Aiko auf dem Gerät bleibt.
              </div>
            </div>
          ) : (
            <div className="card">
              {entries.map((entry) => (
                <div className="fav-item" key={`${entry.chatId}:${entry.index}`}>
                  <button type="button" className="fav-open" onClick={() => onOpenChat(entry.chatId)}>
                    <span className="fav-excerpt">{entry.text}</span>
                    <span className="fav-meta">
                      {entry.chatTitle} · {new Date(entry.ts).toLocaleDateString('de-DE')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ib fav-remove"
                    aria-label="Favorit entfernen"
                    onClick={() => onRemove(entry.chatId, entry.index)}
                  ><Icon name="star" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
