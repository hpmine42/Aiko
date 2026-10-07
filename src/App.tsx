import { useCallback, useEffect, useRef, useState } from 'react';
import { AttachmentSheet } from './components/AttachmentSheet';
import { Composer } from './components/Composer';
import { Dialog } from './components/Dialog';
import { Header } from './components/Header';
import { MessageList, type MessageListHandle } from './components/MessageList';
import { Settings } from './components/Settings';
import { Sidebar } from './components/Sidebar';
import { TimerDock } from './components/TimerDock';
import { Toast } from './components/Toast';
import { useAiko } from './hooks/useAiko';
import { useDialog } from './hooks/useDialog';
import { useToast } from './hooks/useToast';
import { copyText, exportChatMarkdown, plainCopy, shareText } from './utils/browser';
import { withName } from './engine/aikoEngine';

export default function App() {
  const toastState = useToast();
  const dialog = useDialog();
  const aiko = useAiko({ toast: toastState.show });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsRulesOpen, setSettingsRulesOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [showToBottom, setShowToBottom] = useState(false);
  const messageList = useRef<MessageListHandle>(null);

  const openSettings = useCallback((rules = false) => {
    setSettingsRulesOpen(rules);
    setSettingsOpen(true);
  }, []);

  const transcript = useCallback(() => aiko.current.messages.map((message) => {
    if (message.role === 'user') return `Du: ${message.content}`;
    return `${aiko.config.assistantName}: ${plainCopy(withName(message.variants[message.vi] || ''))}`;
  }).join('\n\n'), [aiko.config.assistantName, aiko.current.messages]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        aiko.newChat();
      } else if (modifier && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        const last = [...aiko.current.messages].reverse().find((message) => message.role === 'assistant');
        if (last?.role === 'assistant') {
          void copyText(plainCopy(withName(last.variants[last.vi] || '')));
          toastState.show('Letzte Antwort kopiert');
        }
      } else if (event.key === 'Escape') {
        if (settingsOpen || attachmentOpen) return;
        if (sidebarOpen) setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aiko, attachmentOpen, settingsOpen, sidebarOpen, toastState]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const resize = () => {
      const app = document.querySelector<HTMLElement>('#app');
      if (app) app.style.height = `${viewport.height}px`;
      messageList.current?.scrollBottom(false);
    };
    viewport.addEventListener('resize', resize);
    return () => viewport.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let startX: number | null = null;
    let startY = 0;
    let wasOpen = false;
    const start = (event: TouchEvent) => {
      const touch = event.touches[0];
      wasOpen = sidebarOpen;
      startX = (touch.clientX < 28 || wasOpen) && !settingsOpen ? touch.clientX : null;
      startY = touch.clientY;
    };
    const end = (event: TouchEvent) => {
      if (startX == null) return;
      const touch = event.changedTouches[0];
      const delta = touch.clientX - startX;
      if (Math.abs(touch.clientY - startY) < 60) {
        if (!wasOpen && delta > 60) { setSidebarOpen(true); aiko.clearUnread(); }
        else if (wasOpen && delta < -60) setSidebarOpen(false);
      }
      startX = null;
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchend', end, { passive: true });
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchend', end);
    };
  }, [aiko, settingsOpen, sidebarOpen]);

  return (
    <>
      <div id="app">
        <Header
          config={aiko.config}
          chat={aiko.current}
          hasUnreadChat={aiko.unreadChat}
          onOpenSidebar={() => { setSidebarOpen(true); aiko.clearUnread(); }}
          onSelectModel={aiko.selectModel}
          onToggleTemporary={aiko.toggleTemporary}
          onNewChat={aiko.newChat}
          onShare={async () => {
            const shared = await shareText(transcript());
            if (!shared) toastState.show('Link zum Teilen ist nicht verfügbar – Text kopiert');
          }}
          onExport={() => { exportChatMarkdown(aiko.current, aiko.config.assistantName); toastState.show('Chat exportiert'); }}
          onRename={() => {
            const title = window.prompt('Chat umbenennen', aiko.current.title);
            if (title?.trim()) aiko.renameChat(aiko.current, title.trim());
          }}
          onOpenRules={() => openSettings(true)}
          onDelete={() => aiko.deleteChat(aiko.current)}
          toast={toastState.show}
        />

        <MessageList
          ref={messageList}
          chat={aiko.current}
          config={aiko.config}
          generatingIndex={aiko.generatingIndex}
          thinking={aiko.thinking}
          onConfig={aiko.setConfig}
          onEdit={aiko.editUser}
          onRegenerate={aiko.regenerate}
          onVariant={aiko.setVariant}
          onFeedback={aiko.setFeedback}
          onSuggestion={aiko.send}
          toast={toastState.show}
          onBottomVisibility={setShowToBottom}
        />

        <TimerDock
          timers={aiko.timers.timers}
          onPause={aiko.timers.pause}
          onResume={aiko.timers.resume}
          onStop={aiko.timers.stop}
          onStopped={() => toastState.show('Timer gestoppt')}
        />

        <Composer
          busy={aiko.busy}
          showToBottom={showToBottom}
          onSend={aiko.send}
          onStop={aiko.stop}
          onAttachment={() => setAttachmentOpen(true)}
          onScrollBottom={() => messageList.current?.scrollBottom(true)}
          toast={toastState.show}
        />
      </div>

      <Sidebar
        open={sidebarOpen}
        config={aiko.config}
        chats={aiko.chats}
        currentId={aiko.current.id}
        onClose={() => setSidebarOpen(false)}
        onNewChat={aiko.newChat}
        onSettings={() => openSettings(false)}
        onSelect={aiko.selectChat}
        onPin={aiko.pinChat}
        onRename={aiko.renameChat}
        onExport={(chat) => { exportChatMarkdown(chat, aiko.config.assistantName); toastState.show('Chat exportiert'); }}
        onDelete={aiko.deleteChat}
      />

      <AttachmentSheet open={attachmentOpen} onClose={() => setAttachmentOpen(false)} toast={toastState.show} />

      <Settings
        open={settingsOpen}
        config={aiko.config}
        ui={aiko.ui}
        chats={aiko.chats}
        onConfig={aiko.setConfig}
        onUi={aiko.setUi}
        onChats={aiko.setChats}
        onClose={() => { setSettingsOpen(false); setSettingsRulesOpen(false); }}
        onClearChats={aiko.clearChats}
        confirm={dialog.confirm}
        toast={toastState.show}
        initialRulesOpen={settingsRulesOpen}
      />

      <Dialog options={dialog.options} onResult={dialog.result} />
      <Toast toast={toastState.toast} onAction={toastState.runAction} />
    </>
  );
}
