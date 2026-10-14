import type { AikoConfig, TimerAdapter } from '../../types';
import type { Tool, ToolContext, ToolResult } from './types';
import { statsTool } from './stats';
import { fractionTool } from './fractions';
import { loanTool } from './loan';
import { tipTool } from './tip';
import { healthTool } from './health';
import { holidayTool } from './holidays';
import { numbersTool } from './numbers';
import { moonTool } from './moon';
import { encodingTool } from './encoding';
import { checkDigitTool } from './checkdigits';
import { generatorTool } from './generators';
import { regexTool } from './regexTester';
import { diffTool } from './diff';
import { productivityTool } from './productivity';

export type { Tool, ToolContext, ToolResult } from './types';
export { parseFeast, feastDate } from './holidays';
export { formatStopwatch, stopwatchElapsed, POMODORO_KIND } from './productivity';

/** Order matters: more specific keyword tools first, generic arithmetic (fractions) last. */
export const TOOLS: readonly Tool[] = [
  productivityTool,
  holidayTool,
  moonTool,
  statsTool,
  loanTool,
  tipTool,
  healthTool,
  numbersTool,
  checkDigitTool,
  encodingTool,
  generatorTool,
  regexTool,
  diffTool,
  fractionTool,
];

export const TOOL_SOURCE_LABELS: Record<string, string> = {
  ...Object.fromEntries(TOOLS.map((tool) => [tool.id, tool.label])),
  pomodoro: 'Pomodoro',
};

export const TOOL_HELP_LINES: readonly string[] = TOOLS.map((tool) => tool.help).filter((line): line is string => Boolean(line));

export interface RunOptions {
  config: AikoConfig;
  save: () => void;
  timers: TimerAdapter;
  now?: () => Date;
}

/** Runs the typed tools in order and returns the first result. */
export function runTools(text: string, options: RunOptions): ToolResult | null {
  const context: ToolContext = { config: options.config, save: options.save, timers: options.timers, now: options.now || (() => new Date()) };
  for (const tool of TOOLS) {
    let result: ToolResult | null = null;
    try {
      result = tool.run(text, context);
    } catch {
      result = null;
    }
    if (result) return result;
  }
  return null;
}
