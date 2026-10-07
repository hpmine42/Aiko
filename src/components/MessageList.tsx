import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { AikoConfig, Chat } from '../types';
import { withName } from '../engine/aikoEngine';
import { Message } from './Message';

export interface MessageListHandle {
  scrollBottom: (smooth?: boolean) => void;
}

interface MessageListProps {
  chat: Chat;
  config: AikoConfig;
  generatingIndex: number | null;
  thinking: boolean;
  onConfig: (config: AikoConfig) => void;
  onEdit: (index: number, text: string) => void;
  onRegenerate: (index: number) => void;
  onVariant: (index: number, variant: number) => void;
  onFeedback: (index: number, feedback: 'up' | 'down' | null) => void;
  onSuggestion: (text: string) => void;
  toast: (message: string) => void;
  onBottomVisibility: (visible: boolean) => void;
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(function MessageList({
  chat,
  config,
  generatingIndex,
  thinking,
  onConfig,
  onEdit,
  onRegenerate,
  onVariant,
  onFeedback,
  onSuggestion,
  toast,
  onBottomVisibility,
}, ref) {
  const scrollRef = useRef<HTMLElement>(null);
  const followRef = useRef(true);
  const [scrolled, setScrolled] = useState(false);
  const empty = chat.messages.length === 0;

  const scrollBottom = (smooth = false) => {
    const element = scrollRef.current;
    if (!element) return;
    followRef.current = true;
    if (smooth) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    else element.scrollTop = element.scrollHeight;
  };
  useImperativeHandle(ref, () => ({ scrollBottom }), []);

  useLayoutEffect(() => {
    if (followRef.current) scrollBottom(false);
  }, [chat.messages, generatingIndex]);

  return (
    <main
      id="scroll"
      ref={scrollRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        followRef.current = distance < 90;
        onBottomVisibility(distance > 220);
        setScrolled(element.scrollTop > 4);
      }}
      data-scrolled={scrolled ? 'true' : undefined}
    >
      <div id="thread" className={empty ? 'emptymode' : ''}>
        {empty ? (
          <div className="empty"><h1>{withName(chat.greet)}</h1></div>
        ) : chat.messages.map((message, index) => (
          <Message
            key={`${message.ts}-${index}`}
            message={message}
            index={index}
            config={config}
            modelId={chat.model}
            generating={generatingIndex === index}
            thinking={generatingIndex === index && thinking}
            onConfig={onConfig}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onVariant={onVariant}
            onFeedback={onFeedback}
            onSuggestion={onSuggestion}
            toast={toast}
          />
        ))}
      </div>
      <div className="disc" id="disc">{config.assistantName} kann Fehler machen. Überprüfe wichtige Informationen.</div>
    </main>
  );
});
