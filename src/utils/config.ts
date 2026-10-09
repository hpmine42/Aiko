import { DEFAULT_CONFIG } from '../data/defaultConfig';
import type { AikoConfig, Chat, ChatMessage, FileAttachment, MessageMeta, MessageWidget, Rule, UiPreferences } from '../types';

export const STORAGE_FORMAT_VERSION = 2;
export const LS = {
  cfg: 'nova.config.v2',
  chats: 'nova.chats.v2',
  theme: 'nova.theme.v2',
  ui: 'nova.ui.v2',
  timers: 'nova.timers.v2',
} as const;
export const LEGACY_LS = {
  cfg: 'nova.config.v1',
  chats: 'nova.chats.v1',
  theme: 'nova.theme.v1',
  ui: 'nova.ui.v1',
  timers: 'nova.timers.v1',
} as const;

export const BACKUP_FORMAT_VERSION = 3;
export const MAX_BACKUP_SIZE_BYTES = 20 * 1024 * 1024;

export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function variantsOf(value: string): string[] {
  return String(value || '').split('|||').map((item) => item.trim()).filter(Boolean);
}

export function normalizeConfig(input: unknown): AikoConfig {
  const defaults = clone(DEFAULT_CONFIG);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return defaults;

  const raw = input as Partial<AikoConfig> & Record<string, unknown>;
  const merged = Object.assign(defaults, raw) as AikoConfig;
  if (!Array.isArray(merged.pairs)) merged.pairs = clone(DEFAULT_CONFIG.pairs);
  if (!Array.isArray(merged.models)) merged.models = clone(DEFAULT_CONFIG.models);
  merged.models = merged.models.filter((model) => model && typeof model === 'object' && model.id);
  if (!merged.models.length) merged.models = clone(DEFAULT_CONFIG.models);
  if (!Array.isArray(merged.fallback)) {
    merged.fallback = typeof raw.fallback === 'string'
      ? variantsOf(raw.fallback)
      : clone(DEFAULT_CONFIG.fallback);
  }
  merged.fallback = merged.fallback.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()));
  if (!merged.fallback.length) merged.fallback = clone(DEFAULT_CONFIG.fallback);
  if (!Array.isArray(merged.suggestions)) merged.suggestions = clone(DEFAULT_CONFIG.suggestions);
  merged.assistantName = String(merged.assistantName || 'Aiko');
  if (merged.assistantName === 'Nova') merged.assistantName = 'Aiko';
  merged.userName = String(merged.userName == null ? '' : merged.userName).trim();
  if (merged.userName === 'Du') merged.userName = '';
  if (!Array.isArray(merged.greetings) || !merged.greetings.length) merged.greetings = clone(DEFAULT_CONFIG.greetings);
  merged.models = merged.models.map((model) => {
    const id = String(model.id || '');
    const builtin = DEFAULT_CONFIG.models.find((entry) => entry.id === id);
    return {
      id,
      label: builtin?.label || String(model.label || id).replace(/^nova\s+/i, ''),
      desc: builtin?.desc || String(model.desc || ''),
    };
  });
  if (!merged.models.some((model) => model.id === merged.defaultModel)) {
    merged.defaultModel = merged.models[0].id;
  }

  merged.pairs = merged.pairs
    .filter((pair): pair is Rule => Boolean(pair && typeof pair === 'object'))
    .map((pair, index) => ({
      id: String(pair.id || `p${Date.now()}${index}`),
      enabled: pair.enabled !== false,
      patterns: Array.isArray(pair.patterns)
        ? pair.patterns.map(String).filter((entry) => entry.trim())
        : typeof pair.patterns === 'string'
          ? String(pair.patterns).split('\n').filter((entry) => entry.trim())
          : [],
      response: String(pair.response || ''),
      exclude: Array.isArray(pair.exclude)
        ? pair.exclude.map(String).filter((entry) => entry.trim())
        : typeof pair.exclude === 'string'
          ? String(pair.exclude).split(/\n|,/).map((entry) => entry.trim()).filter(Boolean)
          : [],
      priority: Math.max(-9, Math.min(9, Number.parseInt(String(pair.priority ?? 0), 10) || 0)),
      followups: pair.followups && typeof pair.followups === 'object' && !Array.isArray(pair.followups)
        ? Object.fromEntries(Object.entries(pair.followups).filter(([, value]) => typeof value === 'string' && value.trim()))
        : {},
      suggest: Array.isArray(pair.suggest)
        ? pair.suggest.map(String).map((entry) => entry.trim()).filter(Boolean).slice(0, 4)
        : [],
    }));

  merged.memory = Array.isArray(merged.memory) ? merged.memory.map(String).filter((entry) => entry.trim()) : [];
  merged.countdowns = Array.isArray(merged.countdowns)
    ? merged.countdowns
      .map((countdown) => countdown && typeof countdown === 'object'
        ? { name: String(countdown.name || '').trim().slice(0, 40), ts: Number(countdown.ts) || 0 }
        : null)
      .filter((countdown): countdown is { name: string; ts: number } => Boolean(countdown?.name && countdown.ts > 0))
      .sort((a, b) => a.ts - b.ts)
    : [];
  merged.checklists = Array.isArray(merged.checklists)
    ? merged.checklists
      .map((list) => list && typeof list === 'object'
        ? {
            name: String(list.name || '').trim().slice(0, 30),
            items: Array.isArray(list.items)
              ? list.items
                .map((item) => item && typeof item === 'object'
                  ? { t: String(item.t || '').trim().slice(0, 60), done: Boolean(item.done) }
                  : { t: String(item == null ? '' : item).trim().slice(0, 60), done: false })
                .filter((item) => item.t)
              : [],
          }
        : null)
      .filter((list): list is NonNullable<typeof list> => Boolean(list?.name))
    : [];
  merged.knowledge = String(merged.knowledge == null ? DEFAULT_CONFIG.knowledge : merged.knowledge);
  merged.dictionary = String(merged.dictionary == null ? DEFAULT_CONFIG.dictionary : merged.dictionary);
  merged.followFallback = String(merged.followFallback == null ? DEFAULT_CONFIG.followFallback : merged.followFallback);
  // Reply texts shown when the user asks about attachments; empty falls back to the defaults.
  merged.attachmentImageReply = String(merged.attachmentImageReply ?? '').trim() || DEFAULT_CONFIG.attachmentImageReply;
  merged.attachmentFileReply = String(merged.attachmentFileReply ?? '').trim() || DEFAULT_CONFIG.attachmentFileReply;
  // Avatars are resized into local data URLs by the UI. Never load a remote
  // image URL supplied by an imported config or backup.
  merged.avatar = typeof merged.avatar === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(merged.avatar)
    ? merged.avatar : '';
  if (!merged.stats || typeof merged.stats !== 'object') merged.stats = { rules: {}, tools: {} };
  if (!merged.stats.rules || typeof merged.stats.rules !== 'object') merged.stats.rules = {};
  if (!merged.stats.tools || typeof merged.stats.tools !== 'object') merged.stats.tools = {};
  return merged;
}

function normalizeWidget(input: unknown): MessageWidget | null {
  if (!input || typeof input !== 'object') return null;
  const widget = input as Record<string, unknown>;
  if (widget.type === 'chart' && typeof widget.svg === 'string' && widget.svg.length < 100_000)
    return { type: 'chart', svg: widget.svg, label: String(widget.label || '') };
  if (widget.type === 'qr' && typeof widget.text === 'string' && widget.text.length <= 800)
    return { type: 'qr', text: widget.text, ecl: ['L', 'M', 'Q', 'H'].includes(String(widget.ecl)) ? widget.ecl as 'L' | 'M' | 'Q' | 'H' : 'M', caption: String(widget.caption || '') };
  if (widget.type === 'color' && typeof widget.hex === 'string' && /^[0-9a-f]{6}$/i.test(widget.hex))
    return { type: 'color', hex: widget.hex };
  if (widget.type === 'pw' && typeof widget.text === 'string')
    return { type: 'pw', text: widget.text, label: String(widget.label || ''), req: String(widget.req || '') };
  if (widget.type === 'list' && typeof widget.name === 'string')
    return { type: 'list', name: widget.name };
  return null;
}

function normalizeMeta(input: unknown): MessageMeta {
  const meta = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const widget = normalizeWidget(meta.widget);
  return {
    rule: typeof meta.rule === 'string' ? meta.rule : null,
    cap: typeof meta.cap === 'string' ? meta.cap : '',
    source: typeof meta.source === 'string' ? meta.source : '',
    val: typeof meta.val === 'number' && Number.isFinite(meta.val) ? meta.val : null,
    widget,
  };
}

export function normalizeChat(input: unknown, config: AikoConfig): Chat | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<Chat>;
  const messages = (Array.isArray(raw.messages) ? raw.messages : [])
    .filter((message): message is ChatMessage => Boolean(message && (message.role === 'user' || message.role === 'assistant')))
    .map((message): ChatMessage => {
      if (message.role === 'user') {
        const rawAttachments = (message as unknown as { attachments?: unknown }).attachments;
        const attachments = Array.isArray(rawAttachments)
          ? rawAttachments.slice(0, 10).flatMap((entry): FileAttachment[] => {
            if (!entry || typeof entry !== 'object') return [];
            const attachment = entry as Record<string, unknown>;
            const name = String(attachment.name || '').trim().slice(0, 255);
            const size = Number(attachment.size);
            if (!name || !Number.isFinite(size) || size < 0) return [];
            return [{
              name,
              size,
              type: String(attachment.type || '').slice(0, 128),
              lastModified: Math.max(0, Number(attachment.lastModified) || 0),
            }];
          })
          : [];
        return {
          role: 'user',
          content: String(message.content || ''),
          ts: message.ts || Date.now(),
          ...(attachments.length ? { attachments } : {}),
        };
      }
      const legacy = message as typeof message & { content?: string };
      const variants = Array.isArray(message.variants) ? message.variants.map(String) : [String(legacy.content || '')];
      const vi = Number.isInteger(message.vi) && message.vi >= 0 && message.vi < variants.length
        ? message.vi : Math.max(0, variants.length - 1);
      return {
        role: 'assistant',
        variants,
        vi,
        ts: message.ts || Date.now(),
        meta: Array.isArray(message.meta) ? message.meta.map(normalizeMeta) : [],
        thoughts: Array.isArray(message.thoughts) ? message.thoughts.filter((value) => typeof value === 'number' && Number.isFinite(value)) : [],
        fb: message.fb === 'up' || message.fb === 'down' ? message.fb : null,
      };
    });
  const model = config.models.some((entry) => entry.id === raw.model) ? String(raw.model) : config.defaultModel;
  return {
    id: String(raw.id || `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`),
    title: String(raw.title || 'Neuer Chat'),
    messages,
    model,
    ts: Number(raw.ts) || Date.now(),
    greet: String(raw.greet || ''),
    temp: Boolean(raw.temp),
    pinned: Boolean(raw.pinned),
  };
}

export const defaultUi = (theme: unknown = 'dark'): UiPreferences => ({
  stream: true,
  think: true,
  suggest: true,
  saveHistory: true,
  speechRecognition: false,
  theme: theme === 'system' || theme === 'light' || theme === 'dark' ? theme : 'dark',
  calm: false,
});

export function normalizeUi(input: unknown, legacyTheme?: unknown): UiPreferences {
  const defaults = defaultUi(legacyTheme);
  if (!input || typeof input !== 'object') return defaults;
  const raw = input as Partial<UiPreferences>;
  const value = { ...defaults, ...raw };
  if (!['system', 'light', 'dark'].includes(value.theme)) value.theme = 'dark';
  value.stream = typeof raw.stream === 'boolean' ? raw.stream : defaults.stream;
  value.think = typeof raw.think === 'boolean' ? raw.think : defaults.think;
  value.suggest = typeof raw.suggest === 'boolean' ? raw.suggest : defaults.suggest;
  value.saveHistory = typeof raw.saveHistory === 'boolean' ? raw.saveHistory : defaults.saveHistory;
  value.speechRecognition = raw.speechRecognition === true;
  value.calm = typeof raw.calm === 'boolean' ? raw.calm : defaults.calm;
  return value;
}

export interface NormalizedBackup {
  version: number;
  config: AikoConfig;
  ui: UiPreferences | null;
  chats: Chat[] | null;
}

/** Normalize supported backup versions and reject unknown future formats. */
export function normalizeBackup(input: unknown): NormalizedBackup {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültiges Backup-Format');
  const raw = input as Record<string, unknown>;
  if (raw.app != null && !['aiko', 'nova'].includes(String(raw.app).toLowerCase())) {
    throw new Error('Diese Datei stammt nicht aus Aiko');
  }
  if (!raw.config || typeof raw.config !== 'object' || Array.isArray(raw.config)) {
    throw new Error('Im Backup fehlt eine gültige Konfiguration');
  }
  const version = raw.version == null ? 1 : Number(raw.version);
  if (!Number.isInteger(version) || version < 1) throw new Error('Ungültige Backup-Version');
  if (version > BACKUP_FORMAT_VERSION) {
    throw new Error(`Dieses Backup stammt aus einer neueren Aiko-Version (Format ${version}). Aktualisiere Aiko zum Wiederherstellen.`);
  }

  // Versions 1 and 2 are upgraded through the same tolerant field normalizers;
  // version 3 adds explicit attachment metadata and stricter UI preferences.
  const config = normalizeConfig(raw.config);
  if (raw.ui != null && (typeof raw.ui !== 'object' || Array.isArray(raw.ui))) {
    throw new Error('Die Einstellungen im Backup sind ungültig');
  }
  const ui = raw.ui == null
    ? null
    : { ...normalizeUi(raw.ui), speechRecognition: false };
  let chats: Chat[] | null = null;
  if (raw.chats != null) {
    if (!Array.isArray(raw.chats)) throw new Error('Die Chatliste im Backup ist ungültig');
    chats = raw.chats
      .map((chat) => normalizeChat(chat, config))
      .filter((chat): chat is Chat => Boolean(chat?.messages.length) && !chat?.temp);
  }
  return { version, config, ui, chats };
}
