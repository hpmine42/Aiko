import type { AikoConfig, MessageWidget, TimerAdapter } from '../../types';

/** Result of a local tool – mirrors the shape the legacy engine expects. */
export interface ToolResult {
  text: string;
  source: string;
  /** Numeric value for follow-ups such as „und mal 2“. */
  val?: number | null;
  widget?: MessageWidget | null;
  /** Side effect that is executed only when the result is actually used as reply. */
  effect?: () => void;
}

export interface ToolContext {
  config: AikoConfig;
  /** Persists `config` after the tool mutated it inside an `effect`. */
  save: () => void;
  timers: TimerAdapter;
  /** Injectable clock so date-based tools stay testable. */
  now: () => Date;
  /** Source-id → human label (legacy + typed tools), e.g. for the statistics dashboard. */
  labels: Record<string, string>;
}

export interface Tool {
  /** Source id, also used for usage statistics (`config.stats.tools`). */
  id: string;
  /** Human readable label for statistics in the settings. */
  label: string;
  /** Markdown line for `/hilfe`. */
  help?: string;
  run: (text: string, context: ToolContext) => ToolResult | null;
}
