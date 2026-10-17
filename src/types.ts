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

/** Local stopwatch: `elapsed` accumulates paused time, `start` is the last (re)start. */
export interface StopwatchState {
  start: number;
  elapsed: number;
  running: boolean;
  laps: number[];
}

export interface AikoConfig {
  assistantName: string;
  userName: string;
  greetings: string[];
  models: ModelConfig[];
  defaultModel: string;
  suggestions: SuggestionConfig[];
  followFallback: string;
  attachmentImageReply: string;
  attachmentFileReply: string;
  knowledge: string;
  dictionary: string;
  memory: string[];
  countdowns: Countdown[];
  checklists: Checklist[];
  avatar: string;
  stats: UsageStats;
  fallback: string[];
  pairs: Rule[];
  stopwatch?: StopwatchState | null;
  /** Bundesland code (e.g. „NW“) for holidays, workdays and the calendar. */
  region?: string;
  /** Home city for sunrise/sunset and local time questions. */
  homeCity?: string;
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

export interface StopwatchWidget {
  type: 'stopwatch';
}

export interface TttWidget {
  type: 'ttt';
  /** 9 Zeichen: 'X' (Mensch), 'O' (Aiko), ' ' (leer) – Index 0 oben links. */
  board: string;
  /** Spiel vorbei → Brettklicks deaktiviert. */
  over?: boolean;
}

export interface C4Widget {
  type: 'c4';
  /** 42 Zeichen (6 Reihen × 7 Spalten), Zeile 0 oben: 'X', 'O' oder ' '. */
  board: string;
  /** Spiel vorbei → Spaltenklicks deaktiviert. */
  over?: boolean;
}

export interface CalendarWidget {
  type: 'calendar';
  year: number;
  month: number;
  /** Bundesland code for holiday markers, null = nationwide only. */
  state: string | null;
}

export type MessageWidget = ColorWidget | QrWidget | PasswordWidget | ChartWidget | ListWidget | StopwatchWidget | CalendarWidget | TttWidget | C4Widget;

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
  fontSize: FontSizePreference;
}

export type FontSizePreference = 'small' | 'medium' | 'large';

export interface TimerStep {
  dur: number;
  label: string;
}

export interface TimerState {
  id: string;
  end: number;
  dur: number;
  label: string;
  chat?: string;
  paused: boolean;
  left?: number;
  /** Optional grouping, e.g. „pomodoro“, so one command can stop a whole cycle. */
  kind?: string;
  /** Steps that start automatically, one after another, when this timer fires. */
  chain?: TimerStep[];
}

export interface TimerStartOptions {
  label?: string;
  kind?: string;
  chain?: TimerStep[];
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
  start(seconds: number, options?: TimerStartOptions): void;
  /** Stops a single timer by id (optional for minimal adapters). */
  stop?(id: string): void;
  /** Stops all timers, or only those of the given `kind`. Returns the number stopped. */
  stopAll(kind?: string): number;
}
