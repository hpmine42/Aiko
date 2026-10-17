/* Sudoku: Löser (Backtracking mit Bitmasken + MRV), Generator mit
   Eindeutigkeitsprüfung und Tipp-Funktion (nackte/verdeckte Single).
   Grid: 81 Zahlen, 0 = leer. Zeile 0 oben, Index r*9+c. */

export type SudokuGrid = number[];

const ALL = 0x1ff; // Ziffern 1–9 als Bitmaske

const bit = (v: number): number => 1 << (v - 1);
const popcount = (mask: number): number => {
  let n = 0;
  for (let i = 0; i < 9; i++) if (mask & (1 << i)) n++;
  return n;
};

function masks(grid: SudokuGrid): { rows: number[]; cols: number[]; boxes: number[] } {
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (!v) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    rows[r] |= bit(v);
    cols[c] |= bit(v);
    boxes[b] |= bit(v);
  }
  return { rows, cols, boxes };
}

/** Löst das Rätsel; `limit` begrenzt die Lösungssuche (2 = Eindeutigkeitstest).
   Doppelte Ziffern in einer Einheit werden vorab ausgeschlossen. */
export function sudokuSolve(input: SudokuGrid, limit = 1): { solutions: SudokuGrid[]; count: number } {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    units.push(Array.from({ length: 9 }, (_, k) => (br * 3 + Math.floor(k / 3)) * 9 + bc * 3 + (k % 3)));
  }
  for (const unit of units) {
    const seen = new Set<number>();
    for (const i of unit) {
      if (!input[i]) continue;
      if (seen.has(input[i])) return { solutions: [], count: 0 };
      seen.add(input[i]);
    }
  }

  const grid = input.slice();
  const { rows, cols, boxes } = masks(grid);
  const solutions: SudokuGrid[] = [];

  const place = (i: number, v: number): void => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    grid[i] = v;
    rows[r] |= bit(v);
    cols[c] |= bit(v);
    boxes[b] |= bit(v);
  };
  const unplace = (i: number, v: number): void => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    grid[i] = 0;
    rows[r] &= ~bit(v);
    cols[c] &= ~bit(v);
    boxes[b] &= ~bit(v);
  };

  const search = (): boolean => {
    if (solutions.length >= limit) return true;
    // MRV: leere Zelle mit wenigsten Kandidaten suchen
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const mask = ALL & ~(rows[r] | cols[c] | boxes[b]);
      const count = popcount(mask);
      if (count === 0) return false; // Sackgasse
      if (count < bestCount) { best = i; bestMask = mask; bestCount = count; if (count === 1) break; }
    }
    if (best < 0) {
      solutions.push(grid.slice());
      return solutions.length >= limit;
    }
    for (let v = 1; v <= 9; v++) {
      if (!(bestMask & bit(v))) continue;
      place(best, v);
      if (search()) return true;
      unplace(best, v);
    }
    return false;
  };

  search();
  return { solutions, count: solutions.length };
}

/** Kandidaten einer Zelle. */
function candidates(grid: SudokuGrid, i: number): number[] {
  const { rows, cols, boxes } = masks(grid);
  const r = Math.floor(i / 9);
  const c = i % 9;
  const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  const mask = ALL & ~(rows[r] | cols[c] | boxes[b]);
  const out: number[] = [];
  for (let v = 1; v <= 9; v++) if (mask & bit(v)) out.push(v);
  return out;
}

export interface SudokuHint {
  row: number;
  col: number;
  value: number;
  reason: string;
}

/** Nächster logischer Tipp: nackte Single, dann verdeckte Single, sonst null. */
export function sudokuHint(grid: SudokuGrid): SudokuHint | null {
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const cand = candidates(grid, i);
    if (cand.length === 1) {
      const r = Math.floor(i / 9) + 1;
      const c = (i % 9) + 1;
      return { row: r, col: c, value: cand[0], reason: `In Zeile ${r}, Spalte ${c} ist **${cand[0]}** die einzige Möglichkeit (nackter Single) – alle anderen Ziffern stehen schon in Zeile, Spalte oder Block.` };
    }
  }
  // Verdeckte Single: Ziffer v hat in einer Einheit nur eine mögliche Position
  const units: Array<[string, number[]]> = [];
  for (let r = 0; r < 9; r++) units.push([`Zeile ${r + 1}`, Array.from({ length: 9 }, (_, c) => r * 9 + c)]);
  for (let c = 0; c < 9; c++) units.push([`Spalte ${c + 1}`, Array.from({ length: 9 }, (_, r) => r * 9 + c)]);
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    units.push([`Block ${br * 3 + bc + 1}`, Array.from({ length: 9 }, (_, k) => (br * 3 + Math.floor(k / 3)) * 9 + bc * 3 + (k % 3))]);
  }
  for (const [name, cells] of units) {
    for (let v = 1; v <= 9; v++) {
      const spots = cells.filter((i) => !grid[i] && candidates(grid, i).includes(v));
      if (spots.length === 1) {
        const i = spots[0];
        return { row: Math.floor(i / 9) + 1, col: (i % 9) + 1, value: v, reason: `In ${name} kann die **${v}** nur an eine Position: Zeile ${Math.floor(i / 9) + 1}, Spalte ${(i % 9) + 1} (verdeckter Single).` };
      }
    }
  }
  return null;
}

/** Vollständiges, zufälliges Sudoku (zufällig geordnete Backtracking-Füllung). */
export function sudokuFilled(rand: () => number = Math.random): SudokuGrid {
  const grid: SudokuGrid = new Array(81).fill(0);
  const { rows, cols, boxes } = masks(grid);
  const shuffle = <T,>(list: T[]): T[] => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const m = bit(v);
      if ((rows[r] | cols[c] | boxes[b]) & m) continue;
      grid[i] = v;
      rows[r] |= m; cols[c] |= m; boxes[b] |= m;
      if (fill(i + 1)) return true;
      grid[i] = 0;
      rows[r] &= ~m; cols[c] &= ~m; boxes[b] &= ~m;
    }
    return false;
  };
  fill(0);
  return grid;
}

export type SudokuDifficulty = 'leicht' | 'mittel' | 'schwer';

const TARGETS: Record<SudokuDifficulty, number> = { leicht: 40, mittel: 33, schwer: 27 };

/** Rätsel mit eindeutiger Lösung: Vorgaben werden zufällig entfernt, Eindeutigkeit bleibt garantiert. */
export function sudokuGenerate(difficulty: SudokuDifficulty, rand: () => number = Math.random): { puzzle: SudokuGrid; solution: SudokuGrid } {
  const solution = sudokuFilled(rand);
  const puzzle = solution.slice();
  const order = Array.from({ length: 81 }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const target = TARGETS[difficulty];
  let givens = 81;
  for (const i of order) {
    if (givens <= target) break;
    const backup = puzzle[i];
    puzzle[i] = 0;
    if (sudokuSolve(puzzle, 2).count === 1) givens--;
    else puzzle[i] = backup;
  }
  return { puzzle, solution };
}

/** Grid als lesbaren Text (· = leer). */
export function sudokuRender(grid: SudokuGrid): string {
  const lines: string[] = [];
  for (let r = 0; r < 9; r++) {
    const cells = Array.from({ length: 9 }, (_, c) => (grid[r * 9 + c] || '·').toString());
    lines.push(cells.slice(0, 3).join(' ') + ' │ ' + cells.slice(3, 6).join(' ') + ' │ ' + cells.slice(6, 9).join(' '));
    if (r === 2 || r === 5) lines.push('──────┼───────┼──────');
  }
  return '```text\n' + lines.join('\n') + '\n```';
}

/** Parsert 81 Ziffern (0 oder . _ - * als leer) aus freiem Text; null bei falscher Länge. */
export function sudokuParse(raw: string): SudokuGrid | null {
  const cleaned = raw.replace(/[^0-9._\-*]/g, '').replace(/[._*-]/g, '0');
  if (cleaned.length !== 81 || !/^\d{81}$/.test(cleaned)) return null;
  return cleaned.split('').map(Number);
}
