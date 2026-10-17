import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageWidget } from '../components/MessageWidget';
import type { AikoConfig } from '../types';

const config = { checklists: [] } as unknown as AikoConfig;
const noop = () => {};
const renderWidget = (widget: object, onSend?: (text: string) => void) =>
  render(<MessageWidget widget={widget as never} config={config} onConfig={noop} toast={noop} onSend={onSend} />);

describe('Brett-Widgets im Chat', () => {
  it('rendert ein klickbares Tic-Tac-Toe-Brett und sendet Züge', () => {
    const send = vi.fn();
    renderWidget({ type: 'ttt', board: `X O${' '.repeat(6)}`, over: false }, send);
    expect(screen.getByRole('group', { name: 'Tic-Tac-Toe-Brett' })).toBeInTheDocument();
    // Belegte Felder sind keine Buttons, leere Felder klickbar
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('O')).toBeInTheDocument();
    const cell5 = screen.getByRole('button', { name: 'Feld 5 belegen' });
    fireEvent.click(cell5);
    expect(send).toHaveBeenCalledWith('Tic Tac Toe: 5');
    expect(screen.getAllByRole('button')).toHaveLength(7); // 9 - 2 belegt
  });

  it('deaktiviert das Tic-Tac-Toe-Brett nach Spielende', () => {
    const send = vi.fn();
    renderWidget({ type: 'ttt', board: `XXXOO${' '.repeat(4)}`, over: true }, send);
    expect(screen.getByRole('button', { name: 'Feld 6 belegen' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Feld 6 belegen' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('rendert Vier gewinnt mit Spalten-Buttons', () => {
    const send = vi.fn();
    const board = ' '.repeat(42).split('');
    board[41] = 'X'; // unterste Reihe, Spalte 7
    renderWidget({ type: 'c4', board: board.join(''), over: false }, send);
    expect(screen.getByRole('group', { name: 'Vier-gewinnt-Brett' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'In Spalte 3 werfen' }));
    expect(send).toHaveBeenCalledWith('4 Gewinnt: Spalte 3');
  });

  it('kennt keine Funktion ohne onSend und nach Spielende', () => {
    const { rerender } = render(<MessageWidget widget={{ type: 'c4', board: ' '.repeat(42), over: false } as never} config={config} onConfig={noop} toast={noop} />);
    expect(screen.getByRole('button', { name: 'In Spalte 4 werfen' })).toBeDisabled();
    rerender(<MessageWidget widget={{ type: 'c4', board: ' '.repeat(42), over: true } as never} config={config} onConfig={noop} toast={noop} onSend={() => {}} />);
    expect(screen.getByRole('button', { name: 'In Spalte 4 werfen' })).toBeDisabled();
  });
});
