import { useEffect, useMemo, useRef, useState } from 'react';
import type { AikoConfig, Chat } from '../types';
import { norm, plain, withName } from '../engine/aikoEngine';
import { Icon } from './Icon';
import { Popover } from './Popover';

interface SidebarProps {
  open: boolean;
  config: AikoConfig;
  chats: Chat[];
  currentId: string;
  onClose: () => void;
  onNewChat: () => void;
  onSettings: () => void;
  onSelect: (chat: Chat) => void;
  onPin: (chat: Chat) => void;
  onRename: (chat: Chat, title: string) => void;
  onExport: (chat: Chat) => void;
  onDelete: (chat: Chat) => void;
}

function groupLabel(timestamp: number): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  if (timestamp >= start) return 'Heute';
  if (timestamp >= start - day) return 'Gestern';
  if (timestamp >= start - 6 * day) return 'Letzte 7 Tage';
  if (timestamp >= start - 29 * day) return 'Letzte 30 Tage';
  return new Date(timestamp).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function searchableText(chat: Chat): string {
  return chat.messages.map((message) => message.role === 'user'
    ? message.content
    : plain(withName(message.variants[message.vi] || ''))).join(' ');
}

export function Sidebar({
  open,
  config,
  chats,
  currentId,
  onClose,
  onNewChat,
  onSettings,
  onSelect,
  onPin,
  onRename,
  onExport,
  onDelete,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [menuChat, setMenuChat] = useState<Chat | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const anchorRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      previousFocus.current?.focus();
      previousFocus.current = null;
      return undefined;
    }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const items = useMemo(() => {
    const search = norm(query);
    return [...chats]
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.ts - a.ts)
      .filter((chat) => !search || norm(chat.title).includes(search) || norm(searchableText(chat)).includes(search));
  }, [chats, query]);

  let previousGroup = '';
  const initial = (config.assistantName || 'Aiko').charAt(0).toUpperCase();

  return (
    <>
      <button type="button" className={`scrim${open ? ' on' : ''}`} aria-label="Seitenleiste schließen" aria-hidden={!open} tabIndex={open ? 0 : -1} onClick={onClose} />
      <aside id="side" className={open ? 'open' : ''} aria-label="Seitenleiste" aria-hidden={!open} inert={!open ? true : undefined}>
        <div className="stop">
          <label className="search">
            <Icon name="search" />
            <input
              ref={searchRef}
              id="search"
              type="search"
              placeholder="Chats durchsuchen"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="navw">
          <button type="button" className="nav" onClick={() => { onNewChat(); onClose(); }}>
            <Icon name="newchat" />Neuer Chat
          </button>
          <button type="button" className="nav" onClick={() => { onSettings(); onClose(); }}>
            <Icon name="rules" />Einstellungen
          </button>
        </div>
        <div className="list" id="list">
          {!items.length && <div className="noresult">{query ? 'Keine Chats gefunden.' : 'Deine Chats erscheinen hier.'}</div>}
          {items.map((chat) => {
            const group = chat.pinned ? 'Angeheftet' : groupLabel(chat.ts);
            const heading = group !== previousGroup;
            previousGroup = group;
            return (
              <div key={chat.id}>
                {heading && <div className="grp">{group}</div>}
                <div className={`crow2${chat.id === currentId ? ' active' : ''}`}>
                  {renaming === chat.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={() => {
                        if (renameValue.trim()) onRename(chat, renameValue.trim());
                        setRenaming(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        if (event.key === 'Escape') { setRenameValue(''); event.currentTarget.blur(); }
                      }}
                    />
                  ) : (
                    <button type="button" className="t" onClick={() => { onSelect(chat); onClose(); }}>
                      {chat.pinned ? '📌 ' : ''}{chat.title || 'Neuer Chat'}
                    </button>
                  )}
                  {renaming !== chat.id && (
                    <button
                      type="button"
                      className="more"
                      aria-label="Optionen"
                      onClick={(event) => {
                        anchorRef.current = event.currentTarget;
                        setMenuChat(chat);
                      }}
                    >
                      <Icon name="dots" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" className="profile" onClick={() => { onSettings(); onClose(); }}>
          <span className="pav">
            {config.avatar ? <img src={config.avatar} alt="" /> : initial}
          </span>
          <span className="nm">{config.userName || 'Profil'}</span>
          <Icon name="gear" />
        </button>
      </aside>

      <Popover open={Boolean(menuChat)} anchor={anchorRef} align="right" onClose={() => setMenuChat(null)}>
        {menuChat && (
          <>
            <SideAction icon="pin" label={menuChat.pinned ? 'Lösen' : 'Anheften'} onClick={() => { onPin(menuChat); setMenuChat(null); }} />
            <SideAction icon="edit" label="Umbenennen" onClick={() => {
              setRenameValue(menuChat.title);
              setRenaming(menuChat.id);
              setMenuChat(null);
            }} />
            <SideAction icon="share" label="Exportieren" onClick={() => { onExport(menuChat); setMenuChat(null); }} />
            <SideAction icon="trash" label="Löschen" danger onClick={() => { onDelete(menuChat); setMenuChat(null); }} />
          </>
        )}
      </Popover>
    </>
  );
}

function SideAction({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`pi${danger ? ' danger' : ''}`} onClick={onClick}>
      <Icon name={icon} /><span className="tx">{label}</span>
    </button>
  );
}
