export type ThemePreference = 'system' | 'light' | 'dark';
export type MessageRole = 'user' | 'assistant';
export type FollowUpKind = 'kuerzer' | 'einfacher' | 'warum' | 'beispiel' | 'mehr' | 'nochmal';
export type ToolSource =
  | 'rule' | 'follow' | 'math' | 'unit' | 'date' | 'finance' | 'calc' | 'geo'
  | 'tool' | 'timer' | 'random' | 'base' | 'color' | 'vat' | 'price' | 'dict'
  | 'mem' | 'know' | 'meta' | 'pw' | 'qr' | 'chart' | 'list' | 'fallback' | string;

export interface ModelConfig {
  id: string;
  label: string;
  desc: string;
}

export interface SuggestionConfig {
  t: string;
  s: string;
  q: string;
}

export interface Rule {
  id: string;
  enabled: boolean;
  patterns: string[];
  response: string;
  exclude?: string[];
  priority?: number;
  followups?: Partial<Record<FollowUpKind, string>>;
  suggest?: string[];
}

export interface Countdown {
  name: string;
  ts: number;
}

export interface ChecklistItem {
  t: string;
  done: boolean;
}

export interface Checklist {
  name: string;
  items: ChecklistItem[];
}

export interface UsageStats {
  rules: Record<string, number>;
  tools: Record<string, number>;
}

export interface AikoConfig {
  assistantName: string;
  userName: string;
  greetings: string[];
  models: ModelConfig[];
  defaultModel: string;
  suggestions: SuggestionConfig[];
  followFallback: string;
  knowledge: string;
  dictionary: string;
  memory: string[];
  countdowns: Countdown[];
  checklists: Checklist[];
  avatar: string;
  stats: UsageStats;
  fallback: string[];
  pairs: Rule[];
}

export interface ColorWidget {
  type: 'color';
  hex: string;
}

export interface QrWidget {
  type: 'qr';
  text: string;
  ecl?: 'L' | 'M' | 'Q' | 'H';
  caption?: string;
}

export interface PasswordWidget {
  type: 'pw';
  text: string;
  label: string;
  req?: string;
}

export interface ChartWidget {
  type: 'chart';
  svg: string;
  label: string;
}

export interface ListWidget {
  type: 'list';
  name: string;
}

export type MessageWidget = ColorWidget | QrWidget | PasswordWidget | ChartWidget | ListWidget;

export interface MessageMeta {
  rule: string | null;
  cap: string;
  source: ToolSource;
  val: number | null;
  widget?: MessageWidget | null;
}

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface UserMessage {
  role: 'user';
  content: string;
  ts: number;
  attachments?: FileAttachment[];
}

export interface AssistantMessage {
  role: 'assistant';
  variants: string[];
  vi: number;
  ts: number;
  meta: MessageMeta[];
  thoughts?: number[];
  fb?: 'up' | 'down' | null;
}

export type ChatMessage = UserMessage | AssistantMessage;

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  ts: number;
  greet: string;
  temp: boolean;
  pinned?: boolean;
}

export interface UiPreferences {
  stream: boolean;
  think: boolean;
  suggest: boolean;
  saveHistory: boolean;
  speechRecognition: boolean;
  theme: ThemePreference;
  calm: boolean;
}

export interface TimerState {
  id: string;
  end: number;
  dur: number;
  label: string;
  chat?: string;
  paused: boolean;
  left?: number;
}

export interface EngineResult {
  text: string;
  rule: Rule | null;
  pattern: string;
  cap?: string;
  index: number;
  total: number;
  source: ToolSource;
  val?: number | null;
  widget?: MessageWidget | null;
  follow?: FollowUpKind;
}

export interface RuleCodeResult {
  rules: Omit<Rule, 'id'>[];
  errors: string[];
}

export interface RuleTestResult {
  p: Rule;
  q: string;
  ok: 'good' | 'warn' | 'bad' | 'off' | 'skip';
  msg: string;
}

export interface RuleHit {
  rule: Rule;
  pattern: string;
  cap: string;
  score: number;
  hard: boolean;
  prio: number;
}

export interface QrMatrix {
  size: number;
  modules: boolean[][];
  version: number;
  ecl: 'L' | 'M' | 'Q' | 'H';
}

export interface QrApi {
  encode(text: string, errorCorrection?: 'L' | 'M' | 'Q' | 'H'): QrMatrix;
  toSvg(qr: QrMatrix, pixels?: string | number): string;
}

export interface TimerAdapter {
  getTimers(): TimerState[];
  start(seconds: number): void;
  stopAll(): number;
}
