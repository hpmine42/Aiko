import type { Tool, ToolResult } from './types';
import { clean, fmtN, parseNumberList } from './shared';

type Kind = 'mean' | 'median' | 'sum' | 'sd' | 'variance' | 'min' | 'max' | 'range' | 'all';

const KINDS: Array<[RegExp, Kind]> = [
  [/^(?:arithmetisches\s+)?(?:mittelwert|mittel|durchschnitt|durchschnittswert|mean|average|schnitt)$/i, 'mean'],
  [/^(?:median|zentralwert)$/i, 'median'],
  [/^(?:summe|gesamtsumme|addiere|total)$/i, 'sum'],
  [/^(?:standardabweichung|stdabw|std|stabw|streuung)$/i, 'sd'],
  [/^(?:varianz)$/i, 'variance'],
  [/^(?:min|minimum|kleinste\s+zahl|kleinster\s+wert)$/i, 'min'],
  [/^(?:max|maximum|größte\s+zahl|groesste\s+zahl|größter\s+wert)$/i, 'max'],
  [/^(?:spannweite|range)$/i, 'range'],
  [/^(?:statistik|statistiken|kennzahlen|analysiere\s+(?:die\s+)?zahlen)$/i, 'all'],
];

const LABEL: Record<Kind, string> = {
  mean: 'Mittelwert', median: 'Median', sum: 'Summe', sd: 'Standardabweichung', variance: 'Varianz',
  min: 'Minimum', max: 'Maximum', range: 'Spannweite', all: 'Statistik',
};

export interface Stats {
  n: number; sum: number; mean: number; median: number; min: number; max: number;
  range: number; variance: number; sampleVariance: number; sd: number; sampleSd: number; modes: number[];
}

export function describe(values: number[]): Stats {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const squares = values.reduce((a, v) => a + (v - mean) ** 2, 0);
  const variance = squares / n;
  const sampleVariance = n > 1 ? squares / (n - 1) : 0;
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const top = Math.max(...counts.values());
  const modes = top > 1 ? [...counts.entries()].filter(([, c]) => c === top).map(([v]) => v).sort((a, b) => a - b) : [];
  return {
    n, sum, mean, median, min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0],
    variance, sampleVariance, sd: Math.sqrt(variance), sampleSd: Math.sqrt(sampleVariance), modes,
  };
}

function table(stats: Stats): string {
  const rows: Array<[string, string]> = [
    ['Anzahl', fmtN(stats.n)],
    ['Summe', fmtN(stats.sum)],
    ['Mittelwert', fmtN(stats.mean, 4)],
    ['Median', fmtN(stats.median, 4)],
  ];
  if (stats.modes.length && stats.modes.length < stats.n) rows.push(['Modus (häufigster Wert)', stats.modes.map((v) => fmtN(v)).join(', ')]);
  rows.push(
    ['Minimum / Maximum', `${fmtN(stats.min)} / ${fmtN(stats.max)}`],
    ['Spannweite', fmtN(stats.range)],
    ['Standardabweichung (Stichprobe, n−1)', fmtN(stats.sampleSd, 4)],
    ['Standardabweichung (Grundgesamtheit, n)', fmtN(stats.sd, 4)],
    ['Varianz (Stichprobe)', fmtN(stats.sampleVariance, 4)],
  );
  return `| Kennzahl | Wert |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}`;
}

function rangeSum(text: string): ToolResult | null {
  const m = text.match(/^(?:summe|gesamtsumme|addiere)\s+(?:von\s+|aller\s+zahlen\s+von\s+|der\s+zahlen\s+von\s+)?(\d{1,9})\s+bis\s+(\d{1,9})$/i);
  if (!m) return null;
  const a = Math.min(+m[1], +m[2]);
  const b = Math.max(+m[1], +m[2]);
  const count = b - a + 1;
  const sum = (a + b) * count / 2;
  return {
    text: `**Summe von ${fmtN(a)} bis ${fmtN(b)} = ${fmtN(sum)}**\n\nRechnung (Gauß): (${fmtN(a)} + ${fmtN(b)}) × ${fmtN(count)} ÷ 2.`,
    source: 'stats',
    val: sum,
  };
}

export const statsTool: Tool = {
  id: 'stats',
  label: 'Statistik',
  help: '- **Statistik:** „Mittelwert von 3, 7, 12, 5“, „Median von …“, „Standardabweichung von …“, „Summe von 1 bis 100“',
  run(input) {
    const text = clean(input)
      .replace(/^(?:was\s+ist|wie\s+(?:hoch|groß|gross)\s+ist|berechne(?:\s+mir)?|bestimme|ermittle|gib\s+mir)\s+(?:der|die|das|den)?\s*/i, '')
      .replace(/^(?:der|die|das)\s+/i, '');
    const range = rangeSum(text);
    if (range) return range;
    const m = text.match(/^([a-zäöüß][a-zäöüß\s]{1,30}?)\s*(?:von|aus|für|fuer|der\s+zahlen|dieser\s+zahlen|der\s+werte|:)\s*:?\s*(.+)$/i);
    if (!m) return null;
    const kind = KINDS.find(([re]) => re.test(m[1].trim()))?.[1];
    if (!kind) return null;
    const values = parseNumberList(m[2]);
    if (!values || values.length < 2) return null;
    const stats = describe(values);
    const main: Record<Kind, number> = {
      mean: stats.mean, median: stats.median, sum: stats.sum, sd: stats.sampleSd, variance: stats.sampleVariance,
      min: stats.min, max: stats.max, range: stats.range, all: stats.mean,
    };
    const head = kind === 'all'
      ? `**Statistik für ${fmtN(stats.n)} Werte**`
      : `**${LABEL[kind]} = ${fmtN(main[kind], 4)}**`;
    const note = kind === 'sd' || kind === 'variance'
      ? '\n\n_Stichprobe (n−1) ist die übliche Schätzung aus Messwerten; Grundgesamtheit (n), wenn wirklich alle Werte vorliegen._'
      : '';
    const shown = values.length > 40 ? `${values.slice(0, 40).map((v) => fmtN(v)).join(', ')}, … (${fmtN(values.length)} Werte)` : values.map((v) => fmtN(v)).join(', ');
    return { text: `${head}\n\n${table(stats)}\n\nWerte: ${shown}${note}`, source: 'stats', val: main[kind] };
  },
};
