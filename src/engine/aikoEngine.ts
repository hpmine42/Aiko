// @ts-nocheck
/*
 * Behaviour engine ported from ai21.html. Algorithms and German response
 * strings intentionally remain unchanged so existing rules and chats keep
 * their original behaviour. The typed React layer owns persistence and UI.
 */
import { DEFAULT_CONFIG } from '../data/defaultConfig';
import { RULE_CODE_DOC } from '../data/ruleCodeDoc';
import { iconHtml as ic } from '../components/Icon';
import type { AikoConfig, ChatMessage, EngineResult, QrApi, Rule, RuleHit, RuleTestResult, TimerAdapter } from '../types';
import { clone, variantsOf } from '../utils/config';

let cfg: AikoConfig = clone(DEFAULT_CONFIG);
let onConfigChange: (config: AikoConfig) => void = () => {};
let timerAdapter: TimerAdapter = {
  getTimers: () => [],
  start: () => {},
  stopAll: () => 0,
};

export function configureEngine(
  config: AikoConfig,
  configChange?: (next: AikoConfig) => void,
  timers?: TimerAdapter,
): void {
  cfg = config;
  if (configChange) onConfigChange = configChange;
  if (timers) timerAdapter = timers;
  KCACHE = null;
  DICT = null;
}

export function getEngineConfig(): AikoConfig { return cfg; }
function saveCfg(): void { onConfigChange(clone(cfg)); }
const rnd = a => a[Math.floor(Math.random() * a.length)];
function withName(t: unknown): string {
  const n = (cfg && cfg.userName) || "";
  t = String(t || "");
  if(n) return t.replace(/\{name\}/gi, n);
  return t.replace(/,\s*\{name\}/gi, "").replace(/\s*\{name\}/gi, "").replace(/\{name\}/gi, "");
}
export { withName, variantsOf, RULE_CODE_DOC };
function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

/* ---------------- Markdown ---------------- */
const KWS = new Set("and as async await break case catch class const continue def default del do elif else enum except export extends false False finally fn for from function if import in interface is lambda let new None not null of or pass private public raise return self static struct super switch this throw true True try type undefined var void while with yield".split(" "));
const RE_C = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)/g;
const RE_H = /(#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*)/g;
function hl(code, lang){
  if(!lang || /^(text|txt|plain|markdown|md)$/.test(lang)) return esc(code);
  const re = new RegExp((/^(py|python|sh|bash|shell|zsh|rb|ruby|ya?ml|toml|ini)$/.test(lang) ? RE_H : RE_C).source, "g");
  let out = "", last = 0, m;
  while((m = re.exec(code))){
    out += esc(code.slice(last, m.index)); last = re.lastIndex;
    if(m[1]) out += '<span class="tc">' + esc(m[1]) + "</span>";
    else if(m[2]) out += '<span class="ts">' + esc(m[2]) + "</span>";
    else if(m[3]) out += '<span class="tn">' + m[3] + "</span>";
    else if(m[4]){
      const w = m[4];
      if(KWS.has(w)) out += '<span class="tk">' + w + "</span>";
      else if(code[re.lastIndex] === "(") out += '<span class="tf">' + esc(w) + "</span>";
      else out += esc(w);
    }
  }
  return out + esc(code.slice(last));
}
function codeHTML(b){
  const lang = (b.lang || "").toLowerCase();
  return '<div class="cb"><div class="cbh"><span>' + esc(lang || "code") + '</span><button class="cbcopy" type="button">' + ic("copy") +
         "<span>Kopieren</span></button></div><pre><code>" + hl(b.code, lang) + "</code></pre></div>";
}
function inl(s){
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return "\u0001" + (codes.length - 1) + "\u0001"; });
  s = esc(s);
  s = s.replace(/(^|[^_\w])_(?!\s)([^_]+?)_(?!\w)/g, "$1<em>$2</em>");   // _kursiv_ (vor den Links, sonst kollidiert target="_blank")
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return s.replace(/\u0001(\d+)\u0001/g, (m, k) => "<code>" + esc(codes[+k]) + "</code>");
}
const LIST_RE = /^([-*+•]|\d+[.)])\s+(.*)$/;
export function md(src){
  src = String(src || "").replace(/\r\n?/g, "\n");
  if(((src.match(/^```/gm) || []).length) % 2) src += "\n```";   // offener Codeblock beim Streamen
  const blocks = [];
  src = src.replace(/^```([\w+#.-]*)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm, (m, lang, code) => {
    blocks.push({ lang: lang, code: code.replace(/\n$/, "") });
    return "\u0000" + (blocks.length - 1) + "\u0000";
  });
  const L = src.split("\n");
  const isStart = t => /^\u0000\d+\u0000$/.test(t) || /^#{1,6}\s/.test(t) || LIST_RE.test(t) || /^>/.test(t) || /^(-{3,}|\*{3,})$/.test(t) || /^\|/.test(t);
  let out = "", i = 0, m;
  while(i < L.length){
    const t = L[i].trim();
    if(!t){ i++; continue; }
    if((m = t.match(/^\u0000(\d+)\u0000$/))){ out += codeHTML(blocks[+m[1]]); i++; continue; }
    if(/^(-{3,}|\*{3,})$/.test(t)){ out += "<hr>"; i++; continue; }
    if((m = t.match(/^(#{1,6})\s+(.*)$/))){ const n = Math.min(3, m[1].length); out += "<h" + n + ">" + inl(m[2]) + "</h" + n + ">"; i++; continue; }
    if(/^\|/.test(t) && i + 1 < L.length && /^\|?\s*:?-{2,}/.test(L[i + 1].trim())){
      const row = s => s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
      const head = row(t), rows = []; i += 2;
      while(i < L.length && /^\|/.test(L[i].trim())){ rows.push(row(L[i])); i++; }
      out += '<div class="tbl"><table><thead><tr>' + head.map(h => "<th>" + inl(h) + "</th>").join("") + "</tr></thead><tbody>" +
             rows.map(r => "<tr>" + head.map((_, k) => "<td>" + inl(r[k] || "") + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
      continue;
    }
    if(/^>/.test(t)){
      const q = [];
      while(i < L.length && /^>/.test(L[i].trim())){ q.push(L[i].trim().replace(/^>\s?/, "")); i++; }
      out += "<blockquote>" + md(q.join("\n")) + "</blockquote>"; continue;
    }
    if((m = t.match(LIST_RE))){
      const ord = /\d/.test(m[1]), tag = ord ? "ol" : "ul", start = ord ? parseInt(m[1], 10) : 1, items = [];
      while(i < L.length){
        const mm = L[i].trim().match(LIST_RE);
        if(mm && /\d/.test(mm[1]) === ord){ items.push(inl(mm[2])); i++; } else break;
      }
      out += "<" + tag + (ord && start !== 1 ? ' start="' + start + '"' : "") + ">" + items.map(x => "<li>" + x + "</li>").join("") + "</" + tag + ">";
      continue;
    }
    const p = [];
    while(i < L.length){
      const tt = L[i].trim();
      if(!tt || (p.length && isStart(tt))) break;
      p.push(inl(tt)); i++;
    }
    out += "<p>" + p.join("<br>") + "</p>";
  }
  return out;
}
export function plain(src){
  const d = el("div", null, md(src));
  d.querySelectorAll("p,li,h1,h2,h3,td,th,pre,br").forEach(x => x.after(" "));
  return d.textContent.replace(/\s+/g, " ").trim();
}

/* ---------------- Matching ---------------- */
export function norm(s){
  return String(s).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function tokens(s){ return norm(s).split(" ").filter(w => w.length > 1); }
export function ruleTitle(r){ return r.patterns.slice(0, 3).join(", ") || "Ohne Stichwörter"; }
/* Echter Offline-Rechner: eigener Parser, kein eval/Function, keine Netzwerkanfragen. */
const NovaMath = (() => {
  let last = null;
  const fail = s => { throw new Error(s); };
  const clean = a => {
    while(a.length > 1 && a[a.length - 1] === 0) a.pop();
    if(a.some(x => !Number.isFinite(x))) fail('Das Ergebnis ist außerhalb des unterstützten Zahlenbereichs.');
    return a;
  };
  const constant = a => { if(a.length !== 1) fail('Diese Funktion ist in Gleichungen mit x nicht unterstützt.'); return a[0]; };
  function add(a,b,k=1){ return clean(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||0)+k*(b[i]||0))); }
  function mul(a,b){
    if(a.length+b.length>4) fail('Unterstützt werden Gleichungen bis zum Grad 2.');
    const c=Array(a.length+b.length-1).fill(0);
    a.forEach((v,i)=>b.forEach((w,j)=>c[i+j]+=v*w)); return clean(c);
  }
  function divide(a,b){ const d=constant(b); if(d===0) fail('Division durch null ist nicht definiert.'); return clean(a.map(v=>v/d)); }
  function power(a,b){
    const n=constant(b);
    if(a.length===1){ if(a[0]===0 && n<0) fail('Division durch null ist nicht definiert.'); const v=Math.pow(a[0],n); if(Number.isNaN(v)) fail('Diese Potenz hat kein reelles Ergebnis.'); return clean([v]); }
    if(!Number.isInteger(n)||n<0||n>2) fail('Unterstützt werden Gleichungen bis zum Grad 2 mit nichtnegativen ganzzahligen Potenzen.');
    let c=[1]; for(let i=0;i<n;i++) c=mul(c,a); return c;
  }
  const functions = Object.assign(Object.create(null), {
    sqrt: x => { if(x<0) fail('Die Quadratwurzel einer negativen Zahl ist in den reellen Zahlen nicht definiert.'); return Math.sqrt(x); },
    cbrt:Math.cbrt, abs:Math.abs, sin:Math.sin, cos:Math.cos, tan:Math.tan,
    asin:Math.asin, acos:Math.acos, atan:Math.atan,
    sind:x=>Math.sin(x*Math.PI/180), cosd:x=>Math.cos(x*Math.PI/180), tand:x=>Math.tan(x*Math.PI/180),
    ln: x => { if(x<=0) fail('Der Logarithmus ist nur für positive Zahlen definiert.'); return Math.log(x); },
    log: x => { if(x<=0) fail('Der Logarithmus ist nur für positive Zahlen definiert.'); return Math.log10(x); },
    exp:Math.exp, round:Math.round, floor:Math.floor, ceil:Math.ceil
  });
  function normalize(s){
    return s.toLowerCase().replace(/−|–/g,'-').replace(/[×·⋅]/g,'*').replace(/[÷:]/g,'/')
      .replace(/\*\*/g,'^').replace(/π/g,'pi').replace(/²/g,'^2').replace(/³/g,'^3')
      .replace(/√/g,'sqrt').replace(/\bquadratwurzel\s+(?:aus|von)\s+/g,'sqrt ')
      .replace(/\bwurzel\s+(?:aus|von)\s+/g,'sqrt ').replace(/\bkubikwurzel\s+(?:aus|von)\s+/g,'cbrt ')
      .replace(/\bhoch\b/g,'^').replace(/\bplus\b/g,'+').replace(/\bminus\b/g,'-')
      .replace(/\b(?:multipliziert mit|mal)\b/g,'*').replace(/\b(?:geteilt durch|dividiert durch|durch)\b/g,'/')
      .replace(/\bprozent\b/g,'%').replace(/\b(?:ist gleich|gleich)\b/g,'=');
  }
  function parse(raw, variable=false){
    if(raw.length>1200) fail('Die Rechenaufgabe ist zu lang (maximal 1.200 Zeichen pro Ausdruck).');
    const s=normalize(raw), t=[]; let pos=0;
    while(pos<s.length){
      if(/\s/.test(s[pos])){pos++;continue;}
      const sub=s.slice(pos); let m;
      // Deutsch: 1.234,56; auch 1.5 als Dezimalzahl. Gruppierte Ganzzahlen: 1.234.567.
      if((m=sub.match(/^(?:\d{1,3}(?:\.\d{3})+,\d+|\d{1,3}(?:\.\d{3}){2,}|\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?/))){
        const text=m[0], v=Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):((text.match(/\./g)||[]).length>1?text.replace(/\./g,''):text));
        if(!Number.isFinite(v)) fail('Die Zahl ist zu groß.'); t.push({kind:'n',v}); pos+=text.length;
      }else if((m=sub.match(/^[a-z]+/))){t.push({kind:m[0]});pos+=m[0].length;}
      else if('+-*/^()%!'.includes(s[pos])){t.push({kind:s[pos++]});}
      else fail('Dieses Zeichen oder diese Schreibweise wird nicht unterstützt.');
      if(t.length>500) fail('Die Rechenaufgabe enthält zu viele Zeichen.');
    }
    let i=0,depth=0; const at=()=>t[i]?.kind; const eat=k=>{if(at()===k){i++;return true;}return false;};
    function atom(){
      if(++depth>48) fail('Zu viele verschachtelte Klammern.'); let a;
      if(at()==='n') a=[t[i++].v];
      else if(eat('pi')) a=[Math.PI]; else if(eat('e')) a=[Math.E];
      else if(eat('x')){ if(!variable) fail('Für x ist kein Wert angegeben. Schreibe eine Gleichung, z. B. 2x + 3 = 11.'); a=[0,1]; }
      else if(eat('(')){a=sum(); if(!eat(')')) fail('Eine schließende Klammer fehlt.');}
      else if(functions[at()]){
        const name=t[i++].kind; let arg;
        if(eat('(')){arg=sum();if(!eat(')')) fail('Eine schließende Klammer fehlt.');}
        else arg=unary();
        const v=functions[name](constant(arg)); if(Number.isNaN(v)) fail('Diese Funktion hat für den eingegebenen Wert kein reelles Ergebnis.'); a=clean([v]);
      }else fail('Hier fehlt eine Zahl, eine Klammer oder eine unterstützte Funktion.');
      depth--; return a;
    }
    function postfix(){let a=atom();while(at()==='%'||at()==='!'){
      if(eat('%')) a=divide(a,[100]);
      else {i++;const v=constant(a);if(!Number.isInteger(v)||v<0||v>170) fail('Fakultät ist für ganze Zahlen von 0 bis 170 unterstützt.');let r=1;for(let k=2;k<=v;k++)r*=k;a=[r];}
    }return a;}
    function exponent(){let a=postfix();if(eat('^')) a=power(a,unary());return a;}
    function unary(){if(eat('+'))return unary();if(eat('-'))return clean(unary().map(v=>-v));return exponent();}
    function product(){let a=unary();while(true){
      if(eat('*'))a=mul(a,unary());else if(eat('/'))a=divide(a,unary());
      else if(eat('mod')){const x=constant(a),y=constant(unary());if(y===0)fail('Modulo durch null ist nicht definiert.');a=clean([x%y]);}
      else if(at()==='('||at()==='pi'||at()==='e'||at()==='x'||functions[at()]) a=mul(a,unary());
      else break;
    }return a;}
    function sum(){let a=product();while(at()==='+'||at()==='-'){const k=t[i++].kind;a=add(a,product(),k==='+'?1:-1);}return a;}
    if(!t.length)fail('Bitte gib eine Rechenaufgabe an.'); const a=sum();
    if(i!==t.length) fail('Der Ausdruck ist unvollständig oder enthält eine unerwartete Klammer.');return a;
  }
  function fmt(v){
    if(!Number.isFinite(v)) fail('Das Ergebnis ist außerhalb des unterstützten Zahlenbereichs.');
    if(Object.is(v,-0))v=0;
    if(Number.isInteger(v)&&!Number.isSafeInteger(v)) return v.toExponential(10).replace('.',',');
    return new Intl.NumberFormat('de-DE',{maximumSignificantDigits:12}).format(v);
  }
  function result(expr){
    if(expr.includes('=')){
      const parts=expr.split('=');if(parts.length!==2||!parts.every(p=>p.trim()))fail('Bitte gib eine Gleichung mit genau einem Gleichheitszeichen an.');
      const p=add(parse(parts[0],true),parse(parts[1],true),-1);let answer;
      if(p.length===1)answer=p[0]===0?'Die Gleichung ist für alle reellen x erfüllt.':'Die Gleichung hat keine Lösung.';
      else if(p.length===2){const x=-p[0]/p[1];last=x;answer='**x = '+fmt(x)+'**\n\nRechenweg:\n\n1. Alles auf eine Seite bringen: '+fmt(p[1])+'x '+(p[0]<0?'− ':'+ ')+fmt(Math.abs(p[0]))+' = 0\n2. '+fmt(p[1])+'x = '+fmt(-p[0])+'\n3. x = '+fmt(-p[0])+' ÷ '+fmt(p[1])+' = **'+fmt(x)+'**';}
      else{
        const [c,b,a]=p, d=b*b-4*a*c;
        if(!Number.isFinite(d))fail('Die Koeffizienten sind zu groß.');
        if(d<0)answer='Die Gleichung hat keine reelle Lösung.';
        else if(d===0){last=-b/(2*a);answer='**x = '+fmt(-b/(2*a))+'**';}
        else {const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(d)); const roots=[q/a,c/q].sort((x,y)=>x-y);answer='**x₁ = '+fmt(roots[0])+'**, **x₂ = '+fmt(roots[1])+'**';}
        answer+='\n\nRechenweg (Mitternachtsformel):\n\n1. Normalform: '+fmt(a)+'x² '+(b<0?'− ':'+ ')+fmt(Math.abs(b))+'x '+(c<0?'− ':'+ ')+fmt(Math.abs(c))+' = 0\n2. Diskriminante D = b² − 4ac = '+fmt(d)+'\n3. x = (−b ± √D) ÷ 2a';
      }
      return '`'+expr+'`\n\n'+answer;
    }
    const a=parse(expr);const n=constant(a);last=n;
    let out='`'+expr+'` = **'+fmt(n)+'**';
    if(!Number.isInteger(n)||!Number.isSafeInteger(n))out+='\n\nNumerisches Ergebnis, gegebenenfalls auf 12 signifikante Stellen gerundet.';
    return out;
  }
  function strip(s){return s.trim().replace(/^(?:kannst du|könntest du)\s+(?:bitte\s+)?/i,'').replace(/\s+(?:berechnen|ausrechnen|lösen)\s*[?.]*$/i,'').replace(/^(?:bitte\s+)?(?:was\s+(?:ist|ergibt|sind)|wie\s+viel\s+(?:ist|ergibt|sind)|wieviel\s+(?:ist|ergibt)|berechne(?:\s+mir)?|rechne(?:\s+mir)?(?:\s+aus)?|löse(?:\s+(?:die\s+)?gleichung)?|calculate)\b\s*:?\s*/i,'').replace(/\s*(?:bitte|aus)\s*[?!.]*$/i,'').replace(/[?]+$/,'').replace(/\.$/,'').trim();}
  function one(text){
    last=null;
    const explicit=/^(?:bitte\s+)?(?:berechne|rechne|löse|calculate)\b/i.test(text.trim());
    let s=strip(text); if(s.endsWith('='))s=s.slice(0,-1).trim();
    if(/^(?:was ist|wie viel ist|berechne|rechne)$/i.test(s)) return explicit?'Bitte gib eine Rechenaufgabe an, zum Beispiel `23 × 17` oder `20 % von 150`.':null;
    if(/^(?:hilfe\s+(?:zum|beim)\s+rechnen|rechner\s*hilfe)$/i.test(s))return help;
    const n='([+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+))';
    let m;
    try{
      // Prozent-Fragen haben klar getrennte Bedeutungen: Anteil, Prozentsatz, Veränderung.
      if((m=s.match(new RegExp('^'+n+'\\s*(?:%|prozent)\\s*(?:von|auf)\\s*'+n+'\\s*(?:€|euro)?[.!]?$', 'i')))){
        const a=constant(parse(m[1])),b=constant(parse(m[2]));return '**'+fmt(a)+' % von '+fmt(b)+' = '+fmt(a*b/100)+'**\n\nRechnung: '+fmt(b)+' × '+fmt(a)+' ÷ 100.';
      }
      if((m=s.match(new RegExp('^'+n+'\\s*(?:sind|ist)\\s*(?:wie viel|wieviel)\\s*(?:%|prozent)\\s*von\\s*'+n+'[?!]?$', 'i')))){
        const a=constant(parse(m[1])),b=constant(parse(m[2]));if(b===0)fail('Ein Prozentanteil mit Grundwert null ist nicht definiert.');return '**'+fmt(a)+' sind '+fmt(a/b*100)+' % von '+fmt(b)+'.**';
      }
      if((m=s.match(new RegExp('^'+n+'\\s*(?:€|euro)?\\s*(?:mit\\s*)?'+n+'\\s*(?:%|prozent)\\s*(rabatt|aufschlag|mehrwertsteuer|mwst)[.!]?$', 'i')))){
        const base=constant(parse(m[1])),rate=constant(parse(m[2])); const minus=m[3].toLowerCase()==='rabatt';return '**'+fmt(base*(1+(minus?-1:1)*rate/100))+'**\n\n'+(minus?'Abgezogen':'Aufgeschlagen')+': '+fmt(base*rate/100)+'.';
      }
      const normalized=normalize(s);
      const words=normalized.match(/[a-z]+/g)||[];
      const unknown=words.filter(w=>!['x','pi','e','mod',...Object.keys(functions)].includes(w));
      const looksMath=(/[+*/^%=!×÷√²³·⋅]|[-−–]\s*(?:[.,]?\d|\(|\b(?:sqrt|cbrt|abs|ln|log|sin|cos|tan|asin|acos|atan|exp|round|floor|ceil|pi|e|x|wurzel|quadratwurzel|kubikwurzel)\b)|\d\s*[-:−–]\s*\d|\b(?:plus|minus|mal|hoch|durch|wurzel|prozent|mod)\b/i.test(s)||new RegExp('^(?:'+Object.keys(functions).join('|')+')\\b','i').test(s));
      if(unknown.length){
        if(explicit || (/\d/.test(s)&&/\b(?:berechnen|rechnen|prozent|rabatt|wurzel|gleichung)\b/i.test(s)))return 'Diese Formulierung kann der Offline-Rechner nicht zuverlässig auswerten. Bitte schreibe einen mathematischen Ausdruck, z. B. `(15 + 7) / 2`, `20 % von 150` oder `2x + 3 = 11`. Freie Textaufgaben werden nicht automatisch gelöst.';
        return null;
      }
      if(!explicit&&!looksMath&&!/^(?:pi|e|x)$/.test(normalized))return null;
      const out=result(s);
      return out+(/\b(?:sin|cos|tan|asin|acos|atan)\b/i.test(s)?'\n\nWinkel werden im Bogenmaß (Radiant) gerechnet. Für Grad verwende `sind`, `cosd` oder `tand`.':'');
    }catch(e){return 'Ich kann diese Aufgabe so nicht berechnen: '+e.message+'\n\nPrüfe bitte den Ausdruck. Mit `Rechner Hilfe` siehst du unterstützte Beispiele.';}
  }
  const help='Ich kann **offline wirklich rechnen**:\n\n- Grundrechenarten und Klammern: `(15 + 7) / 2`\n- Potenzen: `2^3`, `2 hoch 3`\n- Wurzeln: `sqrt(81)`, `Wurzel aus 81`\n- Prozent: `20 % von 150`, `30 sind wie viel Prozent von 150`, `150 mit 20 % Rabatt`\n- Gleichungen mit x bis Grad 2: `2x + 3 = 11`, `x^2 - 5x + 6 = 0`\n- Rest einer Division: `17 mod 5`\n- Funktionen: `abs(-5)`, `ln(e)`, `log(100)`, `5!`, `sind(30)`\n\n**Punkt vor Strich**; Potenzen vor Vorzeichen; `^` ist rechtsassoziativ. `10 + 20 %` bedeutet `10 + 0,2`, nicht 20 % Aufschlag.\n\nDezimalkomma und Dezimalpunkt werden akzeptiert. `1.234` bedeutet hier 1,234; für eintausendzweihundertvierunddreißig schreibe `1234`. Sinus/Cosinus/Tangens ohne d rechnen in Radiant, mit d in Grad.\n\nErgebnisse werden numerisch berechnet (JavaScript-Gleitkommazahlen) und bei Bedarf gerundet. Freie Textaufgaben, Einheitenumrechnung und komplexe Zahlen sind nicht unterstützt. Mehrere Aufgaben kannst du auf getrennte Zeilen schreiben.';
  function reply(text){
    if(text.length>6000) return /^(?:berechne|rechne|löse)\b/i.test(text)?'Bitte kürze die Aufgabe auf maximal 6.000 Zeichen.':null;
    const lines=text.split('\n').map(s=>s.trim()).filter(Boolean);
    if(lines.length>1 && lines.length<=20){
      const answers=lines.map(one);
      if(answers.every(x=>x!==null))return answers.join('\n\n---\n\n');
    }
    return one(text);
  }
  return {reply,parse,result,lastValue:()=>last};
})();
/* =====================================================================
   Intelligente Offline-Erweiterungen
   Kontext/Folgeantworten · robuste Regeln · Platzhalter/Erinnerungen ·
   Einheiten · Datum · Zinsen · Dreisatz · Geometrie · Text-Werkzeuge ·
   Wörterbuch · Wissenssammlung
   ===================================================================== */
const NUM = "([+-]?\\d+(?:[.,]\\d+)?)";
const toNum = s => { s = String(s).trim(); return Number(s.indexOf(",") > -1 ? s.replace(/\./g, "").replace(",", ".") : s); };
function fmtN(v, digits){
  if(!Number.isFinite(v)) return "–";
  if(Object.is(v, -0)) v = 0;
  const a = Math.abs(v);
  if(a !== 0 && (a < 1e-4 || a >= 1e15)) return v.toExponential(6).replace(".", ",").replace(/0+e/, "e").replace(/,e/, "e");
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits == null ? 6 : digits }).format(v);
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------- Robuste Regeln ---------------- */
function lev(a, b, max){
  if(Math.abs(a.length - b.length) > max) return max + 1;
  let prev = []; for(let j = 0; j <= b.length; j++) prev[j] = j;
  for(let i = 1; i <= a.length; i++){
    const cur = [i]; let rowMin = i;
    for(let j = 1; j <= b.length; j++){
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if(cur[j] < rowMin) rowMin = cur[j];
    }
    if(rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
/* Tippfehler-Toleranz: ab 5 Buchstaben 1 Fehler, ab 9 Buchstaben 2 Fehler; erster Buchstabe muss stimmen */
function wordLike(w, q){
  if(w === q) return true;
  if(w.length < 5 || q.length < 4 || w.charAt(0) !== q.charAt(0)) return false;
  const max = w.length >= 9 ? 2 : 1;
  return lev(w, q, max) <= max;
}
function baseScore(query, raw){
  const q = norm(query), p = norm(raw);
  if(!q || !p) return 0;
  if(q === p) return 1.5;
  if((" " + q + " ").indexOf(" " + p + " ") > -1) return 1.25 - Math.min(.3, 1 / (p.length + 2));
  if(p.length > 3 && q.indexOf(p) > -1) return 1.0;
  if(q.length > 3 && p.indexOf(q) > -1) return .95;
  const pt = tokens(p), qt = tokens(q);
  if(!pt.length) return 0;
  let hit = 0, fuzzy = 0;
  pt.forEach(w => { if(qt.indexOf(w) > -1) hit++; else if(qt.some(x => wordLike(w, x))){ hit++; fuzzy++; } });
  const ratio = hit / pt.length, coverage = hit / Math.max(1, qt.length);
  const s = ratio === 1 ? Math.min(1.2, .7 + .5 * coverage) : ratio * .5 + coverage * .35;
  return fuzzy ? s * .92 : s;
}
function containsPart(query, part){
  const q = norm(query), p = norm(part);
  if(!p) return true;
  if((" " + q + " ").indexOf(" " + p + " ") > -1) return true;
  const qt = tokens(q);
  return tokens(p).every(w => qt.some(x => x === w || wordLike(w, x)));
}
function capRe(raw){
  const parts = raw.trim().replace(/[?!.]+$/, "").split(/\{x\}/i)
    .map(p => p.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  let src = parts[0] ? "(?:^|[\\s,;:!?„\"])" + parts[0] : "^";
  for(let i = 1; i < parts.length; i++) src += (i === 1 && !parts[0] ? "" : "\\s*") + "(.+?)" + (parts[i] ? "\\s*" + parts[i] : "");
  src += parts[parts.length - 1] ? "(?=$|[\\s,;:!?.])" : "$";
  return new RegExp(src, "i");
}
/* Liefert { s: Punktzahl, cap: übernommener Wert, hard: bewusst exakt formulierte Regel } */
function matchScore(query, pattern){
  const raw = String(pattern).trim();
  if(!raw) return { s:0 };
  if(raw.charAt(0) === "~"){
    try {
      const body = raw.slice(1), mm = body.match(/^\/(.*)\/([imsu]*)$/);
      const m = String(query).match(mm ? new RegExp(mm[1], mm[2]) : new RegExp(body, "i"));
      return m ? { s:1.4, cap: m[1] != null ? String(m[1]).trim() : "", hard:true } : { s:0 };
    } catch(e) { return { s:0 }; }
  }
  if(raw.charAt(0) === "=") return norm(query) === norm(raw.slice(1)) ? { s:1.6, hard:true } : { s:0 };
  if(/\{x\}/i.test(raw)){
    try {
      const m = String(query).trim().replace(/[?!.]+$/, "").match(capRe(raw));
      if(m){ const c = String(m[1] || "").replace(/^["„“'»«]+|["“”'»«]+$/g, "").trim(); if(c && c.length <= 80) return { s:1.45, cap:c, hard:true }; }
    } catch(e) {}
    return { s:0 };
  }
  if(raw.indexOf("&") > -1){
    const parts = raw.split("&").map(x => x.trim()).filter(Boolean);
    if(parts.length > 1) return { s: parts.every(p => containsPart(query, p)) ? 1.3 : 0 };
  }
  return { s: baseScore(query, raw) };
}
export function findRule(text){
  const nq = " " + norm(text) + " ", cands = [];
  cfg.pairs.forEach(p => {
    if(p.enabled === false || !variantsOf(p.response).length) return;
    if((p.exclude || []).some(ex => { const e = norm(ex); return e && nq.indexOf(" " + e + " ") > -1; })) return;
    let best = { s:0 }, pat = "";
    p.patterns.forEach(x => { const r = matchScore(text, x); if(r.s > best.s){ best = r; pat = x; } });
    if(best.s >= .62) cands.push({ rule:p, pattern:pat, cap:best.cap || "", score:best.s, hard:!!best.hard, prio:+p.priority || 0 });
  });
  cands.sort((a, b) => b.prio - a.prio || b.score - a.score);
  return cands[0] || null;
}

/* Platzhalter, die beim Antworten feststehen ({name} wird erst bei der Anzeige ersetzt) */
function fillDyn(t, capVal){
  const d = new Date();
  return String(t)
    .replace(/\{x\}/gi, capVal || "")
    .replace(/\{datum\}/gi, d.toLocaleDateString("de-DE", { day:"numeric", month:"long", year:"numeric" }))
    .replace(/\{uhrzeit\}/gi, d.toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit" }))
    .replace(/\{wochentag\}/gi, d.toLocaleDateString("de-DE", { weekday:"long" }));
}
function fallbackList(){ const f = variantsOf(cfg.fallback.join("|||")); return f.length ? f : DEFAULT_CONFIG.fallback; }

/* Ein Wort oder eine Zahl allein wird benannt, statt „mehr Infos“ zu verlangen. */
function metaReply(q){
  const s = String(q || "").replace(/[\s?!.]+$/, "").trim();
  if(/^\d+(?:[.,]\d+)?$/.test(s)) return "Das ist die Zahl " + s + ".";
  if(/^[\p{L}][\p{L}\p{M}'’\-]*$/u.test(s)) return "Das ist ein Wort.";
  return null;
}
function pickFrom(pool, avoid){ let c = pool.filter(v => v !== avoid); if(!c.length) c = pool; return rnd(c); }
function fromRule(hit, avoid){
  const pool = variantsOf(hit.rule.response), out = pickFrom(pool, avoid);
  statCount("rule", hit.rule.id);
  return { text: fillDyn(out, hit.cap), rule: hit.rule, pattern: hit.pattern, cap: hit.cap, index: pool.indexOf(out), total: pool.length, source:"rule" };
}

/* ---------------- Kontext & Folgeantworten ---------------- */
const FU_KINDS = [
  ["kuerzer",   "Kürzer",         "„kürzer“, „kurz gesagt“, „tl;dr“"],
  ["einfacher", "Einfacher",      "„einfacher bitte“, „versteh ich nicht“"],
  ["warum",     "Warum?",         "„warum?“, „wieso das?“"],
  ["beispiel",  "Beispiel",       "„ein Beispiel?“, „zeig mal“"],
  ["mehr",      "Mehr Details",   "„mehr dazu“, „erzähl mehr“, „genauer“"],
  ["nochmal",   "Noch einmal / anders", "„noch einen“, „nochmal“, „anders“"]
];
const FOLLOW = [
  ["kuerzer",   /^(?:(?:bitte|kannst du(?: das| es)?|geht'?s(?: auch)?)\s+)?(?:noch\s+)?(?:kürzer|kurz gesagt|kurzfassung|in kurz|tl;?dr|kurze version|fass(?:e)? (?:das |es )?(?:kurz )?zusammen)\b/i],
  ["einfacher", /\b(?:einfacher|verständlicher|leichter|wie für ein kind|für kinder|erklär(?:e)? (?:es|das) einfach|versteh(?:e)? (?:ich )?(?:das )?nicht)\b/i],
  ["warum",     /^(?:und\s+|aber\s+)?(?:warum|wieso|weshalb|wie kommt das|wieso das)\b/i],
  ["beispiel",  /\b(?:beispiel|beispiele|zeig mal|zum beispiel)\b/i],
  ["mehr",      /^(?:und\s+)?(?:mehr|erzähl(?:e)? (?:mir )?mehr|mehr (?:dazu|details|infos?|davon)|genauer|weiter|ausführlicher|details|erzähl weiter)\b/i],
  ["nochmal",   /^(?:noch (?:einen|einer|eins|eine|mal)|nochmal|noch ein(?:en|e)? (?:anderen?|weiteren?)|einen anderen|eine andere|anders)\b/i]
];
function lastAi(hist){
  for(let i = hist.length - 1; i >= 0; i--){
    const m = hist[i];
    if(m.role === "assistant") return { msg:m, raw: m.variants[m.vi] || "", meta: (m.meta && m.meta[m.vi]) || {} };
  }
  return null;
}
function followUp(text, avoid, prev){
  if(!prev) return null;
  const t = text.trim(), meta = prev.meta || {};
  /* Rechnen mit dem letzten Ergebnis: „und mal 2“, „davon 20 %“, „Wurzel daraus“ */
  if(typeof meta.val === "number" && Number.isFinite(meta.val)){
    const v = "(" + String(meta.val) + ")";
    let m = t.match(/^(?:und\s+)?(?:das\s+|dann\s+|ergebnis\s+)?(plus|minus|mal|geteilt durch|durch|hoch|[+\-*\/×÷^:])\s*(.+?)\s*[?!.]*$/i);
    if(m && /\d|pi\b/i.test(m[2])){
      const r = NovaMath.reply(v + " " + m[1] + " (" + m[2] + ")");
      if(r) return { text:r, source:"math", val: NovaMath.lastValue(), rule:null };
    }
    m = t.match(new RegExp("^(?:und\\s+)?(?:wie\\s*viel\\s+(?:sind|ist)\\s+)?(?:davon\\s+)?" + NUM + "\\s*(?:%|prozent)\\s*(?:davon)?\\s*[?!.]*$", "i"));
    if(m && /davon/i.test(t)){
      const val = meta.val * toNum(m[1]) / 100;
      return { text: "**" + fmtN(toNum(m[1])) + " % von " + fmtN(meta.val) + " = " + fmtN(val) + "**", source:"math", val, rule:null };
    }
    if(/^(?:und\s+)?(?:die\s+)?(?:quadrat)?wurzel\s+(?:daraus|davon)/i.test(t)){
      const r = NovaMath.reply("sqrt" + v); if(r) return { text:r, source:"math", val: NovaMath.lastValue(), rule:null };
    }
  }
  let kind = null;
  for(const [k, re] of FOLLOW) if(re.test(t)){ kind = k; break; }
  if(!kind) return null;
  /* echte Werkzeug-Anfragen („noch eine PIN“, „noch ein Passwort“) haben Vorrang */
  try { if(toolChain(t)) return null; } catch(e) {}
  const words = norm(t).split(" ").filter(Boolean);
  if(!(words.length <= 4 || /\b(?:das|es|dies|dazu|davon|darauf|daran|dem|der antwort)\b/i.test(t))) return null;
  /* nach einer Passwort/PIN-Antwort erzeugt „Nochmal!“ ein frisches Exemplar */
  if(kind === "nochmal" && meta.widget && meta.widget.type === "pw" && meta.widget.req){
    const w = passTool(meta.widget.req);
    if(w) return Object.assign({}, w, { rule:null, follow:kind });
  }
  const rule = meta.rule ? cfg.pairs.find(p => p.id === meta.rule && p.enabled !== false) : null;
  if(rule){
    const f = rule.followups && rule.followups[kind];
    if(f && variantsOf(f).length){
      const pool = variantsOf(f), out = pickFrom(pool, avoid);
      statCount("rule", rule.id);
      return { text: fillDyn(out, meta.cap), rule, cap: meta.cap, index: pool.indexOf(out), total: pool.length, source:"follow", follow:kind };
    }
    if(kind === "nochmal"){
      const pool = variantsOf(rule.response), others = pool.filter(v => v !== prev.raw && v !== avoid);
      if(others.length){ const out = rnd(others); return { text: fillDyn(out, meta.cap), rule, cap: meta.cap, index: pool.indexOf(out), total: pool.length, source:"follow", follow:kind }; }
    }
  }
  /* allgemein: „kürzer“/„einfacher“ kürzt die vorige Antwort wirklich */
  if(kind === "kuerzer" || kind === "einfacher"){
    const p = plain(withName(prev.raw));
    const sents = p.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [p];
    const s = sents.slice(0, 1).join(" ").trim();
    if(s && s.length < p.length - 10)
      return { text: (kind === "kuerzer" ? "Kurz gesagt: " : "Einfach gesagt: ") + s, rule: rule || null, cap: meta.cap, source:"follow", follow:kind };
  }
  const ff = variantsOf(cfg.followFallback);
  if(!ff.length) return null;
  return { text: pickFrom(ff, avoid), rule:null, source:"follow", follow:kind };
}

/* ---------------- Hilfe & Erinnerungen ---------------- */
const HELP = "Das kann ich – komplett offline. Befehle kannst du **mit oder ohne `/`** schreiben (das Menü beim Tippen von `/` fügt es ein).\n\n" +
  "- **Rechnen:** `23 × 17`, `20 % von 150`, `2x + 3 = 11` (mit Rechenweg) – danach z. B. „und mal 2“\n" +
  "- **Einheiten:** `5 km in Meilen`, `30 °C in Fahrenheit`, `2 GB in MB`\n" +
  "- **Währung:** „89 € in Dollar“, „100 Pfund in Euro“ (feste Offline-Kurse)\n" +
  "- **KW & Uhrzeit:** „Welche KW ist heute?“, „KW 42 im Jahr 2027“, „Wie spät ist es in Tokio?“, „14 Uhr MEZ in Tokio“\n" +
  "- **Countdowns:** „Countdown bis Weihnachten“, „Meine Countdowns“, „Countdown löschen: …“\n" +
  "- **Timer:** „Timer 5 Minuten“, „Wie viel Zeit ist noch?“, „Timer abbrechen“ – oben rechts mit Fortschritt und Pause\n" +
  "- **Passwörter:** „Sicheres Passwort“, „Passwort mit 24 Zeichen“, „6-stellige PIN“\n" +
  "- **Datum:** „Wie viele Tage bis Weihnachten?“, „Welcher Wochentag ist der 1.1.2030?“, „in 3 Wochen“\n" +
  "- **Alltag:** `1000 € mit 3 % Zinsen für 5 Jahre`, „3 Brötchen kosten 1,20 €, was kosten 7?“, `Fläche Kreis r = 3`\n" +
  "- **Text-Werkzeuge:** `Zähle Wörter: …`, `Sortiere: …`, `Entferne Duplikate: …`, `Formatiere JSON: …`\n" +
  "- **Wörterbuch:** „Was heißt Hund auf Englisch?“\n" +
    "- **QR-Codes:** „QR-Code für https://example.com“ oder „QR WLAN: Name=…; Passwort=…“\n" +
  "- **Diagramme:** „Diagramm: Äpfel 5, Birnen 8, Kirschen 3“ – auch `Tortendiagramm`/`Liniendiagramm`, mit PNG-Download\n" +
  "- **Checklisten:** „Checkliste Einkauf: Milch, Brot“ – im Widget abhaken, ergänzen, exportieren\n" +
  "- **Merken:** „Merke dir: …“, „Was weißt du über mich?“, „Ich heiße …“\n" +
  "- **Nachfragen:** „kürzer“, „einfacher“, „warum?“, „ein Beispiel?“, „mehr dazu“, „noch einen“";
function memoryTool(t){
  let m;
  if((m = t.match(/^(?:bitte\s+)?(?:merk(?:e)?\s+dir|notier(?:e)?(?:\s+dir)?|speicher(?:e)?)(?:\s+bitte)?\s*[:,]?\s+(?:dass\s+)?(.{2,300}?)\s*[.!]?$/i))){
    const fact = m[1].trim();
    if(/^countdown\s+(?:bis|fuer|für)\b/i.test(fact)) return null;    // → countdownTool
    return { text: "Alles klar, ich habe mir gemerkt: „" + fact + "“.", source:"mem", effect: () => { if(cfg.memory.indexOf(fact) < 0) cfg.memory.push(fact); saveCfg(); } };
  }
  if(/^(?:was\s+(?:hast\s+du\s+dir\s+gemerkt|weißt\s+du\s+(?:über|von)\s+(?:mir|mich))|zeig(?:e)?\s+(?:mir\s+)?(?:meine\s+)?erinnerungen|meine\s+erinnerungen|erinnerungen)\s*\??$/i.test(t)){
    const list = cfg.memory.slice();
    if(cfg.userName) list.unshift("Du heißt {name}.");
    return { text: list.length ? "Das habe ich mir gemerkt:\n\n" + list.map(x => "- " + x).join("\n") : "Ich habe mir noch nichts gemerkt. Sag einfach „Merke dir: …“.", source:"mem" };
  }
  if(/^vergiss\s+(?:alles|alle\s+erinnerungen)\s*[.!]?$/i.test(t))
    return { text: "Erledigt – ich habe alle Erinnerungen gelöscht.", source:"mem", effect: () => { cfg.memory = []; saveCfg(); } };
  if((m = t.match(/^vergiss\s*[:,]?\s+(?:dass\s+)?(.{2,200}?)\s*[.!]?$/i))){
    if(/^(?:den\s+)?countdown\b/i.test(m[1])) return null;           // → countdownTool
    if(/^(?:(?:den|die|meine)\s+)?(?:checkliste?|liste?)\b/i.test(m[1])) return null;   // → listTool
    const q = norm(m[1]), hits = cfg.memory.filter(x => norm(x).indexOf(q) > -1 || q.indexOf(norm(x)) > -1);
    if(!hits.length) return { text: "Dazu habe ich mir nichts gemerkt.", source:"mem" };
    return { text: "Okay, vergessen: " + hits.map(x => "„" + x + "“").join(", ") + ".", source:"mem", effect: () => { cfg.memory = cfg.memory.filter(x => hits.indexOf(x) < 0); saveCfg(); } };
  }
  if((m = t.match(/^(?:ich\s+heiße|ich\s+heisse|mein\s+name\s+ist|nenn(?:e)?\s+mich|du\s+kannst\s+mich\s+(\S+)\s+nennen)\s*([A-Za-zÄÖÜäöüßÀ-ÿ][A-Za-zÄÖÜäöüßÀ-ÿ'-]{0,24}(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüßÀ-ÿ'-]{0,24})?)?\s*[.!]?$/i))){
    const nm = (m[1] || m[2] || "").trim();
    if(nm && !/^(?:nicht|kein|keine|so|auch)$/i.test(nm)){
      const name = cap1(nm);
      return { text: "Freut mich, " + name + "! 😊 Ich merke mir deinen Namen.", source:"mem", effect: () => { cfg.userName = name; saveCfg(); if(typeof applyNames === "function") applyNames(); } };
    }
  }
  if(/^(?:wie\s+heiße\s+ich|wie\s+heisse\s+ich|weißt\s+du\s+(?:wie\s+ich\s+heiße|meinen\s+namen)|kennst\s+du\s+meinen\s+namen)\s*\??$/i.test(t))
    return { text: cfg.userName ? "Du heißt **{name}**." : "Das weiß ich noch nicht – sag einfach „Ich heiße …“.", source:"mem" };
  return null;
}

/* ---------------- Text-Werkzeuge ---------------- */
function listItems(s){
  s = s.trim();
  return (s.indexOf("\n") > -1 ? s.split(/\r?\n/) : s.split(/\s*[,;|]\s*/)).map(x => x.trim().replace(/^[-*•]\s+/, "")).filter(Boolean);
}
const fence = (s, lang) => "```" + (lang || "text") + "\n" + s.replace(/```/g, "ˋˋˋ") + "\n```";
function textTool(t){
  const m = t.match(/^(zähl(?:e)?(?:\s+die)?\s+(?:wörter|zeichen)|wörter\s+zählen|zeichen\s+zählen|textstatistik|sortier(?:e)?(?:\s+(?:absteigend|rückwärts|aufsteigend|alphabetisch|nach\s+zahlen))?|entfern(?:e)?\s+(?:doppelte(?:\s+einträge)?|duplikate)|duplikate\s+entfernen|(?:in\s+)?großbuchstaben|(?:in\s+)?kleinbuchstaben|umkehren|kehre\s+um|rückwärts|formatier(?:e)?\s+json|json\s+formatieren|prüf(?:e)?\s+json|json\s+prüfen|zufällig\s+mischen|mische)\s*(?::|\r?\n)\s*([\s\S]+)$/i);
  if(!m) return null;
  const cmd = m[1].toLowerCase(), s = m[2];
  if(/zähl|zählen|statistik/.test(cmd)){
    const words = (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
    const chars = Array.from(s).length, noSpace = Array.from(s.replace(/\s/g, "")).length;
    const sentences = (s.match(/[^.!?]+[.!?]+/g) || []).length || (s.trim() ? 1 : 0);
    const lines = s.split(/\r?\n/).length;
    return { text: "| | Anzahl |\n|---|---|\n| Wörter | **" + fmtN(words) + "** |\n| Zeichen | " + fmtN(chars) + " |\n| Zeichen ohne Leerzeichen | " + fmtN(noSpace) + " |\n| Sätze | " + fmtN(sentences) + " |\n| Zeilen | " + fmtN(lines) + " |\n\nLesezeit: ca. " + Math.max(1, Math.round(words / 200)) + " Min.", source:"tool" };
  }
  if(/sortier/.test(cmd)){
    const items = listItems(s), desc = /absteigend|rückwärts/.test(cmd);
    items.sort((a, b) => a.localeCompare(b, "de", { numeric:true, sensitivity:"base" }) * (desc ? -1 : 1));
    return { text: "Sortiert (" + (desc ? "absteigend" : "aufsteigend") + ", " + items.length + " Einträge):\n\n" + items.map(x => "- " + x).join("\n"), source:"tool" };
  }
  if(/mische/.test(cmd)){
    const items = listItems(s);
    for(let i = items.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return { text: "Zufällig gemischt:\n\n" + items.map((x, i) => (i + 1) + ". " + x).join("\n"), source:"tool" };
  }
  if(/doppelt|duplikat/.test(cmd)){
    const items = listItems(s), seen = new Set(), out = [];
    items.forEach(x => { const k = x.toLowerCase(); if(!seen.has(k)){ seen.add(k); out.push(x); } });
    return { text: (items.length - out.length) + " Duplikat" + (items.length - out.length === 1 ? "" : "e") + " entfernt – " + out.length + (out.length === 1 ? " Eintrag bleibt" : " Einträge bleiben") + ":\n\n" + out.map(x => "- " + x).join("\n"), source:"tool" };
  }
  if(/groß/.test(cmd)) return { text: fence(s.toLocaleUpperCase("de-DE")), source:"tool" };
  if(/klein/.test(cmd)) return { text: fence(s.toLocaleLowerCase("de-DE")), source:"tool" };
  if(/umkehren|kehre|rückwärts/.test(cmd)) return { text: fence(Array.from(s).reverse().join("")), source:"tool" };
  if(/json/.test(cmd)){
    try { const o = JSON.parse(s); return { text: (/prüf/.test(cmd) ? "✅ Das JSON ist gültig.\n\n" : "") + fence(JSON.stringify(o, null, 2), "json"), source:"tool" }; }
    catch(e) { return { text: "❌ Das ist kein gültiges JSON:\n\n`" + String(e.message).replace(/`/g, "'") + "`\n\nHäufige Ursachen: fehlende Anführungszeichen um Schlüssel, ein Komma nach dem letzten Eintrag oder einfache statt doppelter Anführungszeichen.", source:"tool" }; }
  }
  return null;
}

/* ---------------- Wörterbuch (Deutsch ↔ Englisch) ---------------- */
const DICT_SRC = "hallo:hello|tschüss:bye|danke:thank you|danke schön:thank you very much|bitte:please|ja:yes|nein:no|vielleicht:maybe|guten morgen:good morning|guten tag:good afternoon|guten abend:good evening|gute nacht:good night|wie geht es dir:how are you|mir geht es gut:i am fine|ich liebe dich:i love you|entschuldigung:sorry / excuse me|wie heißt du:what is your name|ich heiße:my name is|wo ist die toilette:where is the toilet|ich verstehe nicht:i don't understand|ich weiß nicht:i don't know|sprechen sie englisch:do you speak english|was kostet das:how much is this|herzlichen glückwunsch:congratulations|alles gute zum geburtstag:happy birthday|frohe weihnachten:merry christmas|frohes neues jahr:happy new year|bis später:see you later|bis morgen:see you tomorrow|viel glück:good luck|keine ahnung:no idea|willkommen:welcome|guten appetit:enjoy your meal|prost:cheers|" +
  "hund:dog|katze:cat|pferd:horse|vogel:bird|maus:mouse|haus:house|wohnung:apartment|auto:car|fahrrad:bike|zug:train|flugzeug:plane|baum:tree|blume:flower|wasser:water|brot:bread|apfel:apple|banane:banana|buch:book|schule:school|universität:university|freund:friend|familie:family|mutter:mother|vater:father|eltern:parents|bruder:brother|schwester:sister|kind:child|kinder:children|baby:baby|mann:man|frau:woman|junge:boy|mädchen:girl|mensch:human|leute:people|" +
  "tag:day|nacht:night|woche:week|monat:month|jahr:year|stunde:hour|minute:minute|heute:today|morgen:tomorrow|gestern:yesterday|jetzt:now|später:later|immer:always|nie:never|zeit:time|stadt:city|dorf:village|land:country|welt:world|sonne:sun|mond:moon|stern:star|himmel:sky|meer:sea|strand:beach|berg:mountain|fluss:river|see:lake|wald:forest|regen:rain|schnee:snow|wind:wind|wetter:weather|" +
  "essen:to eat / food|trinken:to drink|schlafen:to sleep|gehen:to go|kommen:to come|sehen:to see|hören:to hear|sprechen:to speak|sagen:to say|lesen:to read|schreiben:to write|lernen:to learn|arbeiten:to work|spielen:to play|laufen:to run|kaufen:to buy|verkaufen:to sell|machen:to make / to do|haben:to have|sein:to be|wissen:to know|denken:to think|verstehen:to understand|helfen:to help|lieben:to love|mögen:to like|brauchen:to need|wollen:to want|kochen:to cook|fahren:to drive|fliegen:to fly|schwimmen:to swim|singen:to sing|tanzen:to dance|öffnen:to open|schließen:to close|warten:to wait|suchen:to search|finden:to find|geben:to give|nehmen:to take|" +
  "groß:big|klein:small|gut:good|schlecht:bad|schön:beautiful|hässlich:ugly|neu:new|alt:old|jung:young|schnell:fast|langsam:slow|heiß:hot|kalt:cold|warm:warm|glücklich:happy|traurig:sad|müde:tired|hungrig:hungry|einfach:easy|schwer:difficult / heavy|richtig:right|falsch:wrong|teuer:expensive|billig:cheap|lecker:delicious|wichtig:important|interessant:interesting|lustig:funny|" +
  "rot:red|blau:blue|grün:green|gelb:yellow|schwarz:black|weiß:white|grau:grey|braun:brown|orange:orange|lila:purple|rosa:pink|" +
  "null:zero|eins:one|zwei:two|drei:three|vier:four|fünf:five|sechs:six|sieben:seven|acht:eight|neun:nine|zehn:ten|zwanzig:twenty|hundert:hundred|tausend:thousand|million:million|" +
  "ich:i|du:you|er:he|sie:she / they|es:it|wir:we|und:and|oder:or|aber:but|mit:with|ohne:without|für:for|weil:because|wenn:if / when|hier:here|dort:there|sehr:very|viel:much / a lot|wenig:little|alles:everything|nichts:nothing|" +
  "computer:computer|handy:mobile phone|telefon:phone|tisch:table|stuhl:chair|fenster:window|tür:door|zimmer:room|küche:kitchen|bad:bathroom|bett:bed|geld:money|arbeit:work|frage:question|antwort:answer|sprache:language|wort:word|satz:sentence|name:name|liebe:love|glück:luck / happiness|hilfe:help|frühstück:breakfast|mittagessen:lunch|abendessen:dinner|kaffee:coffee|tee:tea|milch:milk|käse:cheese|fleisch:meat|fisch:fish|gemüse:vegetables|obst:fruit|zucker:sugar|salz:salt|ei:egg|kuchen:cake|bier:beer|wein:wine|schönheit:beauty|freude:joy|sorge:worry|kraft:strength|freiheit:freedom|wahrheit:truth|traum:dream|angst:fear|mut:courage|leben:life|tod:death|wissen:knowledge|erfolg:success|fehler:mistake|aufgabe:task|lösung:solution|erklärung:explanation|beispiel:example|antwort:answer|" +
  "montag:monday|dienstag:tuesday|mittwoch:wednesday|donnerstag:thursday|freitag:friday|samstag:saturday|sonntag:sunday|januar:january|februar:february|märz:march|april:april|mai:may|juni:june|juli:july|august:august|september:september|oktober:october|november:november|dezember:december|frühling:spring|sommer:summer|herbst:autumn|winter:winter";
let DICT = null;
function dicts(){
  const key = cfg.dictionary || "";
  if(DICT && DICT.key === key) return DICT;
  const de2en = new Map(), en2de = new Map();
  const put = (de, en, custom) => {
    de = de.trim().toLowerCase(); en = en.trim(); if(!de || !en) return;
    if(custom || !de2en.has(de)) de2en.set(de, en);
    en.split("/").map(x => x.trim().toLowerCase()).forEach(e => {
      [e, e.replace(/^to\s+/, "")].forEach(k => { if(k && (custom || !en2de.has(k))) en2de.set(k, de); });
    });
  };
  String(key).split(/\r?\n/).forEach(l => { const mm = l.match(/^\s*(.+?)\s*(?:=|:|→|->)\s*(.+?)\s*$/); if(mm) put(mm[1], mm[2], true); });
  DICT_SRC.split("|").forEach(e => { const i = e.indexOf(":"); put(e.slice(0, i), e.slice(i + 1), false); });
  return (DICT = { key, de2en, en2de });
}
function translate(phrase, toEn){
  const d = dicts(), map = toEn ? d.de2en : d.en2de;
  const k = phrase.toLowerCase().trim().replace(/^[„"'»«]+|[“"'»«?!.,]+$/g, "").replace(/\s+/g, " ");
  if(!k) return null;
  if(map.has(k)) return { exact:true, out: map.get(k), key:k };
  const ws = k.split(" ");
  if(ws.length > 1 && ws.length <= 8){
    const skip = toEn ? /^(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer)$/ : /^(?:the|a|an)$/;
    const parts = ws.filter(w => !skip.test(w));
    if(parts.length && parts.every(w => map.has(w))) return { exact:false, out: parts.map(w => map.get(w).split(" / ")[0]).join(" "), key:k };
  }
  return { none:true, key:k };
}
function dictTool(t){
  let m, phrase = null, dir = null, strict = true;
  if((m = t.match(/^(?:was\s+(?:heißt|heisst|bedeutet)|wie\s+(?:sagt\s+man|heißt|heisst))\s+(.+?)\s+(?:auf|in)\s+(englisch|deutsch)\s*\??$/i))){ phrase = m[1]; dir = m[2]; }
  else if((m = t.match(/^(?:übersetz(?:e)?|übersetzung(?:\s+von)?)\s*:?\s+(.+?)\s+(?:ins|auf|in)\s+(?:das\s+)?(englische?|deutsche?)\s*[.!]?$/i))){ phrase = m[1]; dir = m[2]; }
  else if((m = t.match(/^translate\s+(.+?)\s+(?:to|into)\s+(english|german)\s*[.!]?$/i))){ phrase = m[1]; dir = m[2]; }
  else if((m = t.match(/^[„"']?([\p{L}' -]{1,40}?)[“"']?\s+auf\s+(englisch|deutsch)\s*\??$/iu))){ phrase = m[1]; dir = m[2]; strict = false; }
  else if((m = t.match(/^übersetz(?:e)?\s*:?\s+(.{1,80})$/i))){ phrase = m[1]; dir = "auto"; }
  if(!phrase) return null;
  const quoted = "„" + phrase.trim().replace(/^[„"']+|[“"']+$/g, "") + "“";
  let toEn = /^(?:englisch|english)/i.test(dir), r;
  if(dir === "auto"){ r = translate(phrase, true); if(r.none){ const r2 = translate(phrase, false); if(!r2.none){ r = r2; toEn = false; } } }
  else r = translate(phrase, toEn);
  if(r.none){
    if(!strict) return null;
    return { text: "Für " + quoted + " habe ich offline keine Übersetzung gespeichert. Ich kenne nur einzelne häufige Wörter und Sätze – freie Sätze kann ich ohne Internet nicht zuverlässig übersetzen.", source:"dict" };
  }
  const lang = toEn ? "Englisch" : "Deutsch";
  if(r.exact) return { text: quoted + " heißt auf " + lang + ": **" + r.out + "**", source:"dict" };
  return { text: "Wort für Wort auf " + lang + ": **" + r.out + "**\n\n_Hinweis: Das ist eine Wort-für-Wort-Übertragung ohne Grammatik – der Satz kann im " + lang + "en anders lauten._", source:"dict" };
}

/* ---------------- Einheiten ---------------- */
const UNITS = (() => {
  const U = {};
  const add = (dim, f, names) => names.split("|").forEach(n => { U[n] = { dim, f }; });
  add("Länge",1e-3,"mm|millimeter"); add("Länge",1e-2,"cm|zentimeter"); add("Länge",.1,"dm|dezimeter"); add("Länge",1,"m|meter");
  add("Länge",1e3,"km|kilometer"); add("Länge",.0254,"in|zoll|inch|inches"); add("Länge",.3048,"ft|fuß|fuss|feet|foot");
  add("Länge",.9144,"yd|yard|yards"); add("Länge",1609.344,"mi|meile|meilen|mile|miles"); add("Länge",1852,"sm|seemeile|seemeilen");
  add("Gewicht",1e-3,"mg|milligramm"); add("Gewicht",1,"g|gramm"); add("Gewicht",1e3,"kg|kilo|kilogramm"); add("Gewicht",1e6,"t|tonne|tonnen");
  add("Gewicht",453.59237,"lb|lbs|pound|pounds"); add("Gewicht",28.349523125,"oz|unze|unzen"); add("Gewicht",500,"pfund"); add("Gewicht",5e4,"zentner");
  add("Volumen",1e-3,"ml|milliliter"); add("Volumen",1e-2,"cl|zentiliter"); add("Volumen",.1,"dl|deziliter"); add("Volumen",1,"l|liter");
  add("Volumen",100,"hl|hektoliter"); add("Volumen",1e3,"m³|m3|kubikmeter"); add("Volumen",1e-3,"cm³|cm3|kubikzentimeter|ccm");
  add("Volumen",3.785411784,"gal|gallone|gallonen|gallon|gallons"); add("Volumen",.005,"tl|teelöffel"); add("Volumen",.015,"el|esslöffel"); add("Volumen",.25,"tasse|tassen");
  add("Zeit",1e-3,"ms|millisekunde|millisekunden"); add("Zeit",1,"s|sek|sekunde|sekunden"); add("Zeit",60,"min|minute|minuten");
  add("Zeit",3600,"h|std|stunde|stunden"); add("Zeit",86400,"d|tag|tage|tagen"); add("Zeit",604800,"woche|wochen");
  add("Zeit",2629800,"monat|monate|monaten"); add("Zeit",31557600,"jahr|jahre|jahren");
  add("Geschwindigkeit",1,"m/s"); add("Geschwindigkeit",1/3.6,"km/h|kmh|km/std|stundenkilometer"); add("Geschwindigkeit",.44704,"mph"); add("Geschwindigkeit",1852/3600,"kn|knoten");
  add("Daten",.125,"bit|bits"); add("Daten",1,"b|byte|bytes"); add("Daten",1e3,"kb|kilobyte"); add("Daten",1e6,"mb|megabyte"); add("Daten",1e9,"gb|gigabyte");
  add("Daten",1e12,"tb|terabyte"); add("Daten",1024,"kib"); add("Daten",1048576,"mib"); add("Daten",1073741824,"gib"); add("Daten",1099511627776,"tib");
  add("Fläche",1e-6,"mm²|mm2|quadratmillimeter"); add("Fläche",1e-4,"cm²|cm2|quadratzentimeter"); add("Fläche",1,"m²|m2|qm|quadratmeter");
  add("Fläche",1e6,"km²|km2|quadratkilometer"); add("Fläche",1e4,"ha|hektar"); add("Fläche",100,"ar");
  add("Energie",1,"j|joule"); add("Energie",1e3,"kj|kilojoule"); add("Energie",4184,"kcal|kilokalorien"); add("Energie",4.184,"cal|kalorien"); add("Energie",3.6e6,"kwh");
  ["c","°c","grad","grad celsius","celsius"].forEach(n => U[n] = { dim:"Temperatur", t:"C" });
  ["f","°f","fahrenheit","grad fahrenheit"].forEach(n => U[n] = { dim:"Temperatur", t:"F" });
  ["k","kelvin"].forEach(n => U[n] = { dim:"Temperatur", t:"K" });
  return U;
})();
const unitOf = s => UNITS[String(s).toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").trim()] || null;

/* ---------------- Währungen (feste Offline-Kurse) ---------------- */
const CUR_STAND = "5. Oktober 2026";
const CURS = (() => {
  const R = { EUR:1, USD:1.1253, GBP:0.85, CHF:0.9335, JPY:177.62, CAD:1.52, AUD:1.69, SEK:11.2, NOK:11.8, DKK:7.46, PLN:4.25, CNY:8.05 };
  const SYM = { EUR:"€", USD:"$", GBP:"£", CHF:"CHF", JPY:"¥", CAD:"C$", AUD:"A$", SEK:"SEK", NOK:"NOK", DKK:"DKK", PLN:"PLN", CNY:"CN¥" };
  const NAMES = {
    "euro|euros|eur|€":"EUR",
    "dollar|dollars|usd|us-dollar|usdollar|$":"USD",
    "pfund|pounds?|pound|gbp|pfund sterling|britische pfund|britisches pfund|£":"GBP",
    "schweizer franken|schweizerfranken|chf|franken":"CHF",
    "yen|jpy":"JPY",
    "kanadische dollar|kanadischer dollar|cad":"CAD",
    "australische dollar|australischer dollar|aud":"AUD",
    "schwedische kronen|schwedische krone|sek":"SEK",
    "norwegische kronen|norwegische krone|nok":"NOK",
    "dänische kronen|daenische kronen|dänische krone|dkk":"DKK",
    "polnische zloty|zloty|pln":"PLN",
    "chinesische yuan|yuan|renminbi|cny":"CNY"
  };
  const M = {};
  Object.keys(NAMES).forEach(k => k.split("|").forEach(n => M[n] = NAMES[k]));
  return { R, SYM, M };
})();
const curOf = s => {
  const k = String(s).toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "").trim();
  const code = CURS.M[k];
  return code ? { code, rate: CURS.R[code], sym: CURS.SYM[code] } : null;
};
/* „pfund“ ist doppelt besetzt: nur als Währung lesen, wenn die Gegenseite eine ist */
const ambigCur = s => /^(pfund|pound|pounds|britische pfund|britisches pfund|£)$/i.test(String(s).trim())
  ? { code:"GBP", rate:CURS.R.GBP, sym:CURS.SYM.GBP } : null;
function unitTool(t){
  let m = t.match(new RegExp("^(?:rechne\\s+|wandle\\s+|konvertiere\\s+|wie\\s*viel(?:e)?\\s+sind\\s+)?" + NUM + "\\s*([^\\d\\s=][^\\d=]*?)\\s+(?:in|nach|zu|to|als|=|→|->)\\s+([^\\d]+?)(?:\\s+um(?:rechnen)?)?\\s*[?.!]?$", "i"));
  let v, a, b;
  if(m){ v = toNum(m[1]); a = m[2]; b = m[3]; }
  else if((m = t.match(new RegExp("^wie\\s*viel(?:e)?\\s+([^\\d]+?)\\s+(?:sind|ist|hat|haben|entsprechen|entspricht)\\s+" + NUM + "\\s*([^\\d]+?)\\s*[?.!]?$", "i")))){ v = toNum(m[2]); a = m[3]; b = m[1]; }
  else return null;
  /* Währungen zuerst (Festkurse, offline) */
  const w1 = curOf(a) || ambigCur(a), w2 = curOf(b) || ambigCur(b);
  if(w1 && w2){
    const r = v * w2.rate / w1.rate;   // R = Einheiten pro 1 € → v·(R_ziel/R_quelle)
    return { text: "**" + fmtN(v) + " " + w1.sym + " = " + fmtN(r, 2) + " " + w2.sym + "**\n\n_(Feste Offline-Kurse, Stand " + CUR_STAND + " – ohne Gebühren/Kursaufschläge deiner Bank.)_", source:"unit", val:r };
  }
  /* „pfund“ kann Gewicht sein – nur echte Eindeutige Währungen blockieren die Einheiten-Umrechnung */
  const dual1 = ambigCur(a) && unitOf(a), dual2 = ambigCur(b) && unitOf(b);
  if((w1 && !dual1) || (w2 && !dual2))
    return { text: "Eine Währung lässt sich nur in eine andere Währung umrechnen (z. B. „89 € in Dollar“), nicht in eine Länge oder ein Gewicht.", source:"unit" };
  const ua = unitOf(a), ub = unitOf(b);
  if(!ua || !ub) return null;
  if(ua.dim !== ub.dim) return { text: "„" + a.trim() + "“ (" + ua.dim + ") und „" + b.trim() + "“ (" + ub.dim + ") lassen sich nicht ineinander umrechnen.", source:"unit" };
  let r;
  if(ua.dim === "Temperatur"){
    const K = ua.t === "C" ? v + 273.15 : ua.t === "F" ? (v - 32) * 5 / 9 + 273.15 : v;
    if(K < 0) return { text: "Unter dem absoluten Nullpunkt (0 K = −273,15 °C) gibt es keine Temperaturen.", source:"unit" };
    r = ub.t === "C" ? K - 273.15 : ub.t === "F" ? (K - 273.15) * 9 / 5 + 32 : K;
  } else r = v * ua.f / ub.f;
  const sym = (u, raw) => u.dim === "Temperatur" ? ({ C:"°C", F:"°F", K:"K" })[u.t] : raw.trim();
  let note = "";
  if(/^(monat|monate|monaten|jahr|jahre|jahren)$/i.test(a.trim()) || /^(monat|monate|monaten|jahr|jahre|jahren)$/i.test(b.trim())) note = "\n\n_Mit Durchschnittswerten gerechnet (1 Jahr = 365,25 Tage, 1 Monat = 1/12 Jahr)._";
  if(/^pfund$/i.test(a.trim()) || /^pfund$/i.test(b.trim())) note = "\n\n_1 Pfund = 500 g (deutsches Pfund). Für das englische Pfund verwende „lb“._";
  if(/^(gal|gallone|gallonen|gallon|gallons)$/i.test(a.trim() + "") || /^(gal|gallone|gallonen|gallon|gallons)$/i.test(b.trim())) note = "\n\n_US-Gallone (3,785 l)._";
  if(/^(tasse|tassen|tl|el|teelöffel|esslöffel)$/i.test(a.trim()) || /^(tasse|tassen|tl|el|teelöffel|esslöffel)$/i.test(b.trim())) note = "\n\n_Küchenmaße: 1 Tasse = 250 ml, 1 EL = 15 ml, 1 TL = 5 ml._";
  return { text: "**" + fmtN(v) + " " + sym(ua, a) + " = " + fmtN(r, 4) + " " + sym(ub, b) + "**" + note, source:"unit", val:r };
}

/* ---------------- Datum & Uhrzeit ---------------- */
const MONTHS = ["januar","februar","märz","april","mai","juni","juli","august","september","oktober","november","dezember"];
const MSHORT = { jan:1, feb:2, mär:3, mrz:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, okt:10, nov:11, dez:12 };
const WD = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const DAY = 864e5;
function todayUTC(){ const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
const FEST = { "weihnachten":[12,24], "heiligabend":[12,24], "silvester":[12,31], "neujahr":[1,1], "halloween":[10,31], "valentinstag":[2,14], "tag der deutschen einheit":[10,3], "nikolaus":[12,6] };
function parseDay(s){
  s = String(s).toLowerCase().trim().replace(/[?.!]+$/, "").replace(/^(?:dem|den|der|am|zum|zur|bis)\s+/, "").trim();
  const rel = { "heute":0, "morgen":1, "übermorgen":2, "gestern":-1, "vorgestern":-2 };
  if(s in rel) return { ts: todayUTC() + rel[s] * DAY, label:s };
  if(s in FEST) return { m:FEST[s][0], d:FEST[s][1], label: cap1(s) };
  let m, y = null, mo, d;
  if((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){ y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if((m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{2}|\d{4})?$/))){ d = +m[1]; mo = +m[2]; if(m[3]) y = +m[3]; }
  else if((m = s.match(/^(\d{1,2})\.?\s*([a-zä]+)\.?\s*(\d{4})?$/))){
    d = +m[1]; const name = m[2]; mo = MONTHS.indexOf(name) + 1 || MSHORT[name] || 0; if(m[3]) y = +m[3];
  } else return null;
  if(y != null && y < 100) y += y < 70 ? 2000 : 1900;
  if(!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  if(y != null){ const ts = Date.UTC(y, mo - 1, d), dt = new Date(ts); if(dt.getUTCDate() !== d) return null; return { ts, y, m:mo, d }; }
  return { m:mo, d };
}
function resolveDay(p, future){
  if(p.ts != null) return p.ts;
  const y = new Date().getFullYear();
  let ts = Date.UTC(y, p.m - 1, p.d);
  if(new Date(ts).getUTCDate() !== p.d) ts = Date.UTC(y + 1, p.m - 1, p.d);   // 29.2.
  if(future && ts < todayUTC()) ts = Date.UTC(y + 1, p.m - 1, p.d);
  return ts;
}
function fmtDay(ts){ const d = new Date(ts); return WD[d.getUTCDay()] + ", " + d.getUTCDate() + ". " + cap1(MONTHS[d.getUTCMonth()]) + " " + d.getUTCFullYear(); }
function addPeriod(ts, n, unit){
  if(/^tag/.test(unit)) return ts + n * DAY;
  if(/^woche/.test(unit)) return ts + n * 7 * DAY;
  const d = new Date(ts), months = /^monat/.test(unit) ? n : n * 12;
  const y = d.getUTCFullYear(), mo = d.getUTCMonth() + months, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return Date.UTC(y, mo, Math.min(day, last));
}
const plur = (n, one, many) => fmtN(n) + " " + (Math.abs(n) === 1 ? one : many);
function dateTool(t){
  let m;
  const s = t.trim().replace(/\s+/g, " ");
  if(/^(?:wie\s+spät\s+ist\s+es|wie\s*viel\s+uhr\s+ist\s+es|uhrzeit|wie\s+spät)\s*\??$/i.test(s)){
    const d = new Date();
    return { text: "Es ist **" + d.toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit" }) + " Uhr** (Uhrzeit deines Geräts).", source:"date" };
  }
  if(/^(?:welches\s+datum\s+(?:ist\s+heute|haben\s+wir(?:\s+heute)?)|was\s+ist\s+heute\s+für\s+ein\s+(?:datum|tag)|der\s+wievielte\s+ist\s+heute|datum\s+heute|heutiges\s+datum)\s*\??$/i.test(s))
    return { text: "Heute ist **" + fmtDay(todayUTC()) + "**.", source:"date" };
  if((m = s.match(/^(?:welcher|was\s+für\s+ein)\s+(?:wochen)?tag\s+(?:ist|war|wird|fällt\s+auf)\s+(?:es\s+)?(?:am\s+)?(.+?)(?:\s+sein)?\s*\??$/i)) ||
     (m = s.match(/^an\s+welchem\s+(?:wochen)?tag\s+(?:ist|war|liegt|fällt)\s+(.+?)\s*\??$/i))){
    const p = parseDay(m[1]); if(!p) return null;
    const ts = resolveDay(p, true), diff = Math.round((ts - todayUTC()) / DAY);
    const when = diff === 0 ? "Heute ist" : diff < 0 ? "Das war ein" : "Das ist ein";
    return { text: when + " **" + WD[new Date(ts).getUTCDay()] + "** – " + fmtDay(ts) + ".", source:"date" };
  }
  if((m = s.match(/^(?:wie\s*viele|wieviele)\s+tage\s+(?:sind\s+es\s+|hat\s+es\s+)?(?:noch\s+)?bis\s+(?:zum\s+|zur\s+|zu\s+|an\s+)?(.+?)\s*\??$/i)) ||
     (m = s.match(/^wie\s+lange\s+(?:ist\s+es\s+)?(?:noch\s+)?bis\s+(?:zum\s+|zur\s+)?(.+?)\s*\??$/i))){
    const p = parseDay(m[1]); if(!p) return null;
    const ts = resolveDay(p, true), diff = Math.round((ts - todayUTC()) / DAY);
    const name = p.label && !/^\d/.test(p.label) ? "**" + p.label + "** (" + fmtDay(ts) + ")" : "**" + fmtDay(ts) + "**";
    if(diff === 0) return { text: name.replace(/^\*\*/, "**") + " ist heute! 🎉", source:"date" };
    if(diff < 0) return { text: name + " war vor **" + plur(-diff, "Tag", "Tagen") + "**.", source:"date" };
    return { text: "Bis " + name + " sind es noch **" + plur(diff, "Tag", "Tage") + "**" + (diff >= 14 ? " (etwa " + fmtN(Math.round(diff / 7 * 10) / 10) + " Wochen)" : "") + ".", source:"date" };
  }
  if((m = s.match(/^(?:wie\s*viele\s+)?tage\s+(?:liegen\s+)?zwischen\s+(?:dem\s+)?(.+?)\s+und\s+(?:dem\s+)?(.+?)\s*\??$/i))){
    const a = parseDay(m[1]), b = parseDay(m[2]); if(!a || !b) return null;
    const ta = resolveDay(a, false), tb = resolveDay(b, false), diff = Math.round(Math.abs(tb - ta) / DAY);
    return { text: "Zwischen " + fmtDay(ta) + " und " + fmtDay(tb) + " liegen **" + plur(diff, "Tag", "Tage") + "**" + (diff >= 14 ? " (" + fmtN(Math.floor(diff / 7)) + " Wochen und " + plur(diff % 7, "Tag", "Tage") + ")" : "") + ".", source:"date", val:diff };
  }
  if((m = s.match(/^(?:welches\s+datum\s+(?:ist|war)\s+|was\s+ist\s+(?:das\s+datum\s+)?|datum\s+)?(?:heute\s+)?(in|vor)\s+(\d{1,5})\s+(tag|tagen|woche|wochen|monat|monaten|jahr|jahren)\s*\??$/i))){
    const n = +m[2] * (m[1].toLowerCase() === "vor" ? -1 : 1), ts = addPeriod(todayUTC(), n, m[3].toLowerCase());
    return { text: (m[1].toLowerCase() === "vor" ? "Vor " : "In ") + m[2] + " " + m[3] + (m[1].toLowerCase() === "vor" ? " war" : " ist") + " **" + fmtDay(ts) + "**.", source:"date" };
  }
  if((m = s.match(/^(.+?)\s*([+-])\s*(\d{1,5})\s*(tage?n?|wochen?|monate?n?|jahre?n?)\s*\??$/i))){
    const p = parseDay(m[1]); if(!p) return null;
    const base = resolveDay(p, false), n = +m[3] * (m[2] === "-" ? -1 : 1);
    return { text: fmtDay(base) + " " + m[2] + " " + m[3] + " " + m[4] + " = **" + fmtDay(addPeriod(base, n, m[4].toLowerCase())) + "**", source:"date" };
  }
  if((m = s.match(/^(?:wie\s+alt\s+bin\s+ich|wie\s+alt\s+ist\s+(?:man|jemand))\s*,?\s+(?:wenn\s+ich\s+|der\s+|die\s+)?(?:am\s+)?(.+?)\s+geboren\s+(?:bin|wurde|ist)\s*\??$/i)) ||
     (m = s.match(/^(?:ich\s+bin\s+)?(?:am\s+)?(.+?)\s+geboren\s*[,.]?\s+wie\s+alt\s+bin\s+ich\s*\??$/i))){
    const p = parseDay(m[1]); if(!p || p.y == null) return { text: "Dafür brauche ich das vollständige Geburtsdatum mit Jahr, z. B. 14.03.1998.", source:"date" };
    const now = new Date(todayUTC()), b = new Date(p.ts);
    if(p.ts > todayUTC()) return { text: "Dieses Datum liegt in der Zukunft.", source:"date" };
    let age = now.getUTCFullYear() - b.getUTCFullYear();
    if(now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--;
    const next = resolveDay({ m:p.m, d:p.d }, true), until = Math.round((next - todayUTC()) / DAY);
    return { text: "Du bist **" + age + " Jahre** alt. " + (until === 0 ? "Heute ist dein Geburtstag – alles Gute! 🎂" : "Bis zu deinem nächsten Geburtstag sind es noch " + plur(until, "Tag", "Tage") + ".") + "\n\nInsgesamt hast du schon " + fmtN(Math.round((todayUTC() - p.ts) / DAY)) + " Tage erlebt.", source:"date", val:age };
  }
  return null;
}

/* ---------------- Kalenderwoche (ISO) ---------------- */
function isoWeek(ts){
  const d = new Date(ts), day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);                  // Donnerstag dieser Woche
  const year = d.getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4), jan4day = (new Date(jan4).getUTCDay() + 6) % 7;
  const week1Thu = jan4 + (3 - jan4day) * DAY;
  return { week: 1 + Math.round((d.getTime() - week1Thu) / (7 * DAY)), year };
}
function kwRange(year, week){
  const jan4 = Date.UTC(year, 0, 4), jan4day = (new Date(jan4).getUTCDay() + 6) % 7;
  const mon = jan4 + (3 - jan4day) * DAY + (week - 1) * 7 * DAY - 3 * DAY;
  return { from: mon, to: mon + 6 * DAY };
}
function kwTool(t){
  const s = t.trim().replace(/\s+/g, " ");
  let m;
  if((m = s.match(/^(?:kalenderwoche|kw)\s+(\d{1,2})(?:\s*(?:im\s+)?(?:jahr\s+|des\s+)?(\d{4}))?\s*\??$/i))){
    const w = +m[1], y = m[2] ? +m[2] : new Date().getFullYear();
    if(!(w >= 1 && w <= 53)) return { text: "Eine Kalenderwoche liegt zwischen 1 und 53.", source:"date" };
    const r = kwRange(y, w);
    return { text: "**KW " + w + " (" + y + ")**\n\n" + fmtDay(r.from) + " – " + fmtDay(r.to), source:"date", val:w };
  }
  if(/^(?:(?:in\s+)?welcher\s+(?:kalenderwoche|kw)\s+sind\s+wir(?:\s+(?:heute|jetzt))?|welche\s+(?:kalenderwoche|kw)\s+(?:ist|haben\s+wir)?\s*(?:heute|jetzt)?|(?:kalenderwoche|kw)\s+(?:heute|jetzt))\s*\??$/i.test(s)){
    const w = isoWeek(todayUTC());
    return { text: "Heute sind wir in **KW " + w.week + "** (" + w.year + ").", source:"date", val:w.week };
  }  if((m = s.match(/^(?:welche\s+)?(?:kalenderwoche|kw)\s+(?:ist|liegt\s+(?:am|auf)|fällt|faellt|vom|von|am)\s+(.+?)\s*\??$/i))){
    const p = parseDay(m[1]); if(!p) return null;
    const ts = resolveDay(p, false), w = isoWeek(ts);
    return { text: fmtDay(ts) + " liegt in **KW " + w.week + "**" + (w.year !== new Date(ts).getUTCFullYear() ? " (" + w.year + ")" : "") + ".", source:"date", val:w.week };
  }
  return null;
}

/* ---------------- Zeitzonen (offline über Intl) ---------------- */
const CITY_TZ = (() => {
  const M = {};
  const add = (zone, names) => names.split("|").forEach(n => M[n] = zone);
  add("Europe/Berlin", "berlin|hamburg|münchen|munich|muenchen|köln|koeln|cologne|frankfurt|stuttgart|düsseldorf|duesseldorf|leipzig|dortmund|bremen|hannover|nürnberg|nuernberg|bonn|deutschland|mez|mesz");
  add("Europe/Vienna", "wien|vienna|salzburg|graz|österreich|oesterreich|austria");
  add("Europe/Zurich", "zürich|zuerich|zurich|bern|basel|genf|geneva|schweiz|switzerland|chf");
  add("Europe/London", "london|england|uk|großbritannien|grossbritannien|schottland|edinburgh|manchester|dublin|irland|ireland");
  add("Europe/Paris", "paris|frankreich|france|lyon|marseille");
  add("Europe/Madrid", "madrid|spanien|spain|barcelona|sevilla");
  add("Europe/Rome", "rom|rome|mailand|milan|italien|italy|neapel|naples");
  add("Europe/Amsterdam", "amsterdam|rotterdam|niederlande|netherlands|holland");
  add("Europe/Brussels", "brüssel|bruessel|brussels|belgien|belgium");
  add("Europe/Stockholm", "stockholm|schweden|sweden|göteborg|gothenburg");
  add("Europe/Oslo", "oslo|norwegen|norway|bergen");
  add("Europe/Copenhagen", "kopenhagen|copenhagen|dänemark|daenemark|denmark|aarhus");
  add("Europe/Helsinki", "helsinki|finnland|finland|tampere");
  add("Europe/Warsaw", "warschau|warsaw|polen|poland|krakau|krakow");
  add("Europe/Prague", "prag|prague|tschechien|czech|brünn|brno");
  add("Europe/Budapest", "budapest|ungarn|hungary");
  add("Europe/Athens", "athen|athens|griechenland|greece|thessaloniki");
  add("Europe/Lisbon", "lisabon|lisbon|lissabon|portugal|porto");
  add("Europe/Moscow", "moskau|moscow|russland|russia|petersburg|sankt petersburg");
  add("Europe/Istanbul", "istanbul|türkei|tuerkei|turkey|ankara|izmir");
  add("Europe/Kyiv", "kiew|kyiv|kiev|ukraine");
  add("Asia/Dubai", "dubai|vereinigte arabische emirate|uae|abu dhabi");
  add("Asia/Qatar", "doha|katar|qatar");
  add("Asia/Riyadh", "riad|riyadh|saudi-arabien|saudi arabia");
  add("Asia/Kolkata", "delhi|neu-delhi|new delhi|mumbai|bombay|kalkutta|calcutta|indien|india|bangalore");
  add("Asia/Bangkok", "bangkok|thailand");
  add("Asia/Singapore", "singapur|singapore");
  add("Asia/Hong_Kong", "hongkong|hong kong");
  add("Asia/Shanghai", "shanghai|peking|beijing|china|shenzhen|guangzhou");
  add("Asia/Tokyo", "tokio|tokyo|japan|osaka|kyoto");
  add("Asia/Seoul", "seoul|korea|südkorea|suedkorea|south korea|busan");
  add("Asia/Taipei", "taipeh|taipei|taiwan");
  add("Asia/Jakarta", "jakarta|indonesien|indonesia|bali");
  add("Asia/Manila", "manila|philippinen|philippines");
  add("Australia/Sydney", "sydney|australien|australia|canberra|brisbane");
  add("Australia/Melbourne", "melbourne");
  add("Australia/Perth", "perth");
  add("Pacific/Auckland", "auckland|neuseeland|new zeeland|neuseeland|wellington");
  add("Pacific/Honolulu", "honolulu|hawaii");
  add("America/New_York", "new york|new-york|nyc|boston|miami|atlanta|washington|philadelphia|ostküste|usa ost");
  add("America/Chicago", "chicago|dallas|houston|texas|denver?|zentralzeit");
  add("America/Denver", "denver|salt lake city");
  add("America/Los_Angeles", "los angeles|san francisco|seattle|kalifornien|california|westküste|la|hollywood");
  add("America/Anchorage", "anchorage|alaska");
  add("America/Toronto", "toronto|kanada|canada|ottawa|montreal");
  add("America/Vancouver", "vancouver");
  add("America/Mexico_City", "mexiko-stadt|mexiko|mexico city|mexico");
  add("America/Bogota", "bogota|kolumbien|colombia");
  add("America/Lima", "lima|peru");
  add("America/Santiago", "santiago|chile");
  add("America/Argentina/Buenos_Aires", "buenos aires|argentinien|argentina");
  add("America/Sao_Paulo", "são paulo|sao paulo|rio|rio de janeiro|brasilien|brazil");
  add("Africa/Cairo", "kairo|cairo|ägypten|aegypten|egypt");
  add("Africa/Lagos", "lagos|nigeria");
  add("Africa/Nairobi", "nairobi|kenia|kenya");
  add("Africa/Johannesburg", "johannesburg|kapstadt|cape town|südafrika|suedafrika|south africa");
  add("Africa/Casablanca", "casablanca|marokko|morocco");
  add("Atlantic/Reykjavik", "reykjavik|island|iceland");
  add("Etc/UTC", "utc|gmt|weltzeit");
  return M;
})();
function tzOf(raw){
  const s = String(raw).toLowerCase().trim().replace(/[?.!]+$/, "").replace(/^(?:der|die|das)\s+/, "").replace(/\s+zeitzonen?$/, "").trim();
  if(CITY_TZ[s]) return CITY_TZ[s];
  const spaced = s.replace(/\s+/g, " ");
  if(CITY_TZ[spaced]) return CITY_TZ[spaced];
  if(/^[a-z_]+\/[a-z_]+$/i.test(s)){ try { new Intl.DateTimeFormat("de-DE", { timeZone:s }); return s; } catch(e) {} }
  return null;
}
function tzOffsetMin(tz, date){
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone:tz, hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" })
    .formatToParts(date).forEach(x => p[x.type] = x.value);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}
function zonedWall(y, mo, d, h, mi, tz){
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ts = guess - tzOffsetMin(tz, new Date(guess)) * 60000;
  ts = guess - tzOffsetMin(tz, new Date(ts)) * 60000;   // DST-Korrektur gegen den Original-Guess
  return new Date(ts);
}
function tzDiffLabel(diffMin){
  if(diffMin === 0) return "gleiche Zeit";
  const h = Math.abs(diffMin) / 60;
  return (diffMin > 0 ? "+" : "−") + fmtN(h, h % 1 ? 1 : 0) + " Stunden";
}
function tzTool(t){
  const s = t.trim().replace(/\s+/g, " ");
  let m;
  if((m = s.match(/^(?:wie\s+spät\s+ist\s+es(?:\s+gerade)?|wie\s*viel\s+uhr\s+ist\s+es|uhrzeit)\s+(?:in|in\s+der)\s+(.+?)\s*\??$/i))){
    const tz = tzOf(m[1]); if(!tz) return null;
    const now = new Date();
    const time = now.toLocaleTimeString("de-DE", { timeZone:tz, hour:"2-digit", minute:"2-digit" });
    const day = now.toLocaleDateString("de-DE", { timeZone:tz, weekday:"long", day:"numeric", month:"long", year:"numeric" });
    const diff = tzOffsetMin(tz, now) - tzOffsetMin("Europe/Berlin", now);
    return { text: "In **" + cap1(String(m[1]).trim()) + "** ist es gerade **" + time + " Uhr** (" + day + ").\n\nZeitunterschied zu Berlin: **" + tzDiffLabel(diff) + "**", source:"date" };
  }
  if((m = s.match(/^(?:zeitunterschied|zeit\s*unterschied)\s+(?:zwischen|von)\s+(.+?)\s+(?:und|&|nach|zu)\s+(.+?)\s*\??$/i))){
    const a = tzOf(m[1]), b = tzOf(m[2]); if(!a || !b) return null;
    const diff = tzOffsetMin(b, new Date()) - tzOffsetMin(a, new Date());
    return { text: "Zeitunterschied **" + cap1(String(m[1]).trim()) + " → " + cap1(String(m[2]).trim()) + "**: **" + tzDiffLabel(diff) + "**" + (diff === 0 ? "" : " (" + (diff > 0 ? String(m[2]).trim() + " ist voraus" : String(m[1]).trim() + " ist voraus") + ")") + ".", source:"date", val:diff / 60 };
  }
  if((m = s.match(/^(?:zeitunterschied|zeit\s*unterschied)\s+(?:zu|nach|gegen(?:ü|ue)ber)\s+(.+?)\s*\??$/i))){
    const tz = tzOf(m[1]); if(!tz) return null;
    const diff = tzOffsetMin(tz, new Date()) - tzOffsetMin("Europe/Berlin", new Date());
    return { text: "Zeitunterschied **Berlin → " + cap1(String(m[1]).trim()) + "**: **" + tzDiffLabel(diff) + "**.", source:"date", val:diff / 60 };
  }
  if((m = s.match(/^(?:(?:wann\s+ist|wie\s+spät\s+ist\s+es|wie\s*viel\s+uhr\s+ist\s+es)\s+)?(?:um\s+)?(\d{1,2})(?::(\d{2})|\.(\d{2}))?(?:\s*(?:uhr|h))?\s*(mesz|mez|utc|gmt|utc\s*[+-]\d{1,2})?\s*(?:uhr\s+)?in\s+(.+?)\s*[?.!]?$/i))){
    const h = +m[1], mi = +(m[2] || m[3] || 0), zoneIn = (m[4] || "").toLowerCase();
    if(!(h >= 0 && h <= 23 && mi >= 0 && mi <= 59)) return null;
    const srcTz = !zoneIn || /^(mez|mesz)$/.test(zoneIn) ? "Europe/Berlin" : /^(utc|gmt)$/.test(zoneIn) ? "Etc/UTC" : "Europe/Berlin";
    const dstTz = tzOf(m[5]); if(!dstTz) return null;
    const now = new Date();
    const here = now.toLocaleDateString("en-CA", { timeZone:srcTz }).split("-").map(Number);
    const when = zonedWall(here[0], here[1], here[2], h, mi, srcTz);
    const out = when.toLocaleTimeString("de-DE", { timeZone:dstTz, hour:"2-digit", minute:"2-digit" });
    const outDay = when.toLocaleDateString("de-DE", { timeZone:dstTz, weekday:"long", day:"numeric", month:"long" });
    const sameDay = when.toLocaleDateString("en-CA", { timeZone:srcTz }) === when.toLocaleDateString("en-CA", { timeZone:dstTz });
    return { text: "**" + (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi + " Uhr** (" + (zoneIn ? zoneIn.toUpperCase() : "MEZ/MESZ") + ") = **" + out + " Uhr** in " + cap1(String(m[5]).trim()) + (sameDay ? "" : " – " + outDay) + ".", source:"date" };
  }
  return null;
}

/* ---------------- Countdown-Liste ---------------- */
function countdownTool(t){
  let s = t.trim().replace(/\s+/g, " ");
  s = s.replace(/^(?:(?:bitte\s+)?(?:merk(?:e)?(?:\s+(?:mir|dir))?|lege|erstelle|speichere)\s*[:,]?\s+)?(?:noch\s+)?(?:eine[nr]?\s+)?countdown\b/i, "countdown");
  let m;
  if((m = s.match(/^(?:countdown\s+(?:löschen|loeschen|entfernen)|(?:lösche|loesche|entferne|vergiss)\s+(?:den\s+)?countdown)\s*[:,]?\s*(.+?)\s*[.!]?$/i))){
    const q = norm(m[1]);
    let hits = cfg.countdowns.filter(x => norm(x.name) === q);
    if(!hits.length) hits = cfg.countdowns.filter(x => norm(x.name).indexOf(q) > -1 || q.indexOf(norm(x.name)) > -1);
    if(!hits.length) return { text: "Einen Countdown mit dem Namen „" + m[1].trim() + "“ gibt es nicht.", source:"date" };
    return { text: "Erledigt – " + (hits.length === 1 ? "Countdown „" + hits[0].name + "“ gelöscht" : hits.length + " Countdowns gelöscht") + ".", source:"date",
      effect: () => { cfg.countdowns = cfg.countdowns.filter(x => hits.indexOf(x) < 0); saveCfg(); } };
  }
  if(/^(?:(?:zeige?|zeig)(?:\s+mir)?|meine|alle|liste\s+(?:der\s+)?)?\s*countdowns?(?:\s+(?:an|liste|übersicht))?\s*[.!]?$/i.test(s)){
    const list = cfg.countdowns.slice().sort((a, b) => a.ts - b.ts);
    if(!list.length) return { text: "Du hast noch keine Countdowns gespeichert. Sag z. B. **„Countdown bis Weihnachten“**.", source:"date" };
    const rows = list.map(x => {
      const d = Math.round((x.ts - todayUTC()) / DAY);
      const left = d > 0 ? "noch " + plur(d, "Tag", "Tage") : d === 0 ? "**heute!** 🎉" : "vor " + plur(-d, "Tag", "Tagen") + " (abgelaufen)";
      return "| " + x.name + " | " + fmtDay(x.ts) + " | " + left + " |";
    }).join("\n");
    return { text: "Deine Countdowns:\n\n| Termin | Datum | Noch |\n|---|---|---|\n" + rows, source:"date" };
  }
  let name = null, dateStr = null;
  if((m = s.match(/^countdown\s+bis\s+(.+?)\s*[:,–—-]\s*(.+?)\s*[.!]?$/i))){ dateStr = m[1]; name = m[2]; }
  else if((m = s.match(/^countdown\s+bis\s+(.+?)\s*[.!]?$/i))){ dateStr = m[1]; }
  else if((m = s.match(/^countdown\s+(?:für|fuer)\s+(.+?)\s+bis\s+(.+?)\s*[.!]?$/i))){ name = m[1]; dateStr = m[2]; }
  else return null;
  const p = parseDay(dateStr);
  if(!p) return { text: "Das Datum „" + dateStr.trim() + "“ kenne ich leider nicht. Versuche z. B. „Countdown bis 24.12.2027“ oder „Countdown bis Weihnachten“.", source:"date" };
  const ts = resolveDay(p, true);
  const label = (name || p.label || fmtDay(ts)).trim().slice(0, 40);
  const d = Math.round((ts - todayUTC()) / DAY);
  const when = d > 0 ? "bis " + fmtDay(ts) + " sind es noch **" + plur(d, "Tag", "Tage") + "**" : d === 0 ? "das ist **heute**! 🎉" : "das war am " + fmtDay(ts) + " – **vor " + plur(-d, "Tag", "Tagen") + "**";
  return { text: "**Countdown gespeichert:** „" + label + "“ – " + when + ".\n\n_Alle Countdowns mit „Meine Countdowns“, löschen mit „Countdown löschen: …“._", source:"date",
    effect: () => {
      cfg.countdowns = cfg.countdowns.filter(x => norm(x.name) !== norm(label));
      cfg.countdowns.push({ name: label, ts });
      saveCfg();
    } };
}

/* ---------------- Zinsen, Dreisatz, Geometrie ---------------- */
function financeTool(t){
  const m = t.match(new RegExp("^(?:wie\\s*viel\\s+(?:sind|habe\\s+ich\\s+(?:nach|bei))\\s+)?" + NUM + "\\s*(?:€|euro|eur)?\\s*(?:mit|zu|bei|und)\\s*" + NUM + "\\s*(?:%|prozent)\\s*(?:zinsen|zins|verzinsung|rendite)?\\s*(?:p\\.?\\s?a\\.?|pro\\s+jahr|im\\s+jahr|jährlich)?\\s*(?:für|über|in|nach)\\s*" + NUM + "\\s*jahre?n?\\s*\\??$", "i"));
  if(!m) return null;
  const k0 = toNum(m[1]), p = toNum(m[2]), n = toNum(m[3]);
  if(!(n >= 0 && n <= 200)) return { text: "Bitte gib eine Laufzeit zwischen 0 und 200 Jahren an.", source:"finance" };
  const end = k0 * Math.pow(1 + p / 100, n);
  let tbl = "";
  if(Number.isInteger(n) && n <= 15 && n > 0){
    tbl = "\n\n| Jahr | Zinsen | Kapital |\n|---|---|---|\n";
    let k = k0;
    for(let i = 1; i <= n; i++){ const z = k * p / 100; k += z; tbl += "| " + i + " | " + fmtN(z, 2) + " € | " + fmtN(k, 2) + " € |\n"; }
  }
  return { text: "Mit Zinseszins (jährliche Verzinsung):\n\n**" + fmtN(k0, 2) + " € → " + fmtN(end, 2) + " €** nach " + fmtN(n) + " Jahren\n\nZinsertrag: **" + fmtN(end - k0, 2) + " €**\n\nFormel: K = K₀ · (1 + p/100)ⁿ = " + fmtN(k0, 2) + " · " + fmtN(1 + p / 100, 6) + "^" + fmtN(n) + tbl + "\n_Ohne Steuern, Gebühren und Inflation._", source:"finance", val:end };
}
function ruleOfThree(t){
  const V = "(?:kosten|kostet|wiegen|wiegt|brauchen|braucht|dauern|dauert|ergeben|ergibt|sind|schaffen|schafft|verbrauchen|verbraucht)";
  const m = t.match(new RegExp("^" + NUM + "\\s+(.+?)\\s+" + V + "\\s+" + NUM + "\\s*([^\\s,.;?]*)\\s*[,.;]?\\s*(?:wie\\s*viel(?:e)?|was)\\s+" + V + "\\s+" + NUM + "(?:\\s+.*?)?\\s*\\??$", "i"));
  if(!m) return null;
  const a = toNum(m[1]), b = toNum(m[3]), c = toNum(m[5]), unit = (m[4] || "").trim(), thing = m[2].trim();
  if(a === 0) return { text: "Mit 0 als Ausgangsmenge kann ich keinen Dreisatz rechnen.", source:"calc" };
  const one = b / a, r = one * c, u = unit ? " " + unit : "";
  return { text: "Dreisatz (proportional):\n\n1. " + fmtN(a) + " " + thing + " → " + fmtN(b) + u + "\n2. 1 → " + fmtN(b) + u + " ÷ " + fmtN(a) + " = " + fmtN(one, 4) + u + "\n3. " + fmtN(c) + " → " + fmtN(one, 4) + u + " × " + fmtN(c) + " = **" + fmtN(r, 2) + u + "**", source:"calc", val:r };
}
function geoTool(t){
  const s = t.toLowerCase();
  const qty = (s.match(/flächeninhalt|fläche|umfang|oberfläche|volumen/) || [])[0];
  const shape = (s.match(/kreis|rechteck|quadrat|dreieck|würfel|kugel|zylinder|quader|kegel/) || [])[0];
  if(!qty || !shape || !/\d/.test(s)) return null;
  const g = (re) => { const m = s.match(new RegExp("(?:^|[\\s,(])(?:" + re + ")\\s*(?:=|:|von|ist)?\\s*" + NUM)); return m ? toNum(m[1]) : null; };
  let r = g("r|radius"), d = g("d|durchmesser"), a = g("a|seite|seitenlänge|kante|kantenlänge|länge"), b = g("b|breite"),
      c = g("c|tiefe"), h = g("h|höhe"), gr = g("g|grundseite");
  const pair = s.match(new RegExp(NUM + "\\s*(?:x|×|\\*|mal)\\s*" + NUM + "(?:\\s*(?:x|×|\\*|mal)\\s*" + NUM + ")?"));
  if(pair){ if(a == null) a = toNum(pair[1]); if(b == null) b = toNum(pair[2]); if(pair[3] && c == null) c = toNum(pair[3]); }
  if(r == null && d != null) r = d / 2;
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map(toNum);
  if(r == null && /kreis|kugel|zylinder|kegel/.test(shape) && nums.length === 1) r = nums[0];
  if(a == null && /quadrat|würfel/.test(shape) && nums.length === 1) a = nums[0];
  const out = (f, val, text) => ({ text: "**" + text + " = " + fmtN(val, 4) + "**\n\nFormel: " + f, source:"geo", val });
  const need = w => ({ text: "Dafür brauche ich noch " + w + ".", source:"geo" });
  const PI = Math.PI;
  if(shape === "kreis"){ if(r == null) return need("den Radius (r = …) oder Durchmesser (d = …)");
    return qty === "umfang" ? out("U = 2 · π · r", 2 * PI * r, "Umfang") : out("A = π · r²", PI * r * r, "Fläche"); }
  if(shape === "quadrat"){ if(a == null) return need("die Seitenlänge (a = …)");
    return qty === "umfang" ? out("U = 4 · a", 4 * a, "Umfang") : out("A = a²", a * a, "Fläche"); }
  if(shape === "rechteck"){ if(a == null || b == null) return need("Länge und Breite (z. B. 3 x 4)");
    return qty === "umfang" ? out("U = 2 · (a + b)", 2 * (a + b), "Umfang") : out("A = a · b", a * b, "Fläche"); }
  if(shape === "dreieck"){
    if(qty === "umfang"){ if(a == null || b == null || c == null) return need("alle drei Seiten (a, b, c)"); return out("U = a + b + c", a + b + c, "Umfang"); }
    if(gr == null) gr = a; if(gr == null || h == null) return need("Grundseite (g = …) und Höhe (h = …)");
    return out("A = ½ · g · h", gr * h / 2, "Fläche"); }
  if(shape === "würfel"){ if(a == null) return need("die Kantenlänge (a = …)");
    return /ober/.test(qty) ? out("O = 6 · a²", 6 * a * a, "Oberfläche") : out("V = a³", a * a * a, "Volumen"); }
  if(shape === "quader"){ if(a == null || b == null || c == null){ if(h != null && a != null && b != null) c = h; else return need("Länge, Breite und Höhe (z. B. 2 x 3 x 4)"); }
    return /ober/.test(qty) ? out("O = 2 · (ab + ac + bc)", 2 * (a * b + a * c + b * c), "Oberfläche") : out("V = a · b · c", a * b * c, "Volumen"); }
  if(shape === "kugel"){ if(r == null) return need("den Radius (r = …)");
    return /ober/.test(qty) ? out("O = 4 · π · r²", 4 * PI * r * r, "Oberfläche") : out("V = 4/3 · π · r³", 4 / 3 * PI * r * r * r, "Volumen"); }
  if(shape === "zylinder"){ if(r == null || h == null) return need("Radius (r = …) und Höhe (h = …)");
    return /ober/.test(qty) ? out("O = 2πr² + 2πrh", 2 * PI * r * r + 2 * PI * r * h, "Oberfläche") : out("V = π · r² · h", PI * r * r * h, "Volumen"); }
  if(shape === "kegel"){ if(r == null || h == null) return need("Radius (r = …) und Höhe (h = …)");
    return out("V = ⅓ · π · r² · h", PI * r * r * h / 3, "Volumen"); }
  return null;
}

/* ---------------- Wissenssammlung ---------------- */
const STOP = new Set(("der die das den dem des ein eine einer eines einem einen und oder aber ist sind war waren wird werden wie was wer wo wann warum wieso weshalb welche welcher welches " +
  "ich du er sie es wir ihr mir mich dir dich mein meine meinen meiner dein deine unser euer in im am an auf aus bei mit nach von vor zu zum zur fuer ueber unter um bis kann kannst koennen " +
  "gibt hat habe hast haben habt nicht kein keine auch noch nur schon sehr mal bitte man sich so dann denn doch ja nein the of to is are what how").split(" "));
const stem = w => w.length > 5 ? w.replace(/(ungen|heiten|keiten|ung|ern|en|er|es|e|n|s)$/, "") : w;
const kTokens = s => tokens(s).filter(w => !STOP.has(w)).map(stem);
let KCACHE = null;
function knowledgeChunks(){
  const src = String(cfg.knowledge || "");
  if(KCACHE && KCACHE.src === src) return KCACHE.list;
  const list = []; let title = "Notizen", buf = [];
  const push = () => { const txt = buf.join("\n").trim(); if(txt) list.push({ title, text:txt, toks: new Set(kTokens(title + " " + txt)), ttoks: new Set(kTokens(title)) }); buf = []; };
  src.split(/\r?\n/).forEach(l => {
    const h = l.match(/^\s*#{1,3}\s+(.+?)\s*$/);
    if(h){ push(); title = h[1]; }
    else if(!l.trim()) push();
    else buf.push(l);
  });
  push();
  KCACHE = { src, list };
  return list;
}
function searchKnowledge(q, forced){
  const ch = knowledgeChunks(); if(!ch.length) return null;
  const qt = Array.from(new Set(kTokens(q))); if(!qt.length) return null;
  const df = {}; qt.forEach(w => { df[w] = ch.filter(c => c.toks.has(w)).length; });
  let best = null;
  ch.forEach(c => {
    let score = 0, hit = 0;
    qt.forEach(w => {
      const idf = Math.log(1 + ch.length / (1 + (df[w] || 0))) + .3;
      if(c.toks.has(w)){ score += idf * (c.ttoks.has(w) ? 1.5 : 1); hit++; }
      else if(w.length >= 5 && Array.from(c.toks).some(x => wordLike(w, x))){ score += idf * .7; hit++; }
    });
    if(!best || score > best.score) best = { c, score, hit };
  });
  if(!best || !best.hit) return null;
  if(!forced && (best.hit < Math.min(2, qt.length) || best.hit / qt.length < .5)) return null;
  return { text: best.c.text + "\n\n_Quelle: Wissenssammlung → " + best.c.title + "_", source:"know" };
}
function knowledgeTool(t){
  const m = t.match(/^(?:such(?:e)?|durchsuche?)\s+(?:in\s+)?(?:meinen\s+notizen|meinem\s+wissen|der\s+wissenssammlung|wissen)\s*(?:nach)?\s*[:,]?\s+(.+)$/i);
  if(!m) return null;
  return searchKnowledge(m[1], true) || { text: "In deiner Wissenssammlung habe ich dazu nichts gefunden.", source:"know" };
}

/* ---------------- Ablauf ----------------
   1. Folgefrage zur vorigen Antwort (Kontext)
   2. bewusst exakte Regeln (=, ~, {x}) oder Regeln mit Priorität > 0
   3. eindeutig formulierte Werkzeuge (Hilfe, Merken, Text, Wörterbuch, Datum, Einheiten, Zinsen …)
   4. übrige Regeln
   5. Rechner
   6. Wissenssammlung
   7. Standardantwort                                                     */
function toolChain(t){
  if(/^\/?(?:hilfe|help|was\s+kannst\s+du(?:\s+alles)?|funktionen|befehle)\s*\??$/i.test(t.trim())) return { text: HELP, source:"tool" };
  return memoryTool(t) || textTool(t) || knowledgeTool(t) || dictTool(t) || dateTool(t) || kwTool(t) || tzTool(t) || countdownTool(t) || unitTool(t) || EXTRA_TOOLS(t) || financeTool(t) || ruleOfThree(t) || geoTool(t);
}
export function pickResponse(text, avoid, ctx){
  const t = String(text || "").trim(), base = { rule:null, pattern:"", index:0, total:1 };
  /* Ein führendes "/" ist ein Befehlspräfix und wird überall akzeptiert
     (das /-Menü fügt es ein; man kann es auch selbst tippen). */
  const slashed = t.charAt(0) === "/";
  const q = slashed ? t.replace(/^\/+/, "").trim() : t;
  const hist = Array.isArray(ctx) ? ctx : (ctx && ctx.history); const prev = hist ? lastAi(hist) : null;
  const done = r => Object.assign({}, base, r);
  if(slashed){                     /* Befehle haben mit "/" immer Vorrang */
    let xt = null;
    try { xt = toolChain(q); } catch(e) { xt = null; }
    if(xt){ if(xt.effect) try { xt.effect(); } catch(e) {} statCount("tool", xt.source || "tool"); return done(xt); }
  }
  const fu = followUp(q, avoid, prev);
  if(fu){ statCount("tool", fu.source || "follow"); return done(fu); }
  const hit = findRule(q);
  if(hit && (hit.hard || hit.prio > 0)) return fromRule(hit, avoid);
  let tool = null;
  try { tool = toolChain(q); } catch(e) { tool = null; }
  if(tool){ if(tool.effect) try { tool.effect(); } catch(e) {} statCount("tool", tool.source || "tool"); return done(tool); }
  if(hit) return fromRule(hit, avoid);
  const math = NovaMath.reply(q);
  if(math !== null){ statCount("tool", "math"); return done({ text: math, source:"math", val: NovaMath.lastValue() }); }
  const metaIn = metaReply(q);
  if(metaIn){ statCount("tool", "meta"); return done({ text: metaIn, source:"meta" }); }
  const k = searchKnowledge(q, false);
  if(k){ statCount("tool", "know"); return done(k); }
  const pool = fallbackList(), out = pickFrom(pool, avoid);
  statCount("tool", "fallback");
  return done({ text: out, index: pool.indexOf(out), total: pool.length, source:"fallback" });
}
export const SOURCE_LABEL = { math:"Echter Offline-Rechner", unit:"Einheiten-Umrechnung", date:"Datumsrechnung", finance:"Zinsrechner", calc:"Dreisatz",
  geo:"Geometrie", tool:"Text-Werkzeug / Hilfe", timer:"Timer & Wecker", random:"Würfeln & Zufall", base:"Zahlensysteme", color:"Farben", vat:"Netto/Brutto", price:"Preisvergleich", dict:"Offline-Wörterbuch", mem:"Erinnerungen", know:"Wissenssammlung", meta:"Eingabe-Erkennung", pw:"Passwort-Generator", qr:"QR-Code-Generator", chart:"Diagramme", list:"Checklisten", fallback:"Standardantwort", follow:"Folgeantwort (Kontext)" };
/* =====================================================================
   Zusatz-Werkzeuge (offline):
   Timer & Wecker mit echtem Countdown · Würfeln & Zufall ·
   Zahlensysteme & Primzahlen · Farben · Netto/Brutto · Preisvergleich ·
   Regel-Statistik · Regel-Testsuite · Chat-Export
   ===================================================================== */

/* ---------------- Regel-Statistik ---------------- */
function statCount(kind, id){
  if(!cfg.stats || typeof cfg.stats !== "object") cfg.stats = {};
  if(!cfg.stats.rules || typeof cfg.stats.rules !== "object") cfg.stats.rules = {};
  if(!cfg.stats.tools || typeof cfg.stats.tools !== "object") cfg.stats.tools = {};
  const bag = kind === "rule" ? cfg.stats.rules : cfg.stats.tools;
  bag[id] = (bag[id] || 0) + 1;
  try { saveCfg(); } catch(e) {}
}


/* ---------------- Timer adapter (React owns lifecycle and persistence) ---------------- */
function durWords(sec){
  if(sec % 3600 === 0 && sec >= 3600) return fmtN(sec / 3600) + (sec === 3600 ? " Stunde" : " Stunden");
  if(sec % 60 === 0 && sec >= 60) return fmtN(sec / 60) + (sec === 60 ? " Minute" : " Minuten");
  return fmtN(sec) + (sec === 1 ? " Sekunde" : " Sekunden");
}
function parseDur(num, unit){
  const n = +num; if(!(n >= 1)) return null;
  const u = String(unit).toLowerCase();
  const sec = /^s/.test(u) ? n : /^(m|min)/.test(u) ? n * 60 : /^(h|std|stun)/.test(u) ? n * 3600 : 0;
  return sec >= 1 && sec <= 86400 ? sec : null;
}
function timerTool(t){
  const s = t.trim();
  let m;
  if(/^(?:(?:bitte\s+)?(?:breche|stoppe)\s+(?:den\s+)?(?:timer|wecker|alarm)|(?:timer|wecker|alarm)\s+(?:abbrechen|stoppen|stopp|aus|löschen|l\s+sen))\s*[.!]?$/i.test(s)){
    const n = timerAdapter.stopAll();
    return { text: n ? "Okay, " + (n === 1 ? "der Timer ist abgebrochen." : "alle " + n + " Timer sind abgebrochen.") : "Es läuft gerade kein Timer.", source:"timer" };
  }
  if(/^(?:(?:wie\s*viel|wieviel)\s+zeit\s+(?:ist\s+noch|bleibt\s+noch|noch\s+übrig|ist\s+noch\s+übrig)|timer\s+status|wie\s+lange\s+(?:noch|dauert\s+es\s+noch))\s*[?!.]?$/i.test(s)){
    const activeTimers = timerAdapter.getTimers();
    if(!activeTimers.length) return { text: "Es läuft gerade kein Timer.", source:"timer" };
    return { text: "Laufende Timer:\n\n" + activeTimers.map(x => {
      const left = Math.max(0, Math.round((x.paused ? x.left : x.end - Date.now()) / 1000));
      return "- ⏱️ **" + durWords(left) + "** von " + x.label + " übrig" + (x.paused ? " _(pausiert)_" : "");
    }).join("\n"), source:"timer" };
  }
  const DUR = "(\\d{1,5})\\s*(s(?:ek(?:unden?)?)?|sek|m(?:in(?:uten?)?)?|min|h|std|stunden?)";
  if((m = s.match(new RegExp("^(?:(?:stell(?:e)?|setze|starte)?\\s*(?:einen?\\s+)?(?:timer|wecker|alarm)\\s*(?:auf|f\\u00fcr|von|:)?|" +
    "(?:weck|erinner|alarmier|erinnere)\\s+(?:mich|uns|ihn|sie)\\s+(?:bitte\\s+)?(?:in|nach)|" +
    "in|nach)\\s*" + DUR + "(?:\\s*(?:lauf(?:en)?|lang|warten|alarm))??\\s*[.!]?$", "i")))){
    const sec = parseDur(m[1], m[2]);
    if(!sec) return { text: "Der Zeitraum passt nicht. Unterstützt: 1 Sekunde bis 24 Stunden, z. B. „Timer 5 Minuten“ oder „Weck mich in 10 Minuten“.", source:"timer" };
    timerAdapter.start(sec);
    return { text: "⏱️ **Timer gestellt** – ich sage in **" + durWords(sec) + "** Bescheid.\n\nOben rechts in der Ecke siehst du live den Fortschritt und kannst den Timer **anhalten**. „Timer abbrechen“ stoppt ihn, „Wie viel Zeit ist noch?“ zeigt den Rest.", source:"timer" };
  }
  return null;
}


/* ---------------- Würfeln & Zufall ---------------- */
function randomTool(t){
  const s = t.trim();
  let m;
  if(/^(?:münzwurf|muenzwurf|(?:wirf|wirf bitte|mach) eine münze|kopf oder zahl|münze (?:werfen|drehen))\s*[!?]?$/i.test(s))
    return { text: "🪙 **" + (Math.random() < .5 ? "Kopf" : "Zahl") + "**", source:"random" };
  if((m = s.match(/^(?:würfle|wuerfle|würfel|wuerfel|wirf)(?:\s+bitte)?(?:\s+(?:(\d{1,2})\s*d\s*(\d{1,3})|(\d{1,3})))?\s*$/i))){
    let count = 1, faces = 6;
    if(m[1]){ count = +m[1]; faces = +m[2]; }
    else if(m[3]){ faces = +m[3]; }
    if(!(count >= 1 && count <= 20 && faces >= 2 && faces <= 1000)) return { text: "Ich würfle mit 1–20 Würfeln mit 2–1000 Seiten.", source:"random" };
    const rolls = Array.from({ length:count }, () => 1 + Math.floor(Math.random() * faces));
    const sum = rolls.reduce((a, b) => a + b, 0);
    return { text: "🎲 " + (count > 1 ? rolls.map(r => "**" + r + "**").join(" + ") + " = **" + sum + "**\n\n" + count + "W" + faces : "**" + rolls[0] + "**\n\n1W" + faces), source:"random", val:sum };
  }
  if((m = s.match(/^(?:zufallszahl|zufällige zahl|zufaellige zahl)\s+(?:von\s+|zwischen\s+)?(\d{1,9})\s*(?:bis|und|–|-)\s*(\d{1,9})\s*$/i))){
    let a = +m[1], b = +m[2];
    if(a > b){ const x = a; a = b; b = x; }
    if(b - a > 1e8) return { text: "Der Bereich ist zu groß (maximal 100 Millionen).", source:"random" };
    const v = a + Math.floor(Math.random() * (b - a + 1));
    return { text: "🎯 Zufallszahl zwischen " + fmtN(a) + " und " + fmtN(b) + ": **" + fmtN(v) + "**", source:"random", val:v };
  }
  if((m = s.match(/^(?:wähle|waehele|entscheide(?:\s+dich)?|zieh(?:e)?(?:\s+eins)?|such(?:e)? aus|pick)\s*[:,]?\s+(.+)$/i))){
    const opts = listItems(m[1].replace(/\s+oder\s+/gi, "|")).map(x => x.trim()).filter(x => x && x.length <= 60);
    if(opts.length < 2) return { text: "Gib mir mindestens zwei Optionen, z. B. „Wähle: Pizza oder Pasta“.", source:"random" };
    const pick = opts[Math.floor(Math.random() * opts.length)];
    return { text: "🎯 Ich wähle: **" + pick + "**", source:"random" };
  }
  return null;
}

/* ---------------- Zahlensysteme & Primzahlen ---------------- */
function baseTool(t){
  const s = t.trim();
  let m;
  if((m = s.match(/^(\d{1,18})\s+(?:in|als|zu|nach|→|->)\s+(binär|binaer|binary|hex|hexadezimal|hexadecimal|oktal|octal)\b/i))){
    const n = +m[1], u = m[2].toLowerCase(), pad = v => v.toString(u.indexOf("b") === 0 ? 2 : u.indexOf("o") === 0 ? 8 : 16).toUpperCase();
    const sys = /bin/.test(u) ? "Binär" : /okt|oct/.test(u) ? "Oktal" : "Hexadezimal";
    return { text: "**" + fmtN(n) + "** in " + sys + ": **" + pad(n) + "**", source:"base", val:n };
  }
  if((m = s.match(/^(?:0x([0-9a-f]{1,16})|0b([01]{1,64})|0o([0-7]{1,22})|([0-9a-f]{1,16}))\s+(?:in|als|zu|nach|→|->)\s+(dezimal|decimal)\b/i))){
    const raw = m[0];
    let n;
    if(/^0x/i.test(raw)) n = parseInt(m[1], 16);
    else if(/^0b/i.test(raw)) n = parseInt(m[2], 2);
    else if(/^0o/i.test(raw)) n = parseInt(m[3], 8);
    else {
      const hex = m[4];
      if(/^\d+$/.test(hex)) return null;               // „5 in dezimal“ ist kein Hexadezimal-Beispiel
      n = parseInt(hex, 16);
    }
    return { text: "**" + raw.split(/\s+/)[0].toUpperCase() + "** in Dezimal: **" + fmtN(n) + "**", source:"base", val:n };
  }
  if((m = s.match(/^(?:primfaktor(?:zerlegung)?|primfaktoren)\s*(?:von|des|die)?\s*(\d{1,15})\s*[.!?]?$/i))){
    let n = +m[1];
    if(n < 2) return { text: "Primfaktoren gibt es nur für ganze Zahlen ab 2.", source:"base" };
    const orig = n, facts = [];
    for(let d = 2; d * d <= n; d++) while(n % d === 0){ facts.push(d); n /= d; }
    if(n > 1) facts.push(n);
    const pretty = Object.entries(facts.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {})).map(([pr, e]) => e > 1 ? pr + "^" + e : pr).join(" · ");
    return { text: "Primfaktorzerlegung von **" + fmtN(orig) + "**:\n\n**" + pretty + "**", source:"base", val:orig };
  }
  if((m = s.match(/^(?:ist\s+)?(\d{1,15})\s+(?:eine?\s+)?(?:primzahl|prime)(?:\s+zahl)?\s*[?!.]?$/i))){
    const n = +m[1];
    if(n < 2) return { text: "**" + fmtN(n) + "** ist weder Primzahl noch zusammengesetzt.", source:"base" };
    let div = 0;
    for(let d = 2; d * d <= n; d++) if(n % d === 0){ div = d; break; }
    return { text: "**" + fmtN(n) + "** ist " + (div ? "**keine** Primzahl: " + fmtN(div) + " · " + fmtN(n / div) + " = " + fmtN(n) : "eine **Primzahl**. ✔️"), source:"base", val:n };
  }
  if((m = s.match(/^(?:ggt|ggT|groesster gemeinsamer teiler|größter gemeinsamer teiler)\s*\(?\s*(\d{1,12})\s*[,\s]\s*(\d{1,12})\s*\)?\s*[.!?]?$/i)) ||
     (m = s.match(/^(?:kgv|kkg|kleinstes gemeinsames vielfaches)\s*\(?\s*(\d{1,12})\s*[,\s]\s*(\d{1,12})\s*\)?\s*[.!?]?$/i))){
    const isGgt = /ggt|gemeinsamer teiler|groesster|größter/i.test(s);
    let a = +m[1], b = +m[2];
    const g = (x, y) => y ? g(y, x % y) : x;
    const d = g(a, b), r = isGgt ? d : a / d * b;
    return { text: (isGgt ? "Größter gemeinsamer Teiler" : "Kleinstes gemeinsames Vielfaches") + " von " + fmtN(a) + " und " + fmtN(b) + " = **" + fmtN(r) + "**", source:"base", val:r };
  }
  return null;
}

/* ---------------- Farben ---------------- */
function colorTool(t){
  const s = t.trim();
  let m, hex, r, g, b;
  const rgb2hsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0; const l = (mx + mn) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if(d){ h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = Math.round(h * 60); if(h < 0) h += 360; }
    return [h, Math.round(s * 100), Math.round(l * 100)];
  };
  const out = (hx, rv, gv, bv) => {
    const [h, sl, l] = rgb2hsl(rv, gv, bv);
    return { text: "**#" + hx.toUpperCase() + "**\n\n- RGB: **rgb(" + rv + ", " + gv + ", " + bv + ")**\n- HSL: **hsl(" + h + ", " + sl + " %, " + l + " %)**",
      source:"color", widget:{ type:"color", hex:hx }, val:rv * 65536 + gv * 256 + bv };
  };
  if((m = s.match(/^#?([0-9a-f]{6})\s*(?:in|als|zu|→|->)\s*(rgb|hsl|hex)\b/i)) && m[2].toLowerCase() !== "hex"){
    hex = m[1]; r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
    return out(hex, r, g, b);
  }
  if((m = s.match(/^rgb\s*\(?\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)?\s*(?:in|als|zu|→|->)\s*(hex|hexadezimal|hexadecimal)\b/i)) ||
     (m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\s*[.!?]?$/i))){
    if(m.length === 5){ r = +m[1]; g = +m[2]; b = +m[3]; }
    else {
      let h = m[1]; if(h.length === 3) h = h.split("").map(x => x + x).join("");
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    }
    if(r > 255 || g > 255 || b > 255) return null;
    hex = [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
    return out(hex, r, g, b);
  }
  return null;
}

/* ---------------- Netto/Brutto & Preisvergleich ---------------- */
function vatTool(t){
  const s = t.trim().replace(/\s+/g, " ");
  const N = "(\\d+(?:[.,]\\d+)?)", M = "\\s*(?:€|euro|eur)?\\s*";
  let m;
  if((m = s.match(new RegExp("^" + N + M + "brutto\\s*(?:mit|bei|und|zzgl\\.?)?\\s*(?:" + N + "\\s*(?:%|prozent)?)?\\s*(?:mwst|mehrwertsteuer|ust|steuer)?\\s*[.!?]?$", "i")))){
    const gross = toNum(m[1]), rate = m[2] != null ? toNum(m[2]) : 19;
    const net = gross / (1 + rate / 100);
    return { text: "**" + fmtN(gross, 2) + " € brutto** bei " + fmtN(rate) + " %\n\n- Netto: **" + fmtN(net, 2) + " €**\n- Steuer: " + fmtN(gross - net, 2) + " €\n\nRechnung: Brutto ÷ (1 + " + fmtN(rate) + "/100)", source:"vat", val:net };
  }
  if((m = s.match(new RegExp("^" + N + M + "netto\\s*(?:mit|zzgl\\.?|plus|und)?\\s*(?:\\s*" + N + "\\s*(?:%|prozent)?)?\\s*(?:mwst|mehrwertsteuer|ust|steuer)?\\s*(?:brutto)?\\s*[.!?]?$", "i")))){
    const net = toNum(m[1]), rate = m[2] != null ? toNum(m[2]) : 19;
    const gross = net * (1 + rate / 100);
    return { text: "**" + fmtN(net, 2) + " € netto** bei " + fmtN(rate) + " %\n\n- Brutto: **" + fmtN(gross, 2) + " €**\n- Steuer: " + fmtN(gross - net, 2) + " €\n\nRechnung: Netto × (1 + " + fmtN(rate) + "/100)", source:"vat", val:gross };
  }
  return null;
}
function priceTool(t){
  const m = t.trim().match(/^(?:was\s+ist\s+(?:günstiger|guenstiger|billiger)|welche[sr]?\s+ist\s+(?:das\s+)?(?:günstiger|guenstiger|billiger)|vergleiche\s+die\s+preise|preisvergleich)\s*[:,]?\s+(.+)$/i);
  if(!m) return null;
  const opts = m[1].replace(/\s+oder\s+/gi, "|").split("|").map(x => x.trim().replace(/[?!.]+$/, "")).filter(Boolean);
  const parsed = opts.map(o => {
    const x = o.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zäöüß°%²³\/\.]{0,10})\s*für\s+(\d+(?:[.,]\d+)?)\s*(?:€|euro|eur)?\s*$/i);
    return x ? { q:toNum(x[1]), u:x[2].trim(), p:toNum(x[3]), raw:o } : null;
  });
  if(parsed.length < 2 || parsed.some(x => !x || x.q <= 0)) return null;
  const per = parsed.map(x => x.p / x.q);
  const best = per.indexOf(Math.min(...per));
  const worst = per.indexOf(Math.max(...per));
  const savePct = per[worst] ? (1 - per[best] / per[worst]) * 100 : 0;
  const unit = parsed[best].u || "Einheit";
  return { text: "**" + parsed[best].raw + " ist günstiger.**\n\n" +
    parsed.map((x, i) => "- " + x.raw + " → " + fmtN(per[i], 4) + " € pro " + (x.u || "Einheit") + (i === best ? " ✔️" : "")).join("\n") +
    "\n\nGünstigerer Preis: **" + fmtN(savePct, 1) + " %** pro " + unit + " sparen.", source:"price", val:per[best] };
}

/* ---------------- Passwort- & PIN-Generator ---------------- */
const PW_SETS = {
  lower:"abcdefghijklmnopqrstuvwxyz",
  upper:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits:"0123456789",
  symbols:"!@#$%&*+-_=?"
};
function pwRandom(max){                       // unverzerrter Zufall 0..max-1
  const a = new Uint32Array(1), lim = Math.floor(4294967296 / max) * max;
  let v; do { crypto.getRandomValues(a); v = a[0]; } while(v >= lim);
  return v % max;
}
function passTool(t){
  let s = t.trim().replace(/\s+/g, " ");
  /* „6-stellige PIN“ / „20-Zeichen Passwort“ → Normalform „… mit N stellen/zeichen“ */
  s = s.replace(/(\d{1,2})\s*-?\s*stellig\w*\s+(pin|geheimzahl|geheimcode)\b/i, "$2 mit $1 stellen")
       .replace(/(\d{1,3})\s*-?\s*zeichen\s+(passwort|kennwort|password)\b/i, "$2 mit $1 zeichen");
  let isPin = false, len = null, mode = "full";
  const PRE = "(?:(?:bitte\\s+)?(?:(?:generier|erstell|erzeug|mach|gib)(?:e|st|en)?\\s+(?:mir\\s+)?|noch(?:mal)?\\s+(?:ein(?:e|en|em|es)?\\s+)?|erneut\\s+(?:ein(?:e|en|em|es)?\\s+)?|weiteres?\\s+|zweite[rsn]?\\s+|andere[rsn]?\\s+|zufälliges?\\s+|zufaelliges?\\s+|sicheres?\\s+|starkes?\\s+|neues?\\s+|gutes?\\s+|ein(?:e|en|em|es)?\\s+|das\\s+|mein(?:e|en|em|es)?\\s+|bitte\\s+)*)?";
  const PIN_TRIG = new RegExp("^" + PRE + "(?:pin|geheimzahl|geheimcode)(?:\\s+(?:mit\\s+|von\\s+)?(\\d{1,2})\\s*(?:-?stellig\\w*|ziffern|stellen))?\\s*[.!]?$", "i");
  const PW_TAIL = "(?:\\s+((?:ohne|nur|mit|aus|von|bitte|danke|für|fuer|stark\\w*|sicher\\w*|lang\\w*|kurz\\w*|gut\\w*|neu\\w*|zufällig\\w*|zufaellig\\w*|anderes\\w*|zweites?|ziffern|zeichen|stellen|buchstaben|sonderzeichen|nochmal|erneut)[^.!?]*))?";
  const PW_TRIG = new RegExp("^" + PRE + "(?:passwort|kennwort|password)(?:\\s+(?:mit\\s+|aus\\s+|von\\s+)?(\\d{1,3})\\s*(-?zeichen|buchstaben|stellen|ziffern))?" + PW_TAIL + "\\s*[.!]?$", "i");
  const pinM = s.match(PIN_TRIG), pwM = s.match(PW_TRIG);
  if(pinM){
    isPin = true;
    len = parseInt(pinM[1] || "6", 10);
    if(!(len >= 3 && len <= 12)) return { text: "Eine PIN braucht zwischen 3 und 12 Stellen.", source:"pw" };
    mode = "digits";
  } else if(pwM){
    const rest = (pwM[3] || "").toLowerCase();
    const restLen = rest.match(/(\d{1,3})\s*(?:-?zeichen|buchstaben|stellen|ziffern)/);
    len = pwM[1] ? parseInt(pwM[1], 10) : restLen ? parseInt(restLen[1], 10) : 16;
    if(!(len >= 6 && len <= 128)) return { text: "Ein Passwort braucht zwischen 6 und 128 Zeichen.", source:"pw" };
    if(pwM[2] && /ziffern/.test(pwM[2])) mode = "digits";
    else if(/ohne\s+sonderzeichen/.test(rest)) mode = "plain";
    else if(/nur\s+(?:mit\s+)?(?:\d{1,3}\s+)?(?:ziffern|zahlen)/.test(rest)) mode = "digits";
    else if(/nur\s+(?:mit\s+)?(?:\d{1,3}\s+)?buchstaben/.test(rest)) mode = "letters";
    if(/(?:mit\s+)?sonderzeichen/.test(rest) && !/ohne\s+sonderzeichen/.test(rest)) mode = "full";
  } else return null;
  const keys = mode === "digits" ? ["digits"] : mode === "letters" ? ["lower","upper"] : mode === "plain" ? ["lower","upper","digits"] : ["lower","upper","digits","symbols"];
  const pool = keys.map(k => PW_SETS[k]).join("");
  let out = "";
  for(let i = 0; i < len; i++) out += pool.charAt(pwRandom(pool.length));
  const bits = Math.round(len * Math.log2(pool.length));
  const strength = bits < 30 ? "einfach" : bits < 45 ? "mittel" : bits < 70 ? "stark" : "sehr stark";
  const label = isPin ? "PIN (" + len + " Ziffern)" : "Passwort (" + len + " Zeichen)";
  return { text: "Hier ist dein zufälliges **" + label + "**:\n\n```text\n" + out + "\n```\n\n**Stärke:** " + strength + " · ≈ " + bits + " Bit Entropie" +
    (isPin ? "\n\n_Eine kurze PIN eignet sich für Geräte, nicht für Konten – dort lieber ein langes Passwort._" : "\n\n_Tipp: Jedes Konto bekommt ein eigenes Passwort – am besten in einem Passwort-Manager._") +
    "\n\nMit „Kopieren“ unten übernimmst du ihn direkt.", source:"pw",
    widget:{ type:"pw", text:out, label, req:s } };
}

/* Alle Zusatzwerkzeuge in fester Reihenfolge */
/* ---------------- Diagramme (offline, SVG) ---------------- */
const CHART_PALETTE = ["#2c67c5", "#22a06b", "#e8833a", "#8b5cf6", "#e05263", "#0ea5e9", "#f0b429", "#64748b", "#14b8a6", "#f472b6"];
function chartParse(str){
  const s = String(str || "").trim().replace(/\s+/g, " ");
  if(!s) return null;
  const raw = /[a-zäöüß]/i.test(s) ? s.split(/[;,]\s+|;/).map(x => x.trim()).filter(Boolean) : (s.match(/-?\d+(?:[.,]\d+)?/g) || []);
  const items = [];
  for(const e of raw){
    const m = e.match(/^(.*?)[\s:]*(-?\d+(?:[.,]\d+)?)\s*$/);
    if(!m) return null;
    const label = (m[1] || "").replace(/^[:=\-\s]+|[:=\s]+$/g, "").trim();
    items.push({ label: label || String(items.length + 1), v: toNum(m[2]) });
    if(!isFinite(items[items.length - 1].v)) return null;
  }
  return (items.length >= 2 && items.length <= 24) ? items : null;
}
function chartNiceTop(v){
  if(!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function chartShort(s, max){ s = String(s); return s.length > max ? s.slice(0, max - 1) + "…" : s; }
function chartSvg(type, items){
  const W = 680, H = type === "pie" ? 380 : 400, F = 'font-family="sans-serif"';
  let body = '<rect width="' + W + '" height="' + H + '" rx="18" fill="#fff"/>';
  if(type === "pie"){
    const total = items.reduce((a, b) => a + Math.max(0, b.v), 0) || 1;
    const cx = 210, cy = H / 2, r = 140;
    let ang = -Math.PI / 2;
    items.forEach((it, i) => {
      const frac = Math.max(0, it.v) / total, a2 = ang + frac * Math.PI * 2;
      const col = CHART_PALETTE[i % CHART_PALETTE.length];
      if(frac > 0.0001){
        const x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang), x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        const d = frac >= 0.9999
          ? "M" + (cx - r) + " " + cy + " A" + r + " " + r + " 0 1 1 " + (cx + r) + " " + cy + " A" + r + " " + r + " 0 1 1 " + (cx - r) + " " + cy + " Z"
          : "M" + cx + " " + cy + " L" + x1.toFixed(1) + " " + y1.toFixed(1) + " A" + r + " " + r + " 0 " + (frac > 0.5 ? 1 : 0) + " 1 " + x2.toFixed(1) + " " + y2.toFixed(1) + " Z";
        body += '<path d="' + d + '" fill="' + col + '"/>';
        if(frac >= 0.07){
          const mid = (ang + a2) / 2, lr = r * 0.62;
          body += '<text x="' + (cx + lr * Math.cos(mid)).toFixed(1) + '" y="' + (cy + lr * Math.sin(mid) + 5).toFixed(1) + '" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" ' + F + ">" + Math.round(frac * 100) + "%</text>";
        }
      }
      ang = a2;
    });
    items.forEach((it, i) => {
      const y = cy - (items.length * 32) / 2 + i * 32 + 16;
      body += '<rect x="412" y="' + (y - 12) + '" width="13" height="13" rx="3.5" fill="' + CHART_PALETTE[i % CHART_PALETTE.length] + '"/>' +
        '<text x="436" y="' + y + '" font-size="15" fill="#333" ' + F + ">" + esc(chartShort(it.label, 16)) + " · " + fmtN(it.v) + "</text>";
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' + body + "</svg>";
  }
  const padL = 48, padR = 16, padT = 22, padB = 46;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max.apply(null, items.map(i => i.v));
  const top = chartNiceTop(Math.max(max, 0) || 1);
  const yOf = v => padT + ih * (1 - v / top);
  for(let g = 0; g <= 4; g++){
    const v = top * g / 4, y = yOf(v);
    body += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="' + (g === 0 ? "#c9cdd4" : "#eceff3") + '" stroke-width="1"/>' +
      '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="#8a9099" ' + F + ">" + fmtN(v, v % 1 ? 1 : 0) + "</text>";
  }
  const n = items.length, slot = iw / n;
  if(type === "line"){
    const pts = items.map((it, i) => [padL + slot * i + slot / 2, yOf(it.v)]);
    const poly = pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    body += '<polygon points="' + padL + "," + (padT + ih) + " " + poly + " " + (padL + iw) + "," + (padT + ih) + '" fill="rgba(44,103,197,.12)"/>' +
      '<polyline points="' + poly + '" fill="none" stroke="#2c67c5" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    items.forEach((it, i) => {
      body += '<circle cx="' + pts[i][0].toFixed(1) + '" cy="' + pts[i][1].toFixed(1) + '" r="5" fill="#fff" stroke="#2c67c5" stroke-width="3"/>' +
        '<text x="' + pts[i][0].toFixed(1) + '" y="' + (pts[i][1] - 11).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="600" fill="#333" ' + F + ">" + fmtN(it.v) + "</text>" +
        '<text x="' + pts[i][0].toFixed(1) + '" y="' + (padT + ih + 24) + '" text-anchor="middle" font-size="12" fill="#666" ' + F + ">" + esc(chartShort(it.label, 10)) + "</text>";
    });
  } else {
    const bw = Math.min(slot * 0.58, 72);
    items.forEach((it, i) => {
      const x = padL + slot * i + (slot - bw) / 2, y = yOf(Math.max(0, it.v)), h = Math.max(2, padT + ih - y);
      body += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="5" fill="#2c67c5"/>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 7).toFixed(1) + '" text-anchor="middle" font-size="13" font-weight="600" fill="#333" ' + F + ">" + fmtN(it.v) + "</text>" +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (padT + ih + 24) + '" text-anchor="middle" font-size="12" fill="#666" ' + F + ">" + esc(chartShort(it.label, 10)) + "</text>";
    });
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' + body + "</svg>";
}
function chartTool(t){
  const s = t.trim().replace(/\s+/g, " ");
  const m = s.match(/^(?:(?:erstelle?|mach|zeichne?|generiere?)\s+(?:mir\s+)?(?:ein\s+)?|ein\s+)?(balken|säulen|saeulen|linien|linie|verlaufs|torten|kreis|kuchen)?-?(?:diagramm|chart|graph)\s*(?:[:,]\s*|(?:für|von|mit|über|zu)\s+)?(.+)$/i);
  if(!m) return null;
  let type = "bar";
  if(/linien|linie|verlauf/i.test(m[1] || "")) type = "line";
  else if(/torten|kreis|kuchen/i.test(m[1] || "")) type = "pie";
  const items = chartParse(m[2]);
  if(!items) return { text: "Die Zahlen habe ich nicht verstanden – so klappt's: **„Diagramm: Äpfel 5, Birnen 8, Kirschen 3“** (ebenso `Tortendiagramm` und `Liniendiagramm`, 2 bis 24 Datenpunkte).", source:"chart" };
  if(type !== "line" && items.some(it => it.v < 0)) return { text: "Für Balken- und Tortendiagramme brauche ich Werte ab 0.", source:"chart" };
  if(type === "pie" && items.reduce((a, b) => a + b.v, 0) <= 0) return { text: "Für ein Tortendiagramm muss die Summe über 0 liegen.", source:"chart" };
  const kind = type === "pie" ? "Tortendiagramm" : type === "line" ? "Liniendiagramm" : "Balkendiagramm";
  const lo = Math.min.apply(null, items.map(i => i.v)), hi = Math.max.apply(null, items.map(i => i.v));
  return { text: "**" + kind + "** mit " + items.length + " Datenpunkten (Werte " + fmtN(lo) + "–" + fmtN(hi) + ").\n\n„Bild speichern“ unten lädt das Diagramm als PNG.", source:"chart",
    widget:{ type:"chart", svg: chartSvg(type, items), label: kind } };
}

/* ---------------- Checklisten (interaktive Widgets) ---------------- */
function listFind(name){
  const q = norm(name);
  let hit = cfg.checklists.find(x => norm(x.name) === q);
  if(!hit) hit = cfg.checklists.find(x => norm(x.name).indexOf(q) > -1 || q.indexOf(norm(x.name)) > -1);
  return hit || null;
}
function listTool(t){
  const s = t.trim().replace(/\s+/g, " ");
  let m;
  if((m = s.match(/^(?:(?:lösche|loesche|entferne|vergiss)\s+(?:die\s+|meine\s+)?(?:checkliste?|liste?)\s+(.+?)|(?:checkliste?|liste?)\s+(.+?)\s+(?:löschen|loeschen|entfernen))\s*[.!]?$/i))){
    const L = listFind(m[1] || m[2]);
    if(!L) return { text: "Eine Liste namens „" + (m[1] || m[2]).trim() + "“ gibt es nicht.", source:"list" };
    return { text: "Erledigt – Liste „" + L.name + "“ gelöscht.", source:"list",
      effect: () => { cfg.checklists = cfg.checklists.filter(x => x !== L); saveCfg(); } };
  }
  if((m = s.match(/^(?:füge|fuege|ergänze|ergaenze)\s+(.+?)\s+(?:zu|zum|zur|in)\s+(?:der|die|dem|den)?\s*(?:checkliste?|liste?)\s+(.+?)\s+hinzu\s*[.!]?$/i)) ||
     (m = s.match(/^(?:(?:zu|zum|zur|in)\s+)?(?:der|die|dem|den)?\s*(?:checkliste?|liste?)\s+(.+?)\s*[:,]?\s*(?:füge|fuege|ergänze|ergaenze)\s+(.+?)\s+hinzu\s*[.!]?$/i)) ||
     (m = s.match(/^(?:(?:zu|zum|zur|in)\s+)?(?:der|die|dem|den)?\s*(?:checkliste?|liste?)\s+(.+?)\s*[:,]\s*\+\s*(.+?)\s*[.!]?$/i)) ||
     (m = s.match(/^(?:checkliste?|liste?)\s+(.+?)\s*[:,]\s*(?:füge|fuege|ergänze|ergaenze)\s+(.+?)\s+hinzu\s*[.!]?$/i))){
    const name = m[1].trim(), adds = m[2].split(/[,;]\s+| und /).map(x => x.trim()).filter(Boolean).slice(0, 20);
    if(!adds.length) return { text: "Ich habe keinen Eintrag verstanden – sag z. B. **„Zur Liste Einkauf füge Milch hinzu“**.", source:"list" };
    let L = listFind(name);
    if(!L){ L = { name: name.slice(0, 30), items: [] }; cfg.checklists.push(L); }
    adds.forEach(t2 => { if(!L.items.some(i => norm(i.t) === norm(t2))) L.items.push({ t: t2.slice(0, 60), done: false }); });
    saveCfg();
    return { text: "Zu **„" + L.name + "**“ hinzugefügt: " + adds.map(x => "„" + x + "“").join(", ") + " (" + L.items.length + " " + (L.items.length === 1 ? "Eintrag" : "Einträge") + ").", source:"list", widget:{ type:"list", name: L.name } };
  }
  if(/^(?:(?:zeige?|zeig)(?:\s+mir)?\s+)?(?:meine\s+|alle\s+)?(?:checklisten|listen|einkaufslisten)\s*[.!]?$/i.test(s)){
    if(!cfg.checklists.length) return { text: "Du hast noch keine Listen. Sag z. B. **„Checkliste Einkauf: Milch, Brot, Butter“**.", source:"list" };
    return { text: "Deine Listen:\n\n" + cfg.checklists.map(x => "- **" + x.name + "** – " + x.items.filter(i => i.done).length + "/" + x.items.length + " erledigt").join("\n"), source:"list" };
  }
  if((m = s.match(/^(?:zeige?|zeig)(?:\s+mir)?\s+(?:die\s+)?(?:checkliste?|liste?)\s+(.+?)\s*[.!]?$/i)) ||
     (m = s.match(/^(?:checkliste?|liste?)\s+(.+?)\s+anzeigen\s*[.!]?$/i))){
    const L = listFind(m[1]);
    if(!L) return { text: "Eine Liste namens „" + m[1].trim() + "“ gibt es nicht.", source:"list" };
    return { text: "Hier ist deine Liste **„" + L.name + "**“ – im Widget kannst du abhaken und ergänzen.", source:"list", widget:{ type:"list", name: L.name } };
  }
  if((m = s.match(/^(?:(?:neue?\s+|erstelle?\s+|lege?\s+|mach\s+)(?:eine?\s+)?)?(?:checkliste?|liste?)\s+(.+?)\s*[:,]\s+(.+?)\s*[.!]?$/i))){
    const name = m[1].trim().slice(0, 30);
    const adds = m[2].split(/[,;]\s+| und /).map(x => x.trim()).filter(Boolean).slice(0, 40);
    if(!adds.length) return { text: "Ich brauche mindestens einen Eintrag – z. B. **„Checkliste Einkauf: Milch, Brot, Butter“**.", source:"list" };
    const L = listFind(name), items = adds.map(t2 => ({ t: t2.slice(0, 60), done: false }));
    if(L) L.items = items; else cfg.checklists.push({ name, items });
    saveCfg();
    return { text: "Liste **„" + name + "**“ " + (L ? "ersetzt" : "angelegt") + " (" + items.length + " " + (items.length === 1 ? "Eintrag" : "Einträge") + "). Im Widget kannst du abhaken und ergänzen.", source:"list", widget:{ type:"list", name } };
  }
  if((m = s.match(/^(?:(?:neue?\s+|erstelle?\s+|lege?\s+|mach\s+)(?:eine?\s+)?)?(?:checkliste?|liste?)\s+([A-Za-zÄÖÜäöüß0-9 _-]{1,30})\s*[.!]?$/i))){
    const name = m[1].trim(), L = listFind(name);
    if(L) return { text: "Hier ist deine Liste **„" + L.name + "**“.", source:"list", widget:{ type:"list", name: L.name } };
    cfg.checklists.push({ name, items: [] });
    saveCfg();
    return { text: "Neue Liste **„" + name + "**“ angelegt – füge Einträge im Widget hinzu oder sag z. B. **„Zur Liste " + name + " füge Milch hinzu“**.", source:"list", widget:{ type:"list", name } };
  }
  return null;
}

function EXTRA_TOOLS(t){ return qrTool(t) || passTool(t) || chartTool(t) || listTool(t) || timerTool(t) || randomTool(t) || baseTool(t) || colorTool(t) || vatTool(t) || priceTool(t); }

/* ---------------- Regel-Testsuite ---------------- */
function testQueryFor(pat){
  const raw = String(pat).trim();
  if(!raw) return null;
  if(raw.charAt(0) === "~") return null;                                   // RegEx: kein Beispieltext
  if(raw.charAt(0) === "=") return raw.slice(1);
  if(/\{x\}/i.test(raw)) return raw.replace(/\{x\}/gi, "Test");            // Beispiel-Ersatz
  if(raw.indexOf("&") > -1) return raw.split("&").map(x => x.trim()).join(" ");
  return raw;
}
export function runRuleTests(){
  const rows = [];
  cfg.pairs.forEach(p => {
    const resp = variantsOf(p.response);
    if(p.enabled === false){ rows.push({ p, q:"–", ok:"off", msg:"Regel ist deaktiviert" }); return; }
    if(!p.patterns.length){ rows.push({ p, q:"–", ok:"warn", msg:"Keine Stichwörter – Regel greift nie" }); return; }
    if(!resp.length){ rows.push({ p, q:"–", ok:"warn", msg:"Keine Antwort hinterlegt" }); return; }
    p.patterns.forEach(pat => {
      const q = testQueryFor(pat);
      if(q === null){ rows.push({ p, q:pat, ok:"skip", msg:"RegEx wird nicht mitgetestet" }); return; }
      const hit = findRule(q);
      if(!hit) rows.push({ p, q, ok:"bad", msg:"Greift nicht mehr (Score zu niedrig?)" });
      else if(hit.rule === p) rows.push({ p, q, ok:"good", msg:"✓ greift" + (resp.length > 1 ? " · " + resp.length + " Varianten" : "") });
      else rows.push({ p, q, ok:"warn", msg:"„" + ruleTitle(hit.rule) + "“ gewinnt (Priorität " + (hit.prio || 0) + ")" });
    });
  });
  return rows;
}

/* =====================================================================
   QR-Code-Werkzeug (offline)
   Echter QR-Encoder (Byte/Alphanumerisch/Numerisch, Reed-Solomon,
   Maskenwahl nach Spec) + Werkzeug für den Chat:
   „QR-Code für …“, „QR WLAN: Name=…; Passwort=…“ (scannbares WLAN)
   ===================================================================== */
export const Qr: QrApi = (() => {
  const ECC = { L:{ ord:0, fmt:1 }, M:{ ord:1, fmt:0 }, Q:{ ord:2, fmt:3 }, H:{ ord:3, fmt:2 } };
  const ECC_CODEWORDS_PER_BLOCK = [
    [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  ];
  const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,5,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
  ];
  const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  const getBit = (x, i) => ((x >>> i) & 1) !== 0;
  function gfMul(x, y){
    let z = 0;
    for(let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z & 0xFF;
  }
  function rsDivisor(degree){
    const result = new Uint8Array(degree); result[degree - 1] = 1;
    let root = 1;
    for(let i = 0; i < degree; i++){
      for(let j = 0; j < degree; j++){
        result[j] = gfMul(result[j], root);
        if(j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor){
    const result = new Uint8Array(divisor.length);
    for(const b of data){
      const factor = b ^ result[0];
      result.copyWithin(0, 1); result[result.length - 1] = 0;
      for(let i = 0; i < result.length; i++) result[i] ^= gfMul(divisor[i], factor);
    }
    return result;
  }
  function numRawDataModules(ver){
    let result = (16 * ver + 128) * ver + 64;
    if(ver >= 2){
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if(ver >= 7) result -= 36;
    }
    return result;
  }
  const numDataCodewords = (ver, ecl) => Math.floor(numRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl.ord][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl.ord][ver];
  function alignPositions(ver){
    if(ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    const size = ver * 4 + 17;
    for(let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }
  function utf8(str){
    const out = [];
    for(const ch of str){
      let c = ch.codePointAt(0);
      if(c < 0x80) out.push(c);
      else if(c < 0x800){ out.push(0xC0 | c >> 6, 0x80 | c & 63); }
      else if(c < 0x10000){ out.push(0xE0 | c >> 12, 0x80 | (c >> 6) & 63, 0x80 | c & 63); }
      else out.push(0xF0 | c >> 18, 0x80 | (c >> 12) & 63, 0x80 | (c >> 6) & 63, 0x80 | c & 63);
    }
    return out;
  }
  function pickMode(text){
    if(/^[0-9]+$/.test(text)) return "num";
    if([...text].every(c => ALNUM.indexOf(c) > -1)) return "alnum";
    return "byte";
  }
  function segBits(mode, len, ver){
    const cc = mode === "num" ? (ver < 10 ? 10 : ver < 27 ? 12 : 14)
      : mode === "alnum" ? (ver < 10 ? 9 : ver < 27 ? 11 : 13)
      : (ver < 10 ? 8 : 16);
    const dataBits = mode === "num" ? Math.floor(len / 3) * 10 + [0, 4, 7][len % 3]
      : mode === "alnum" ? Math.floor(len / 2) * 11 + (len % 2) * 6
      : len * 8;
    return 4 + cc + dataBits;
  }
  function writeSeg(bits, mode, text, ver){
    const push = (val, n) => { for(let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    const modeBits = { num:1, alnum:2, byte:4 }[mode];
    push(modeBits, 4);
    const len = mode === "byte" ? utf8(text).length : text.length;
    const cc = mode === "num" ? (ver < 10 ? 10 : ver < 27 ? 12 : 14)
      : mode === "alnum" ? (ver < 10 ? 9 : ver < 27 ? 11 : 13)
      : (ver < 10 ? 8 : 16);
    push(len, cc);
    if(mode === "num"){
      for(let i = 0; i < text.length; i += 3){
        const chunk = text.slice(i, i + 3);
        push(parseInt(chunk, 10), [0, 4, 7, 10][chunk.length]);
      }
    } else if(mode === "alnum"){
      for(let i = 0; i < text.length; i += 2){
        const a = ALNUM.indexOf(text[i]);
        if(i + 1 < text.length) push(a * 45 + ALNUM.indexOf(text[i + 1]), 11);
        else push(a, 6);
      }
    } else {
      utf8(text).forEach(b => push(b, 8));
    }
  }
  function encode(text, eclKey){
    const ecl = ECC[String(eclKey || "M").toUpperCase()] || ECC.M;
    const mode = pickMode(text);
    let ver = 0;
    for(let v = 1; v <= 40; v++){
      if(segBits(mode, mode === "byte" ? utf8(text).length : text.length, v) <= numDataCodewords(v, ecl) * 8){ ver = v; break; }
    }
    if(!ver) throw new Error("Der Text ist zu lang für einen QR-Code (maximal ~2.900 Zeichen).");
    const capacity = numDataCodewords(ver, ecl) * 8;
    const bits = [];
    writeSeg(bits, mode, text, ver);
    for(let i = 0; i < 4 && bits.length < capacity; i++) bits.push(0);      // Terminator
    while(bits.length % 8) bits.push(0);                                    // auffüllen
    const dataBytes = [];
    for(let i = 0; i < bits.length; i += 8){
      let b = 0; for(let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dataBytes.push(b);
    }
    for(let pad = 0xEC; dataBytes.length < numDataCodewords(ver, ecl); pad ^= 0xEC ^ 0x11) dataBytes.push(pad);
    /* ECC + Interleaving */
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ord][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ord][ver];
    const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const blocks = [];
    const divisor = rsDivisor(blockEccLen);
    let k = 0;
    for(let i = 0; i < numBlocks; i++){
      const dat = dataBytes.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if(i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(Array.from(ecc)));
    }
    const allBytes = [];
    for(let i = 0; i < blocks[0].length; i++){
      blocks.forEach((block, j) => {
        if(i !== shortBlockLen - blockEccLen || j >= numShortBlocks) allBytes.push(block[i]);
      });
    }
    /* Matrix */
    const size = ver * 4 + 17;
    const modules = Array.from({ length:size }, () => Array(size).fill(false));
    const isFn = Array.from({ length:size }, () => Array(size).fill(false));
    const setFn = (x, y, dark) => {
      if(x < 0 || y < 0 || x >= size || y >= size) return;
      modules[y][x] = dark; isFn[y][x] = true;
    };
    const finder = (x, y) => {
      for(let dy = -4; dy <= 4; dy++) for(let dx = -4; dx <= 4; dx++){
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(x + dx, y + dy, dist !== 2 && dist !== 4);
      }
    };
    for(let i = 0; i < size; i++){ setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const aps = alignPositions(ver);
    for(let i = 0; i < aps.length; i++) for(let j = 0; j < aps.length; j++){
      if((i === 0 && j === 0) || (i === 0 && j === aps.length - 1) || (i === aps.length - 1 && j === 0)) continue;
      for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++)
        setFn(aps[i] + dx, aps[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const drawFormat = mask => {
      const data = ecl.fmt << 3 | mask;
      let rem = data;
      for(let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bts = ((data << 10) | rem) ^ 0x5412;
      for(let i = 0; i <= 5; i++) setFn(8, i, getBit(bts, i));
      setFn(8, 7, getBit(bts, 6)); setFn(8, 8, getBit(bts, 7)); setFn(7, 8, getBit(bts, 8));
      for(let i = 9; i < 15; i++) setFn(14 - i, 8, getBit(bts, i));
      for(let i = 0; i < 8; i++) setFn(size - 1 - i, 8, getBit(bts, i));
      for(let i = 8; i < 15; i++) setFn(8, size - 15 + i, getBit(bts, i));
      setFn(8, size - 8, true);
    };
    drawFormat(0);
    if(ver >= 7){
      let rem = ver;
      for(let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bts = ver << 12 | rem;
      for(let i = 0; i < 18; i++){
        const dark = getBit(bts, i), a = size - 11 + i % 3, bb = Math.floor(i / 3);
        setFn(a, bb, dark); setFn(bb, a, dark);
      }
    }
    /* Codewords im Zickzack */
    let bi = 0;
    for(let right = size - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(let vert = 0; vert < size; vert++){
        for(let j = 0; j < 2; j++){
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if(!isFn[y][x] && bi < allBytes.length * 8){
            modules[y][x] = getBit(allBytes[bi >>> 3], 7 - (bi & 7));
            bi++;
          }
        }
      }
    }
    /* Maskierung: beste der 8 Masken wählen */
    const maskFns = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x, y) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0,
      (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
    ];
    const applyMask = mask => {
      for(let y = 0; y < size; y++) for(let x = 0; x < size; x++)
        if(!isFn[y][x] && maskFns[mask](x, y)) modules[y][x] = !modules[y][x];
    };
    const penalty = () => {
      let result = 0;
      const countHist = hist => {
        const n = hist[1];
        const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
        return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0) + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
      };
      const addHist = (len, hist) => { if(hist[0] === 0) len += size; hist.pop(); hist.unshift(len); };
      const term = (color, len, hist) => { if(color){ addHist(len, hist); len = 0; } len += size; addHist(len, hist); return countHist(hist); };
      for(let y = 0; y < size; y++){
        let color = false, run = 0; const hist = [0, 0, 0, 0, 0, 0, 0];
        for(let x = 0; x < size; x++){
          if(modules[y][x] === color){
            run++;
            if(run === 5) result += 3; else if(run > 5) result++;
          } else {
            addHist(run, hist);
            if(!color) result += countHist(hist) * 40;
            color = modules[y][x]; run = 1;
          }
        }
        result += term(color, run, hist) * 40;
      }
      for(let x = 0; x < size; x++){
        let color = false, run = 0; const hist = [0, 0, 0, 0, 0, 0, 0];
        for(let y = 0; y < size; y++){
          if(modules[y][x] === color){
            run++;
            if(run === 5) result += 3; else if(run > 5) result++;
          } else {
            addHist(run, hist);
            if(!color) result += countHist(hist) * 40;
            color = modules[y][x]; run = 1;
          }
        }
        result += term(color, run, hist) * 40;
      }
      for(let y = 0; y < size - 1; y++) for(let x = 0; x < size - 1; x++){
        const c = modules[y][x];
        if(c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3;
      }
      let dark = 0;
      modules.forEach(row => row.forEach(c => { if(c) dark++; }));
      const total = size * size;
      result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return result;
    };
    let bestMask = 0, minPenalty = Infinity;
    for(let mask = 0; mask < 8; mask++){
      applyMask(mask); drawFormat(mask);
      const p = penalty();
      if(p < minPenalty){ minPenalty = p; bestMask = mask; }
      applyMask(mask);
    }
    applyMask(bestMask); drawFormat(bestMask);
    return { size, modules, version:ver, ecl:eclKey || "M" };
  }
  function toSvg(q, px){
    const quiet = 4, total = q.size + quiet * 2;
    let rects = "";
    for(let y = 0; y < q.size; y++){
      let x = 0;
      while(x < q.size){
        if(q.modules[y][x]){
          let run = 1;
          while(x + run < q.size && q.modules[y][x + run]) run++;
          rects += "M" + (x + quiet) + " " + (y + quiet) + "h" + run + "v1h-" + run + "z";
          x += run;
        } else x++;
      }
    }
    return '<svg viewBox="0 0 ' + total + " " + total + '" width="' + (px || "100%") + '" shape-rendering="crispEdges" role="img" aria-label="QR-Code">' +
      '<rect width="' + total + '" height="' + total + '" fill="#fff"/><path d="' + rects + '" fill="#000"/></svg>';
  }
  return { encode, toSvg };
})();

/* ---------------- Werkzeug ---------------- */
function qrTool(t){
  const s = t.trim();
  if(!/\bqr\b|\bqrcode\b/i.test(s)) return null;
  let m, payload = null, caption = "QR-Code";
  if((m = s.match(/^(?:(?:erstelle|erzeuge|mach|generiere|zeichne)(?:\s+mir)?(?:\s+bitte)?\s+)?(?:einen?\s+)?(?:qr[-\s]?code|qr)\s*(?:für|zu)?\s*wlan\s*[:,]\s*(?:name|ssid)\s*=\s*([^;,]+?)\s*[;,]\s*(?:passwort|password|pass|key)\s*=\s*([^;]+?)\s*[;,]?\s*(?:(?:verschlüsselung|sicherheit|typ)\s*=\s*(wpa2?|wep|nopass))?\s*$/i))){
    const ssid = m[1].trim(), pass = m[2].trim();
    let sec = (m[3] || "WPA").toUpperCase();
    if(sec === "WPA2") sec = "WPA";
    payload = "WIFI:S:" + ssid.replace(/([\\;,:"])/g, "\\$1") + ";T:" + sec + ";P:" + pass.replace(/([\\;,:"])/g, "\\$1") + ";;";
    caption = "WLAN „" + ssid + "“";
  } else if(/\bwifi\s*:/.test(s) && (m = s.match(/(WIFI:[\s\S]+)$/i))){
    payload = m[1].trim(); caption = "WLAN-Zugang";
  } else if((m = s.match(/^(?:(?:erstelle|erzeuge|mach|generiere|zeichne)(?:\s+mir)?(?:\s+bitte)?\s+)?(?:einen?\s+)?(?:qr[-\s]?code|qr)\s*(?:erstellen|generieren|zeichnen|machen)?\s*(?:für|von|mit|:)?\s*([\s\S]{1,800})\s*$/i))){
    payload = m[1].trim().replace(/^["„“']+|["“”']+$/g, "");
  }
  if(!payload) return { text: "Ich erstelle dir **echte, scannbare QR-Codes** – komplett offline.\n\n- `QR-Code für https://example.com`\n- `QR-Code für Treffpunkt Marktplatz, 15 Uhr`\n- `QR WLAN: Name=MeinWLAN; Passwort=geheim123` (beim Scannen wird das WLAN verbunden)\n\nDas Bild kannst du speichern und teilen.", source:"qr" };
  if(payload.length > 800) return { text: "Der Inhalt ist mit " + fmtN(payload.length) + " Zeichen zu lang für einen QR-Code (maximal 800). Kürze ihn bitte etwas.", source:"qr" };
  let q;
  try { q = Qr.encode(payload, "M"); } catch(e) { return { text: "Das konnte ich nicht in einen QR-Code verwandeln: " + e.message, source:"qr" }; }
  return { text: "Hier ist dein QR-Code für **" + caption + "** – einfach mit der Kamera scannen. 🔳",
    source:"qr", widget:{ type:"qr", text:payload, ecl:"M", caption } };
}
