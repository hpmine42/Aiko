import { useRef, useState } from 'react';
import type { AikoConfig, Chat } from '../types';
import { Icon } from './Icon';
import { Popover } from './Popover';

interface HeaderProps {
  config: AikoConfig;
  chat: Chat;
  hasUnreadChat: boolean;
  onOpenSidebar: () => void;
  onSelectModel: (id: string) => void;
  onToggleTemporary: () => void;
  onNewChat: () => void;
  onShare: () => void;
  onExport: () => void;
  onRename: () => void;
  onOpenRules: () => void;
  onDelete: () => void;
  toast: (message: string) => void;
}

export function Header({
  config,
  chat,
  hasUnreadChat,
  onOpenSidebar,
  onSelectModel,
  onToggleTemporary,
  onNewChat,
  onShare,
  onExport,
  onRename,
  onOpenRules,
  onDelete,
  toast,
}: HeaderProps) {
  const [modelOpen, setModelOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const modelRef = useRef<HTMLButtonElement>(null);
  const chatRef = useRef<HTMLButtonElement>(null);
  const empty = chat.messages.length === 0;

  return (
    <header id="top">
      <button
        type="button"
        className={`ib${hasUnreadChat ? ' dot' : ''}`}
        id="bMenu"
        aria-label="Seitenleiste öffnen"
        onClick={onOpenSidebar}
      >
        <Icon name="menu" />
      </button>
      <button
        ref={modelRef}
        type="button"
        className="model"
        id="bModel"
        aria-label="Antwortmodus wählen"
        aria-expanded={modelOpen}
        onClick={() => { setModelOpen((value) => !value); setChatOpen(false); }}
      >
        <span id="brand">{config.assistantName}</span><Icon name="chevD" />
      </button>
      <div className="spacer" />
      <button
        ref={chatRef}
        type="button"
        className="ib"
        id="topRight"
        aria-label={empty ? 'Temporärer Chat' : 'Chat-Optionen'}
        style={{ color: empty && chat.temp ? 'var(--accent2)' : undefined }}
        onClick={() => {
          if (empty) {
            onToggleTemporary();
            toast(chat.temp ? 'Temporärer Chat beendet' : 'Temporärer Chat – wird nicht gespeichert');
          } else {
            setChatOpen((value) => !value);
            setModelOpen(false);
          }
        }}
      >
        <Icon name={empty ? 'temp' : 'dots'} />
      </button>

      <Popover open={modelOpen} anchor={modelRef} onClose={() => setModelOpen(false)}>
        <div className="phead">Antwortmodus</div>
        <div className="mode-info">Nur Tippgeschwindigkeit und Antwortpause – hier werden keine KI-Modelle gewählt.</div>
        {config.models.map((model) => (
          <button
            type="button"
            className="pi"
            key={model.id}
            onClick={() => {
              onSelectModel(model.id);
              setModelOpen(false);
              toast(`Antwortmodus „${model.label}“ ausgewählt`);
            }}
          >
            <span className="tx">{model.label}<span className="desc">{model.desc}</span></span>
            {model.id === chat.model && <span className="ck"><Icon name="check" /></span>}
          </button>
        ))}
      </Popover>

      <Popover open={chatOpen} anchor={chatRef} align="right" onClose={() => setChatOpen(false)}>
        <MenuItem icon="newchat" label="Neuer Chat" action={onNewChat} close={() => setChatOpen(false)} />
        <MenuItem icon="share" label="Teilen" action={onShare} close={() => setChatOpen(false)} />
        <MenuItem icon="share" label="Als Markdown exportieren" action={onExport} close={() => setChatOpen(false)} />
        <MenuItem icon="edit" label="Umbenennen" action={onRename} close={() => setChatOpen(false)} />
        <MenuItem icon="rules" label="Antworten festlegen" action={onOpenRules} close={() => setChatOpen(false)} />
        <MenuItem icon="trash" label="Löschen" action={onDelete} close={() => setChatOpen(false)} danger />
      </Popover>
    </header>
  );
}

interface MenuItemProps {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  action: () => void;
  close: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, action, close, danger }: MenuItemProps) {
  return (
    <button type="button" className={`pi${danger ? ' danger' : ''}`} onClick={() => { close(); action(); }}>
      <Icon name={icon} /><span className="tx">{label}</span>
    </button>
  );
}
