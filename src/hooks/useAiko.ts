import { useCallback, useEffect, useRef, useState } from 'react';
import type { AikoConfig, AssistantMessage, Chat, ChatMessage, EngineResult, TimerState, UiPreferences } from '../types';
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { configureEngine, pickResponse, withName } from '../engine/aikoEngine';
import { LS, clone, normalizeChat, normalizeConfig, normalizeUi } from '../utils/config';
import { readLocalJson, removeLocalValue, writeLocalJson } from './useLocalStorage';
import { useTimers } from './useTimers';

const randomOf = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function pickGreeting(config: AikoConfig): string {
  const greetings = config.greetings.filter((greeting) => String(greeting).trim());
  return randomOf(greetings.length ? greetings : DEFAULT_CONFIG.greetings);
}

function createChat(config: AikoConfig): Chat {
  return {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    messages: [],
    model: config.defaultModel,
    ts: Date.now(),
    greet: pickGreeting(config),
    temp: false,
  };
}

function loadInitial() {
  const config = normalizeConfig(readLocalJson<unknown>(LS.cfg, null));
  const legacyTheme = readLocalJson<unknown>(LS.theme, 'dark');
  const ui = normalizeUi(readLocalJson<unknown>(LS.ui, {}), legacyTheme);
  const rawChats = readLocalJson<unknown>(LS.chats, []);
  const chats = Array.isArray(rawChats)
    ? rawChats.map((chat) => normalizeChat(chat, config)).filter((chat): chat is Chat => Boolean(chat?.messages.length))
    : [];
  return { config, ui, chats };
}

interface UseAikoOptions {
  toast: (message: string, action?: string, onAction?: () => void) => void;
}

interface Generation {
  chatId: string;
  index: number;
  stopped: boolean;
  timeout: number | null;
  full: string;
  raw: string;
  buffer: string;
  targetHadVariants: number;
}

export function useAiko({ toast }: UseAikoOptions) {
  const initial = useRef(loadInitial()).current;
  const [config, setConfigState] = useState(initial.config);
  const [ui, setUiState] = useState(initial.ui);
  const [chats, setChatsState] = useState<Chat[]>(initial.chats);
  const [current, setCurrentState] = useState<Chat>(() => createChat(initial.config));
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);

  const configRef = useRef(config);
  const uiRef = useRef(ui);
  const chatsRef = useRef(chats);
  const currentRef = useRef(current);
  const generationRef = useRef<Generation | null>(null);
  configRef.current = config;
  uiRef.current = ui;
  chatsRef.current = chats;
  currentRef.current = current;

  const setConfig = useCallback((next: AikoConfig | ((value: AikoConfig) => AikoConfig)) => {
    setConfigState((value) => {
      const resolved = typeof next === 'function' ? next(value) : next;
      configRef.current = resolved;
      return resolved;
    });
  }, []);
  const setUi = useCallback((next: UiPreferences | ((value: UiPreferences) => UiPreferences)) => {
    setUiState((value) => {
      const resolved = typeof next === 'function' ? next(value) : next;
      uiRef.current = resolved;
      return resolved;
    });
  }, []);
  const setChats = useCallback((next: Chat[] | ((value: Chat[]) => Chat[])) => {
    setChatsState((value) => {
      const resolved = typeof next === 'function' ? next(value) : next;
      chatsRef.current = resolved;
      return resolved;
    });
  }, []);

  const storeCurrent = useCallback((chat: Chat, markUnread = false) => {
    currentRef.current = chat;
    setCurrentState(chat);
    if (!chat.temp && chat.messages.length) {
      setChats((list) => {
        const index = list.findIndex((entry) => entry.id === chat.id);
        if (index < 0) return [chat, ...list];
        return list.map((entry) => entry.id === chat.id ? chat : entry);
      });
      if (markUnread) setUnreadChat(true);
    }
  }, [setChats]);

  const appendTimerMessage = useCallback((timer: TimerState) => {
    const message: AssistantMessage = {
      role: 'assistant',
      variants: [`⏰ **Die Zeit ist abgelaufen!**\n\nDein Timer (${timer.label}) ist vorbei.`],
      vi: 0,
      meta: [{ rule: null, cap: '', source: 'timer', val: null }],
      ts: Date.now(),
      thoughts: [0],
    };
    const target = chatsRef.current.find((chat) => chat.id === timer.chat);
    if (target && target.id !== currentRef.current.id) {
      setChats((list) => list.map((chat) => chat.id === target.id
        ? { ...chat, messages: [...chat.messages, message], ts: Date.now() }
        : chat));
    } else {
      const chat = currentRef.current;
      storeCurrent({ ...chat, messages: [...chat.messages, message], ts: Date.now() });
    }
    toast(`⏰ Timer abgelaufen: ${timer.label}`);
  }, [setChats, storeCurrent, toast]);

  const timers = useTimers({
    currentChatId: () => currentRef.current?.id,
    onFire: appendTimerMessage,
  });

  useEffect(() => {
    configureEngine(config, setConfig, timers.adapter);
  }, [config, setConfig, timers.adapter]);

  useEffect(() => { writeLocalJson(LS.cfg, config); }, [config]);
  useEffect(() => {
    writeLocalJson(LS.ui, ui);
    writeLocalJson(LS.theme, ui.theme);
  }, [ui]);
  useEffect(() => {
    if (!ui.saveHistory) { removeLocalValue(LS.chats); return; }
    writeLocalJson(LS.chats, chats.filter((chat) => !chat.temp).map((chat) => ({
      id: chat.id,
      title: chat.title,
      model: chat.model,
      ts: chat.ts,
      pinned: Boolean(chat.pinned),
      messages: chat.messages,
    })));
  }, [chats, ui.saveHistory]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = ui.theme === 'system' ? (media?.matches ? 'dark' : 'light') : ui.theme;
      document.documentElement.setAttribute('data-theme', theme);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#fdfdfd');
    };
    apply();
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, [ui.theme]);

  useEffect(() => {
    document.title = config.assistantName;
    document.body.classList.toggle('emptychat', current.messages.length === 0);
    document.body.classList.toggle('calm', Boolean(ui.calm));
    document.body.classList.toggle('busy', generatingIndex != null);
  }, [config.assistantName, current.messages.length, generatingIndex, ui.calm]);

  const updateChat = useCallback((chatId: string, updater: (chat: Chat) => Chat) => {
    if (currentRef.current.id === chatId) {
      storeCurrent(updater(currentRef.current));
      return;
    }
    setChats((list) => list.map((chat) => chat.id === chatId ? updater(chat) : chat));
  }, [setChats, storeCurrent]);

  const finishGeneration = useCallback((generation: Generation, completed: boolean) => {
    if (generationRef.current !== generation) return;
    if (generation.timeout != null) window.clearTimeout(generation.timeout);
    updateChat(generation.chatId, (chat) => {
      const messages = [...chat.messages];
      const message = messages[generation.index];
      if (!message || message.role !== 'assistant') return chat;
      if (!generation.buffer) {
        if (generation.targetHadVariants > 0) {
          message.variants = message.variants.slice(0, generation.targetHadVariants);
          message.meta = message.meta.slice(0, generation.targetHadVariants);
          message.vi = Math.max(0, message.variants.length - 1);
        } else {
          messages.splice(generation.index, 1);
        }
      } else {
        message.variants[message.vi] = completed && generation.buffer === generation.full
          ? generation.raw
          : generation.buffer;
      }
      return { ...chat, messages, ts: Date.now() };
    });
    generationRef.current = null;
    setGeneratingIndex(null);
    setThinking(false);
  }, [updateChat]);

  const stop = useCallback(() => {
    const generation = generationRef.current;
    if (!generation) return;
    generation.stopped = true;
    finishGeneration(generation, false);
  }, [finishGeneration]);

  const startResponse = useCallback((baseChat: Chat, prompt: string, targetIndex: number | null = null) => {
    configureEngine(configRef.current, setConfig, timers.adapter);
    const avoid = (() => {
      if (targetIndex != null) {
        const target = baseChat.messages[targetIndex];
        return target?.role === 'assistant' ? target.variants[target.vi] || '' : null;
      }
      for (let index = baseChat.messages.length - 1; index >= 0; index -= 1) {
        const message = baseChat.messages[index];
        if (message.role === 'assistant') return message.variants[message.vi] || '';
      }
      return null;
    })();

    let chat = { ...baseChat, messages: [...baseChat.messages] };
    let assistant: AssistantMessage;
    let index: number;
    let previousVariants = 0;
    if (targetIndex == null) {
      assistant = { role: 'assistant', variants: [''], vi: 0, ts: Date.now(), meta: [], thoughts: [] };
      chat.messages.push(assistant);
      index = chat.messages.length - 1;
    } else {
      index = targetIndex;
      const existing = chat.messages[index];
      if (!existing || existing.role !== 'assistant') return;
      assistant = { ...existing, variants: [...existing.variants, ''], meta: [...existing.meta], thoughts: [...(existing.thoughts || [])], fb: null };
      previousVariants = existing.variants.length;
      assistant.vi = assistant.variants.length - 1;
      chat.messages[index] = assistant;
    }
    const history = chat.messages.slice(0, index);
    const result = pickResponse(prompt, avoid, { history }) as EngineResult;
    assistant.meta[assistant.vi] = {
      rule: result.rule?.id || null,
      cap: result.cap || '',
      source: result.source || '',
      val: typeof result.val === 'number' && Number.isFinite(result.val) ? result.val : null,
      widget: result.widget || null,
    };
    chat.messages[index] = assistant;
    storeCurrent(chat);

    const model = chat.model || configRef.current.defaultModel;
    const modelThinks = /think/i.test(model);
    const mini = /mini/i.test(model);
    const shouldThink = modelThinks && uiRef.current.think;
    const raw = result.text;
    const full = withName(raw);
    const wait = !uiRef.current.think
      ? 150
      : modelThinks
        ? 1_800 + Math.random() * 2_400
        : (mini ? 250 : 450) + Math.random() * 600 + Math.min(700, prompt.length * 6);
    const started = Date.now();
    const generation: Generation = {
      chatId: chat.id,
      index,
      stopped: false,
      timeout: null,
      full,
      raw,
      buffer: '',
      targetHadVariants: previousVariants,
    };
    generationRef.current = generation;
    setGeneratingIndex(index);
    setThinking(shouldThink);

    const begin = () => {
      if (generation.stopped || generationRef.current !== generation) return;
      setThinking(false);
      if (shouldThink) {
        updateChat(chat.id, (value) => {
          const messages = [...value.messages];
          const message = messages[index];
          if (message?.role === 'assistant') {
            const thoughts = [...(message.thoughts || [])];
            thoughts[message.vi] = Math.max(1, Math.round((Date.now() - started) / 1_000));
            messages[index] = { ...message, thoughts };
          }
          return { ...value, messages };
        });
      }
      if (!uiRef.current.stream) {
        generation.buffer = full;
        updateAssistantText(chat.id, index, full);
        finishGeneration(generation, true);
        return;
      }
      const tokens = full.match(/\s+|\S+/g) || [];
      let tokenIndex = 0;
      const stream = () => {
        if (generation.stopped || generationRef.current !== generation) return;
        let count = 1 + Math.floor(Math.random() * (full.length > 1_200 ? 5 : 3));
        while (count > 0 && tokenIndex < tokens.length) {
          generation.buffer += tokens[tokenIndex++];
          if (tokenIndex < tokens.length && /^\s+$/.test(tokens[tokenIndex])) generation.buffer += tokens[tokenIndex++];
          count -= 1;
        }
        updateAssistantText(chat.id, index, generation.buffer);
        if (tokenIndex >= tokens.length) {
          generation.timeout = window.setTimeout(() => finishGeneration(generation, true), 120);
          return;
        }
        const last = generation.buffer.replace(/\s+$/, '').slice(-1);
        let delay = (mini ? 12 : 24) + Math.random() * (mini ? 16 : 30);
        if (/[.!?:]/.test(last)) delay += 50 + Math.random() * 120;
        else if (last === ',') delay += 25;
        generation.timeout = window.setTimeout(stream, delay);
      };
      stream();
    };

    const updateAssistantText = (chatId: string, messageIndex: number, text: string) => {
      updateChat(chatId, (value) => {
        const messages = [...value.messages];
        const message = messages[messageIndex];
        if (message?.role !== 'assistant') return value;
        const variants = [...message.variants];
        variants[message.vi] = text;
        messages[messageIndex] = { ...message, variants };
        return { ...value, messages };
      });
    };

    generation.timeout = window.setTimeout(begin, wait);
  }, [finishGeneration, setConfig, storeCurrent, timers.adapter, updateChat]);

  const send = useCallback((text: string) => {
    if (generationRef.current) return;
    const prompt = String(text || '').trim();
    if (!prompt) return;
    let chat = currentRef.current;
    let title = chat.title;
    if (!chat.messages.length) {
      let candidate = prompt.replace(/\s+/g, ' ').replace(/[?!.]+$/, '');
      candidate = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      title = candidate.length > 38 ? `${candidate.slice(0, 38).trim()}…` : candidate;
    }
    const user: ChatMessage = { role: 'user', content: prompt, ts: Date.now() };
    chat = { ...chat, title, messages: [...chat.messages, user], ts: Date.now() };
    const firstSaved = !chat.temp && !chatsRef.current.some((entry) => entry.id === chat.id);
    storeCurrent(chat, firstSaved);
    startResponse(chat, prompt);
  }, [startResponse, storeCurrent]);

  const newChat = useCallback(() => {
    stop();
    storeCurrent(createChat(configRef.current));
  }, [stop, storeCurrent]);

  const selectChat = useCallback((chat: Chat) => {
    stop();
    currentRef.current = chat;
    setCurrentState(chat);
  }, [stop]);

  const regenerate = useCallback((index: number) => {
    if (generationRef.current) return;
    const chat = currentRef.current;
    let userIndex = index - 1;
    while (userIndex >= 0 && chat.messages[userIndex].role !== 'user') userIndex -= 1;
    if (userIndex < 0) return;
    const user = chat.messages[userIndex];
    if (user.role !== 'user') return;
    const truncated = chat.messages.length > index + 1 ? { ...chat, messages: chat.messages.slice(0, index + 1) } : chat;
    storeCurrent(truncated);
    startResponse(truncated, user.content, index);
  }, [startResponse, storeCurrent]);

  const editUser = useCallback((index: number, text: string) => {
    if (generationRef.current) return;
    const chat = { ...currentRef.current, messages: currentRef.current.messages.slice(0, index) };
    storeCurrent(chat);
    currentRef.current = chat;
    send(text);
  }, [send, storeCurrent]);

  const setVariant = useCallback((index: number, variant: number) => {
    const chat = currentRef.current;
    const messages = [...chat.messages];
    const message = messages[index];
    if (!message || message.role !== 'assistant') return;
    messages[index] = { ...message, vi: Math.max(0, Math.min(message.variants.length - 1, variant)) };
    storeCurrent({ ...chat, messages });
  }, [storeCurrent]);

  const setFeedback = useCallback((index: number, feedback: 'up' | 'down' | null) => {
    const chat = currentRef.current;
    const messages = [...chat.messages];
    const message = messages[index];
    if (!message || message.role !== 'assistant') return;
    messages[index] = { ...message, fb: feedback };
    storeCurrent({ ...chat, messages });
  }, [storeCurrent]);

  const renameChat = useCallback((chat: Chat, title: string) => {
    const next = { ...chat, title };
    if (currentRef.current.id === chat.id) {
      currentRef.current = next;
      setCurrentState(next);
    }
    setChats((list) => list.map((entry) => entry.id === chat.id ? next : entry));
  }, [setChats]);

  const pinChat = useCallback((chat: Chat) => {
    const next = { ...chat, pinned: !chat.pinned };
    if (currentRef.current.id === chat.id) {
      currentRef.current = next;
      setCurrentState(next);
    }
    setChats((list) => list.map((entry) => entry.id === chat.id ? next : entry));
    toast(next.pinned ? 'Angeheftet' : 'Gelöst');
  }, [setChats, toast]);

  const deleteChat = useCallback((chat: Chat) => {
    stop();
    const index = chatsRef.current.findIndex((entry) => entry.id === chat.id);
    if (index < 0 && chat.temp) { newChat(); toast('Temporärer Chat gelöscht'); return; }
    setChats((list) => list.filter((entry) => entry.id !== chat.id));
    if (currentRef.current.id === chat.id) {
      const fresh = createChat(configRef.current);
      currentRef.current = fresh;
      setCurrentState(fresh);
    }
    toast('Chat gelöscht', 'Rückgängig', () => {
      setChats((list) => {
        const next = [...list];
        next.splice(Math.max(0, index), 0, chat);
        return next;
      });
    });
  }, [newChat, setChats, stop, toast]);

  const clearChats = useCallback(() => {
    stop();
    setChats([]);
    const fresh = createChat(configRef.current);
    currentRef.current = fresh;
    setCurrentState(fresh);
  }, [setChats, stop]);

  const replaceChats = useCallback((next: Chat[]) => {
    stop();
    setChats(next);
    const fresh = createChat(configRef.current);
    currentRef.current = fresh;
    setCurrentState(fresh);
  }, [setChats, stop]);

  const selectModel = useCallback((model: string) => {
    const chat = { ...currentRef.current, model };
    storeCurrent(chat);
    if (!chat.messages.length) setConfig((value) => ({ ...value, defaultModel: model }));
  }, [setConfig, storeCurrent]);

  const toggleTemporary = useCallback(() => {
    const chat = currentRef.current;
    if (chat.messages.length) return;
    storeCurrent({ ...chat, temp: !chat.temp });
  }, [storeCurrent]);

  return {
    config,
    setConfig,
    ui,
    setUi,
    chats,
    setChats: replaceChats,
    current,
    generatingIndex,
    busy: generatingIndex != null,
    thinking,
    unreadChat,
    clearUnread: () => setUnreadChat(false),
    timers,
    send,
    stop,
    newChat,
    selectChat,
    regenerate,
    editUser,
    setVariant,
    setFeedback,
    renameChat,
    pinChat,
    deleteChat,
    clearChats,
    selectModel,
    toggleTemporary,
  };
}
