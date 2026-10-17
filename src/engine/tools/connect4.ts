/* Vier gewinnt: 7 Spalten × 6 Reihen, Alpha-Beta-Suche mit Zugsortierung.
   Board: 42 Zeichen 'X' (Mensch), 'O' (Aiko), ' ' (leer) – Index 0 oben links,
   Zeile für Zeile. Ein Wurf fällt auf die tiefste leere Zelle der Spalte. */

export type C4Player = 'X' | 'O';

export const C4_COLS = 7;
export const C4_ROWS = 6;
export const C4_ORDER = [3, 2, 4, 1, 5, 0, 6]; // Mitte zuerst → bessere Pruning-Reihenfolge

/** Lässt `player` in `col` fallen; zurück fällt die Zeile (0 = oben) oder −1 (voll/ungültig). */
export function c4Drop(board: string, col: number, player: C4Player): { row: number; board: string } | null {
  if (col < 0 || col >= C4_COLS) return null;
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    const i = row * C4_COLS + col;
    if (board[i] === ' ') return { row, board: board.slice(0, i) + player + board.slice(i + 1) };
  }
  return null;
}

/** 'X'/'O' bei vier in Reihe, 'D' bei vollem Brett, sonst null. */
export function c4Winner(board: string): C4Player | 'D' | null {
  const at = (i: number) => (i >= 0 && i < 42 ? board[i] : ' ');
  const dirs = [1, C4_COLS, C4_COLS + 1, C4_COLS - 1];
  for (let row = 0; row < C4_ROWS; row++) {
    for (let col = 0; col < C4_COLS; col++) {
      const v = at(row * C4_COLS + col);
      if (v === ' ') continue;
      for (const d of dirs) {
        let count = 1;
        while (at(row * C4_COLS + col + count * d) === v) count++;
        if (count >= 4) return v as C4Player;
      }
    }
  }
  return board.includes(' ') ? null : 'D';
}

const c4Full = (board: string): boolean => !board.includes(' ');

/** Heuristik aus Sicht von `me`: zählt 4er-/3er-/2er-Fenster. */
function c4Score(board: string, me: C4Player): number {
  const opp: C4Player = me === 'X' ? 'O' : 'X';
  let score = 0;
  const windows: Array<[number, number]> = [[0, 1], [0, C4_COLS], [0, C4_COLS + 1], [0, C4_COLS - 1]];
  for (let row = 0; row < C4_ROWS; row++) {
    for (let col = 0; col < C4_COLS; col++) {
      const start = row * C4_COLS + col;
      for (const [dr, dc] of windows) {
        const cells: string[] = [];
        for (let k = 0; k < 4; k++) {
          const r = row + dr * k;
          const c = col + dc * k;
          if (r < 0 || r >= C4_ROWS || c < 0 || c >= C4_COLS) { cells.push('!'); break; }
          cells.push(board[r * C4_COLS + c]);
        }
        if (cells.includes('!') || cells.length < 4) continue;
        const mine = cells.filter((v) => v === me).length;
        const theirs = cells.filter((v) => v === opp).length;
        if (mine && theirs) continue;
        if (mine === 4) score += 100_000;
        else if (mine === 3) score += 120;
        else if (mine === 2) score += 12;
        else if (theirs === 4) score -= 100_000;
        else if (theirs === 3) score -= 150;
        else if (theirs === 2) score -= 15;
      }
    }
  }
  // Mittelspalte ist wertvoll
  for (let row = 0; row < C4_ROWS; row++) {
    const v = board[row * C4_COLS + 3];
    if (v === me) score += 6;
    else if (v === opp) score -= 6;
  }
  return score;
}

/** Sofortiger Gewinnzug für `player` oder −1. */
export function c4WinningMove(board: string, player: C4Player): number {
  for (const col of C4_ORDER) {
    const drop = c4Drop(board, col, player);
    if (drop && c4Winner(drop.board) === player) return col;
  }
  return -1;
}

function negamax(board: string, me: C4Player, turn: C4Player, depth: number, alpha: number, beta: number): number {
  const win = c4Winner(board);
  if (win === me) return 100_000 - depth;
  if (win === 'D') return 0;
  if (win !== null) return -100_000 + depth;
  if (depth === 0) return c4Score(board, me);
  const maxing = turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const col of C4_ORDER) {
    const drop = c4Drop(board, col, turn);
    if (!drop) continue;
    const score = negamax(drop.board, me, turn === 'X' ? 'O' : 'X', depth - 1, alpha, beta);
    if (maxing) { best = Math.max(best, score); alpha = Math.max(alpha, score); }
    else { best = Math.min(best, score); beta = Math.min(beta, score); }
    if (beta <= alpha) break;
  }
  return best === Infinity || best === -Infinity ? c4Score(board, me) : best;
}

/**
 * Zug für `player` mit Tiefe `depth` (Alpha-Beta, Mitte zuerst).
 * Tiefe 0/1 = nur Gewinn-/Block-Check + Mittelspalte.
 */
export function c4BestMove(board: string, player: C4Player, depth: number): number {
  const win = c4WinningMove(board, player);
  if (win >= 0) return win;
  const block = c4WinningMove(board, player === 'X' ? 'O' : 'X');
  if (block >= 0) return block;
  const legal = C4_ORDER.filter((col) => board[col] === ' ');
  if (!legal.length) return -1;
  if (depth <= 1) return legal[Math.floor(Math.random() * legal.length)];
  let best = -Infinity;
  let move = legal[0];
  for (const col of legal) {
    const drop = c4Drop(board, col, player);
    if (!drop) continue;
    const score = negamax(drop.board, player, player === 'X' ? 'O' : 'X', depth - 1, -Infinity, Infinity);
    if (score > best) { best = score; move = col; }
  }
  return move;
}

/** Brett als Text mit Spaltennummern (· = leer). */
export function c4Render(board: string): string {
  const lines = ['1 2 3 4 5 6 7'];
  for (let row = 0; row < C4_ROWS; row++) {
    lines.push(Array.from({ length: C4_COLS }, (_, col) => {
      const v = board[row * C4_COLS + col];
      return v === ' ' ? '·' : v;
    }).join(' '));
  }
  return `\`\`\`text\n${lines.join('\n')}\n\`\`\``;
}
