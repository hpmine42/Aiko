import { useEffect, useMemo, useState } from 'react';
import type { AikoConfig, Checklist, MessageWidget as MessageWidgetType, StopwatchState } from '../types';
import { Qr, norm } from '../engine/aikoEngine';
import { buildMonth, formatStopwatch, stopwatchElapsed } from '../engine/tools';
import { copyText, downloadBlob } from '../utils/browser';

interface MessageWidgetProps {
  widget?: MessageWidgetType | null;
  config: AikoConfig;
  onConfig: (config: AikoConfig) => void;
  toast: (message: string) => void;
}

export function MessageWidget({ widget, config, onConfig, toast }: MessageWidgetProps) {
  if (!widget) return null;
  if (widget.type === 'color') {
    return (
      <div className="wcd">
        <span className="wswatch" style={{ background: `#${widget.hex}` }} />
        <span>Farbe #{widget.hex}</span>
      </div>
    );
  }
  if (widget.type === 'qr') return <QrCodeWidget widget={widget} toast={toast} />;
  if (widget.type === 'pw') {
    return (
      <div className="wpw">
        <div className="wpw-h">{widget.label || 'Passwort'}</div>
        <code className="wpw-v">{widget.text}</code>
        <div className="wqr-b">
          <button type="button" className="pw-copy" onClick={async () => { toast(await copyText(widget.text) ? 'Kopiert' : 'Kopieren fehlgeschlagen'); }}>Kopieren</button>
        </div>
      </div>
    );
  }
  if (widget.type === 'chart') return <ChartWidget svg={widget.svg} toast={toast} />;
  if (widget.type === 'list') {
    return <ChecklistWidget name={widget.name} config={config} onConfig={onConfig} toast={toast} />;
  }
  if (widget.type === 'stopwatch') return <StopwatchWidget config={config} onConfig={onConfig} toast={toast} />;
  if (widget.type === 'calendar') return <CalendarWidgetView year={widget.year} month={widget.month} state={widget.state} />;
  return null;
}

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function CalendarWidgetView({ year, month, state }: { year: number; month: number; state: string | null }) {
  const cal = useMemo(() => buildMonth(year, month, state), [year, month, state]);
  const holidays = cal.weeks.flatMap((week) => week.days).filter((day): day is NonNullable<typeof day> => Boolean(day && day.holiday));
  return (
    <div className="wcal" role="table" aria-label={`Kalender ${MONTH_NAMES[month - 1]} ${year}`}>
      <div className="wcal-h">{MONTH_NAMES[month - 1]} {year}</div>
      <table>
        <thead>
          <tr><th className="wcal-kw" title="Kalenderwoche">KW</th>{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((name) => <th key={name}>{name}</th>)}</tr>
        </thead>
        <tbody>
          {cal.weeks.map((week) => (
            <tr key={week.kw}>
              <td className="wcal-kw">{week.kw}</td>
              {week.days.map((day, index) => (
                <td
                  key={index}
                  className={day ? [day.weekend ? 'we' : '', day.holiday ? 'hol' : '', day.today ? 'today' : ''].filter(Boolean).join(' ') : 'empty'}
                  title={day?.holiday || undefined}
                  aria-label={day ? `${day.day}. ${MONTH_NAMES[month - 1]}${day.holiday ? `, ${day.holiday}` : ''}${day.today ? ', heute' : ''}` : undefined}
                >
                  {day ? day.day : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {holidays.length > 0 && (
        <div className="wcal-f">{holidays.map((day) => `${day.day}. ${day.holiday}`).join(' · ')}</div>
      )}
    </div>
  );
}

function StopwatchWidget({ config, onConfig, toast }: { config: AikoConfig; onConfig: (config: AikoConfig) => void; toast: (message: string) => void }) {
  const state = config.stopwatch ?? null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!state?.running) return undefined;
    const interval = window.setInterval(() => tick((value) => value + 1), 100);
    return () => window.clearInterval(interval);
  }, [state?.running, state?.start]);
  if (!state) {
    return <div className="wsw"><div className="wsw-h">Stoppuhr</div><div className="wck-empty">Zurückgesetzt – „Stoppuhr starten“ beginnt neu.</div></div>;
  }
  const now = Date.now();
  const elapsed = stopwatchElapsed(state, now);
  const update = (next: StopwatchState | null) => onConfig({ ...config, stopwatch: next });
  const lastLap = state.laps.length ? state.laps[state.laps.length - 1] : 0;
  return (
    <div className="wsw" data-running={state.running ? 'true' : 'false'}>
      <div className="wsw-h">Stoppuhr<span className="wck-n">{state.running ? 'läuft' : 'angehalten'}</span></div>
      <div className="wsw-t" role="timer" aria-live="off">{formatStopwatch(elapsed)}</div>
      <div className="wsw-b">
        <button type="button" onClick={() => update(state.running ? { ...state, running: false, elapsed, start: now } : { ...state, running: true, start: now })}>
          {state.running ? 'Stopp' : 'Weiter'}
        </button>
        <button type="button" disabled={!state.running && !elapsed} onClick={() => update({ ...state, laps: [...state.laps, elapsed] })}>Runde</button>
        <button type="button" onClick={() => { update(null); toast('Stoppuhr zurückgesetzt'); }}>Zurücksetzen</button>
      </div>
      {state.laps.length > 0 && (
        <ol className="wsw-l">
          {state.laps.map((lap, index) => (
            <li key={`${lap}-${index}`}><span>Runde {index + 1}</span><span>{formatStopwatch(lap - (index ? state.laps[index - 1] : 0))}</span><span>{formatStopwatch(lap)}</span></li>
          ))}
          {state.running && <li className="wsw-cur"><span>Runde {state.laps.length + 1}</span><span>{formatStopwatch(elapsed - lastLap)}</span><span /></li>}
        </ol>
      )}
    </div>
  );
}

function QrCodeWidget({ widget, toast }: { widget: Extract<MessageWidgetType, { type: 'qr' }>; toast: (message: string) => void }) {
  const svg = useMemo(() => {
    try { return Qr.toSvg(Qr.encode(widget.text, widget.ecl || 'M'), undefined); } catch { return ''; }
  }, [widget.ecl, widget.text]);

  const save = () => {
    try {
      const qr = Qr.encode(widget.text, widget.ecl || 'M');
      const quiet = 4;
      const total = qr.size + quiet * 2;
      const scale = 8;
      const canvas = document.createElement('canvas');
      canvas.width = total * scale;
      canvas.height = total * scale;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Kein Canvas');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#000';
      for (let y = 0; y < qr.size; y += 1) {
        for (let x = 0; x < qr.size; x += 1) {
          if (qr.modules[y][x]) context.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
        }
      }
      const anchor = document.createElement('a');
      anchor.href = canvas.toDataURL('image/png');
      anchor.download = 'qr-code.png';
      anchor.click();
      toast('QR-Code gespeichert');
    } catch {
      toast('Speichern hier nicht möglich');
    }
  };

  return (
    <div className="wqr">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="wqr-b"><button type="button" className="qr-save" onClick={save}>Bild speichern</button></div>
    </div>
  );
}

function ChartWidget({ svg, toast }: { svg: string; toast: (message: string) => void }) {
  const save = () => {
    try {
      const image = new Image();
      image.onload = () => {
        try {
          const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
          const box = (parsed.getAttribute('viewBox') || '0 0 680 400').split(/[\s,]+/).map(Number);
          const canvas = document.createElement('canvas');
          canvas.width = (box[2] || 680) * 2;
          canvas.height = (box[3] || 400) * 2;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Kein Canvas');
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const anchor = document.createElement('a');
          anchor.href = canvas.toDataURL('image/png');
          anchor.download = 'diagramm.png';
          anchor.click();
          toast('Diagramm gespeichert');
        } catch { toast('Speichern hier nicht möglich'); }
      };
      image.onerror = () => toast('Speichern hier nicht möglich');
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch {
      toast('Speichern hier nicht möglich');
    }
  };
  // Charts may be restored from a user-supplied backup. An SVG used as an image
  // cannot execute inline event handlers, unlike an SVG inserted as HTML.
  return (
    <div className="wch">
      <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Diagramm" />
      <div className="wqr-b"><button type="button" className="ch-save" onClick={save}>Bild speichern</button></div>
    </div>
  );
}

function ChecklistWidget({
  name,
  config,
  onConfig,
  toast,
}: {
  name: string;
  config: AikoConfig;
  onConfig: (config: AikoConfig) => void;
  toast: (message: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const list = config.checklists.find((entry) => norm(entry.name) === norm(name));
  if (!list) {
    return <div className="wck"><div className="wck-h">{name || 'Liste'}</div><div className="wck-empty">Liste wurde gelöscht</div></div>;
  }

  const update = (next: Checklist) => {
    onConfig({ ...config, checklists: config.checklists.map((entry) => entry === list ? next : entry) });
  };
  const add = () => {
    const additions = draft.split(/[,;]\s+/).map((entry) => entry.trim()).filter(Boolean);
    if (!additions.length) return;
    const items = [...list.items];
    additions.forEach((text) => {
      if (!items.some((entry) => norm(entry.t) === norm(text))) items.push({ t: text.slice(0, 60), done: false });
    });
    update({ ...list, items });
    setDraft('');
  };
  const completed = list.items.filter((item) => item.done).length;
  const exportList = () => {
    const text = [
      `${list.name} – ${completed}/${list.items.length} erledigt`,
      '',
      ...list.items.map((item) => `${item.done ? '☑' : '☐'} ${item.t}`),
    ].join('\n');
    const slug = list.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-+|-+$/g, '');
    downloadBlob(text, 'text/plain;charset=utf-8', `liste-${slug || 'aiko'}.txt`);
    toast('Liste exportiert');
  };

  return (
    <div className="wck" data-n={list.name}>
      <div className="wck-h">{list.name}<span className="wck-n">{list.items.length ? `${completed}/${list.items.length} erledigt` : 'noch leer'}</span></div>
      {list.items.map((item, index) => (
        <label className={`wck-i${item.done ? ' done' : ''}`} key={`${item.t}-${index}`}>
          <input
            type="checkbox"
            checked={item.done}
            onChange={(event) => update({
              ...list,
              items: list.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, done: event.target.checked } : entry),
            })}
          />
          <span>{item.t}</span>
        </label>
      ))}
      <div className="wck-add">
        <input
          type="text"
          placeholder="Hinzufügen …"
          maxLength={60}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}
        />
        <button type="button" aria-label="Hinzufügen" disabled={!draft.trim()} onClick={add}>+</button>
      </div>
      <div className="wqr-b"><button type="button" className="ck-export" onClick={exportList}>Liste exportieren</button></div>
    </div>
  );
}
