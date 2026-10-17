/* Tic-Tac-Toe: perfekter Minimax-Spieler mit einstellbarer Stärke.
   Board: 9 Zeichen 'X' (Mensch), 'O' (Aiko), ' ' (leer) – indexiert 0–8. */

export type TttPlayer = 'X' | 'O';
export type TttBoard = string;

export const TTT_LINES: readonly number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** 'X'/'O' bei Gewinn, 'D' bei Remis (Brett voll), sonst null. */
export function tttWinner(board: TttBoard): TttPlayer | 'D' | null {
  for (const [a, b, c] of TTT_LINES) {
    const v = board[a];
    if (v !== ' ' && v === board[b] && v === board[c]) return v as TttPlayer;
  }
  return board.includes(' ') ? null : 'D';
}

const winnerAt = (board: TttBoard, player: TttPlayer): boolean =>
  TTT_LINES.some(([a, b, c]) => board[a] === player && board[b] === player && board[c] === player);

/** Klassischer Minimax: Rückgabe aus Sicht von `me`. */
function minimax(board: TttBoard, me: TttPlayer, turn: TttPlayer, depth: number): number {
  if (winnerAt(board, me)) return 10 - depth;
  if (winnerAt(board, me === 'X' ? 'O' : 'X')) return depth - 10;
  if (!board.includes(' ')) return 0;
  const scores: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] !== ' ') continue;
    scores.push(minimax(board.slice(0, i) + turn + board.slice(i + 1), me, turn === 'X' ? 'O' : 'X', depth + 1));
  }
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

/** Bester Zug für `player` (perfekt). */
export function tttBestMove(board: TttBoard, player: TttPlayer): number {
  let best = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== ' ') continue;
    const score = minimax(board.slice(0, i) + player + board.slice(i + 1), player, player === 'X' ? 'O' : 'X', 0);
    if (score > best) { best = score; move = i; }
  }
  return move;
}

/**
 * Zug für Aiko (`player`) nach Schwierigkeit:
 * 3 = perfekt (Minimax) · 2 = meist perfekt (80 %) · 1 = zufällig.
 * `rand` ist injizierbar für deterministische Tests.
 */
export function tttMove(board: TttBoard, player: TttPlayer, difficulty: number, rand: () => number = Math.random): number {
  const free: number[] = [];
  for (let i = 0; i < 9; i++) if (board[i] === ' ') free.push(i);
  if (!free.length) return -1;
  if (difficulty <= 1) return free[Math.floor(rand() * free.length)];
  if (difficulty === 2 && rand() < 0.2) return free[Math.floor(rand() * free.length)];
  return tttBestMove(board, player);
}

/** Brett als Text (Zellennummern zeigen leere Felder). */
export function tttRender(board: TttBoard): string {
  const cell = (i: number) => (board[i] === ' ' ? String(i + 1) : board[i]);
  return `\`\`\`text\n ${cell(0)} │ ${cell(1)} │ ${cell(2)}\n───┼───┼───\n ${cell(3)} │ ${cell(4)} │ ${cell(5)}\n───┼───┼───\n ${cell(6)} │ ${cell(7)} │ ${cell(8)}\n\`\`\``;
}
