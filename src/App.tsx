import { useCallback, useEffect, useRef, useState } from 'react';
import { AttachmentSheet } from './components/AttachmentSheet';
import { Chat } from './components/Chat';
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
import { MAX_ATTACHMENTS, toFileAttachment } from './utils/files';

export default function App() {
  const toastState = useToast();
  const dialog = useDialog();
  const aiko = useAiko({ toast: toastState.show });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsRulesOpen, setSettingsRulesOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showToBottom, setShowToBottom] = useState(false);
  const messageList = useRef<MessageListHandle>(null);
  const reloadAfterServiceWorkerUpdate = useRef(false);

  const openSettings = useCallback((rules = false) => {
    setSettingsRulesOpen(rules);
    setSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return undefined;
    let active = true;
    let announcedWorker: ServiceWorker | null = null;
    const announceUpdate = (worker: ServiceWorker) => {
      if (announcedWorker === worker) return;
      announcedWorker = worker;
      toastState.show('Aiko-Update ist bereit', 'Jetzt neu laden', () => {
        reloadAfterServiceWorkerUpdate.current = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      });
    };
    const onControllerChange = () => {
      if (!reloadAfterServiceWorkerUpdate.current) return;
      reloadAfterServiceWorkerUpdate.current = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      if (!active) return;
      if (registration.waiting && navigator.serviceWorker.controller) announceUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (active && installing.state === 'installed' && navigator.serviceWorker.controller) announceUpdate(installing);
        });
      });
    }).catch(() => undefined);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [toastState.show]);

  const transcript = useCallback(() => aiko.current.messages.map((message) => {
    if (message.role === 'user') {
      const files = message.attachments?.map((file) => `\n[Datei: ${file.name}]`).join('') || '';
      return `Du: ${message.content}${files}`;
    }
    return `${aiko.config.assistantName}: ${plainCopy(withName(message.variants[message.vi] || ''))}`;
  }).join('\n\n'), [aiko.config.assistantName, aiko.current.messages]);

  const addFiles = useCallback((files: File[]) => {
    const available = Math.max(0, MAX_ATTACHMENTS - pendingFiles.length);
    const accepted = files.slice(0, available);
    if (accepted.length) setPendingFiles((current) => [...current, ...accepted]);
    if (accepted.length < files.length) toastState.show(`Maximal ${MAX_ATTACHMENTS} Dateien pro Nachricht`);
  }, [pendingFiles.length, toastState.show]);

  const requestSpeechConsent = useCallback(async () => {
    const accepted = await dialog.confirm({
      title: 'Diktieren aktivieren?',
      text: 'Die Browser-Spracherkennung wandelt deine Stimme in Text um. Je nach Browser kann die Audioverarbeitung durch einen externen Sprachdienst erfolgen. Aiko selbst sendet keine Audiodaten. Wenn du zustimmst, tippe danach erneut auf das Mikrofon.',
      ok: 'Erlauben',
    });
    if (accepted) {
      aiko.setUi({ ...aiko.ui, speechRecognition: true });
      toastState.show('Diktieren aktiviert. Tippe erneut auf das Mikrofon.');
    }
  }, [aiko.setUi, aiko.ui, dialog.confirm, toastState.show]);

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
          void copyText(plainCopy(withName(last.variants[last.vi] || ''))).then((copied) => {
            toastState.show(copied ? 'Letzte Antwort kopiert' : 'Kopieren fehlgeschlagen');
          });
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
      <Chat inert={sidebarOpen || settingsOpen || attachmentOpen || Boolean(dialog.options)}>
        <Header
          config={aiko.config}
          chat={aiko.current}
          hasUnreadChat={aiko.unreadChat}
          onOpenSidebar={() => { setSidebarOpen(true); aiko.clearUnread(); }}
          onSelectModel={aiko.selectModel}
          onToggleTemporary={aiko.toggleTemporary}
          onNewChat={aiko.newChat}
          onShare={async () => {
            const result = await shareText(transcript());
            if (result === 'shared') toastState.show('Chat geteilt');
            else if (result === 'copied') toastState.show('Text kopiert');
            else if (result === 'cancelled') toastState.show('Teilen abgebrochen');
            else toastState.show('Teilen und Kopieren fehlgeschlagen');
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
          attachments={pendingFiles}
          speechRecognition={aiko.ui.speechRecognition}
          onSend={(text, files) => {
            aiko.send(text, files.map(toFileAttachment));
            setPendingFiles([]);
          }}
          onRemoveAttachment={(index) => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
          onStop={aiko.stop}
          onAttachment={() => setAttachmentOpen(true)}
          onRequestSpeechConsent={requestSpeechConsent}
          onScrollBottom={() => messageList.current?.scrollBottom(true)}
          toast={toastState.show}
        />
      </Chat>

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

      <AttachmentSheet open={attachmentOpen} onClose={() => setAttachmentOpen(false)} onFiles={addFiles} />

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
        modalOpen={Boolean(dialog.options)}
      />

      <Dialog options={dialog.options} onResult={dialog.result} />
      <Toast toast={toastState.toast} onAction={toastState.runAction} />
    </>
  );
}
