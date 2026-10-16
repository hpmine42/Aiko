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
import { sunTool } from './sun';
import { workdayTool } from './workdays';
import { timeTool } from './timecalc';
import { zodiacTool } from './zodiac';
import { vehicleTool } from './vehicle';
import { cookingTool } from './cooking';
import { sleepTool } from './sleep';
import { numberTheoryTool } from './numbertheory';
import { savingsTool } from './savings';
import { dataTool } from './data';
import { cipherTool } from './cipher';
import { passwordStrengthTool } from './pwstrength';
import { contrastTool } from './contrast';
import { countryTool } from './countries';
import { elementTool } from './elements';
import { gradeTool } from './grades';
import { gameTool } from './games';
import { calendarTool } from './calendar';
import { plateTool } from './plates';
import { reminderTool } from './reminders';
import { downloadTool } from './download';
import { sizesTool } from './sizes';
import { runningTool } from './running';
import { usageTool } from './usage';

export type { Tool, ToolContext, ToolResult } from './types';
export { parseFeast, feastDate } from './holidays';
export { formatStopwatch, stopwatchElapsed, POMODORO_KIND } from './productivity';
export { buildMonth, isoWeek } from './calendar';
export { REMINDER_KIND } from './reminders';
export { resetGames, activeGame } from './games';

/** Order matters: more specific keyword tools first, generic arithmetic (fractions) last. */
export const TOOLS: readonly Tool[] = [
  gameTool,
  reminderTool,
  productivityTool,
  calendarTool,
  workdayTool,
  holidayTool,
  sunTool,
  moonTool,
  zodiacTool,
  sleepTool,
  timeTool,
  statsTool,
  loanTool,
  savingsTool,
  tipTool,
  healthTool,
  vehicleTool,
  cookingTool,
  gradeTool,
  numbersTool,
  numberTheoryTool,
  checkDigitTool,
  encodingTool,
  cipherTool,
  passwordStrengthTool,
  contrastTool,
  countryTool,
  elementTool,
  plateTool,
  sizesTool,
  runningTool,
  downloadTool,
  usageTool,
  dataTool,
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
  /** Source-id → label map (e.g. legacy SOURCE_LABEL) for tools like the statistics dashboard. */
  labels?: Record<string, string>;
}

/** Runs the typed tools in order and returns the first result. */
export function runTools(text: string, options: RunOptions): ToolResult | null {
  const context: ToolContext = { config: options.config, save: options.save, timers: options.timers, now: options.now || (() => new Date()), labels: options.labels || {} };
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
