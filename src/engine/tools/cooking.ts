import type { Tool } from './types';
import { NUM, clean, fmtN, toNum } from './shared';

/* Kitchen helper: cups/spoons ↔ grams with ingredient densities, recipe scaling, oven settings. */

/** Grams per US cup (240 ml) for common ingredients. */
const INGREDIENTS: Array<{ names: string[]; perCup: number; label: string }> = [
  { names: ['wasser', 'milch', 'brühe', 'bruehe', 'saft', 'wein', 'sahne', 'buttermilch'], perCup: 240, label: 'Flüssigkeit' },
  { names: ['mehl', 'weizenmehl', 'dinkelmehl'], perCup: 125, label: 'Mehl' },
  { names: ['vollkornmehl'], perCup: 130, label: 'Vollkornmehl' },
  { names: ['zucker', 'kristallzucker'], perCup: 200, label: 'Zucker' },
  { names: ['brauner zucker', 'rohrzucker'], perCup: 220, label: 'brauner Zucker' },
  { names: ['puderzucker', 'staubzucker'], perCup: 120, label: 'Puderzucker' },
  { names: ['butter', 'margarine'], perCup: 227, label: 'Butter' },
  { names: ['öl', 'oel', 'olivenöl', 'olivenoel', 'rapsöl', 'rapsoel', 'sonnenblumenöl'], perCup: 220, label: 'Öl' },
  { names: ['honig', 'sirup', 'ahornsirup', 'agavendicksaft'], perCup: 340, label: 'Honig/Sirup' },
  { names: ['haferflocken'], perCup: 90, label: 'Haferflocken' },
  { names: ['reis'], perCup: 185, label: 'Reis (roh)' },
  { names: ['kakao', 'kakaopulver'], perCup: 100, label: 'Kakao' },
  { names: ['speisestärke', 'speisestaerke', 'stärke', 'staerke', 'maisstärke', 'maisstaerke'], perCup: 128, label: 'Speisestärke' },
  { names: ['salz'], perCup: 288, label: 'Salz' },
  { names: ['paniermehl', 'semmelbrösel', 'semmelbroesel'], perCup: 110, label: 'Paniermehl' },
  { names: ['nüsse', 'nuesse', 'mandeln', 'gemahlene mandeln', 'walnüsse', 'haselnüsse'], perCup: 110, label: 'Nüsse (gemahlen/gehackt)' },
  { names: ['schokolade', 'schokodrops', 'schokotropfen'], perCup: 170, label: 'Schokolade' },
  { names: ['rosinen'], perCup: 150, label: 'Rosinen' },
  { names: ['joghurt', 'quark', 'frischkäse'], perCup: 245, label: 'Joghurt/Quark' },
  { names: ['kokosraspel', 'kokosflocken'], perCup: 80, label: 'Kokosraspel' },
  { names: ['linsen', 'bohnen', 'kichererbsen'], perCup: 190, label: 'Hülsenfrüchte (trocken)' },
  { names: ['parmesan', 'käse', 'kaese', 'geriebener käse'], perCup: 100, label: 'geriebener Käse' },
];

/** Millilitres per unit. */
const VOLUME: Record<string, number> = { cup: 240, cups: 240, tasse: 250, tassen: 250, el: 15, esslöffel: 15, essloeffel: 15, tbsp: 15, tl: 5, teelöffel: 5, teeloeffel: 5, tsp: 5, ml: 1, l: 1000, liter: 1000, 'fl oz': 29.57, floz: 29.57, pint: 473, pt: 473, quart: 946, gallone: 3785, gallon: 3785 };
const MASS: Record<string, number> = { g: 1, gramm: 1, kg: 1000, kilo: 1000, kilogramm: 1000, oz: 28.35, unze: 28.35, unzen: 28.35, lb: 453.6, lbs: 453.6, pfund: 500, pound: 453.6 };

function findIngredient(raw: string) {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  return INGREDIENTS.find((item) => item.names.some((name) => s === name || s.endsWith(` ${name}`) || s.startsWith(`${name} `))) || INGREDIENTS.find((item) => item.names.some((name) => s.includes(name))) || null;
}

const fmtAmount = (v: number): string => (v >= 100 ? fmtN(Math.round(v)) : v >= 10 ? fmtN(Math.round(v * 10) / 10) : fmtN(Math.round(v * 100) / 100));

function spoonText(ml: number): string {
  const parts: string[] = [];
  if (ml >= 250) parts.push(`${fmtAmount(ml / 250)} ${ml === 250 ? 'Tasse' : 'Tassen'}`);
  if (ml >= 15) parts.push(`${fmtAmount(ml / 15)} EL`);
  parts.push(`${fmtAmount(ml / 5)} TL`);
  return parts.join(' · ');
}

const OVEN_NOTE = '_Faustregel: Umluft ≈ Ober-/Unterhitze − 20 °C. Gasstufen: 1 ≈ 150 °C, 2 ≈ 160 °C, 3 ≈ 180 °C, 4 ≈ 200 °C, 5 ≈ 220 °C, 6 ≈ 240 °C, 7 ≈ 260 °C (Herstellerangaben beachten)._';
const GAS: Array<[number, number]> = [[1, 150], [2, 160], [3, 180], [4, 200], [5, 220], [6, 240], [7, 260], [8, 280]];

export const cookingTool: Tool = {
  id: 'cooking',
  label: 'Küche',
  help: '- **Küche:** „250 g Mehl in Cups“, „2 Cups Zucker in Gramm“, „3 EL Öl in ml“, „Rezept von 4 auf 6 Personen: 500 g Mehl, 3 Eier, 250 ml Milch“, „180 °C Umluft in Ober-/Unterhitze“',
  run(input) {
    const s = clean(input).replace(/\s+/g, ' ');
    let m: RegExpMatchArray | null;

    // Recipe scaling
    if ((m = s.match(new RegExp(`^(?:rezept|zutaten|menge)\\s*(?:umrechnen|skalieren|anpassen)?\\s*(?:von|für|fuer)?\\s*${NUM}\\s*(?:personen|portionen|stück|stueck|leute)?\\s*(?:auf|für|fuer|->|→)\\s*${NUM}\\s*(?:personen|portionen|stück|stueck|leute)?\\s*[:\\-–]\\s*(.+)$`, 'i')))) {
      const from = toNum(m[1]);
      const to = toNum(m[2]);
      if (from <= 0 || to <= 0) return null;
      const factor = to / from;
      const items = m[3].split(/\s*[,;\n]\s*|\s+und\s+/i).map((item) => item.trim()).filter(Boolean);
      const scaled = items.map((item) => {
        const replaced = item.replace(new RegExp(`${NUM}(\\s*(?:/|von)\\s*${NUM})?`, 'gi'), (whole, a) => {
          const v = toNum(a) * factor;
          return whole.replace(a, fmtAmount(v));
        });
        return `- ${replaced}${/^\D/.test(item) ? ' (keine Menge angegeben)' : ''}`;
      });
      return {
        text: `**Rezept für ${fmtN(to)} statt ${fmtN(from)} (× ${fmtN(Math.round(factor * 1000) / 1000)})**\n\n${scaled.join('\n')}\n\n_Eier & Co. sinnvoll runden; Backzeit bleibt ungefähr gleich, bei größerer Form eher länger._`,
        source: 'cooking',
        val: Math.round(factor * 1000) / 1000,
      };
    }

    // Oven conversions
    if ((m = s.match(new RegExp(`^(?:backofen\\s*:?\\s*|ofen\\s*:?\\s*)?${NUM}\\s*(?:°\\s*c|grad(?:\\s*celsius)?|°)?\\s*(umluft|heißluft|heissluft|ober-?\\s*(?:/|und)?\\s*unterhitze|ober-?\\s*unterhitze|o/u)\\s+(?:in|als|auf|zu|entspricht|=)\\s*(umluft|heißluft|heissluft|ober-?\\s*(?:/|und)?\\s*unterhitze|ober-?\\s*unterhitze|o/u|gas(?:stufe)?)$`, 'i')))) {
      const temp = toNum(m[1]);
      const fromFan = /umluft|heiß|heiss/i.test(m[2]);
      const toFan = /umluft|heiß|heiss/i.test(m[3]);
      const toGas = /gas/i.test(m[3]);
      const conventional = fromFan ? temp + 20 : temp;
      if (toGas) {
        const stage = GAS.reduce((best, cur) => (Math.abs(cur[1] - conventional) < Math.abs(best[1] - conventional) ? cur : best));
        return { text: `**${fmtN(temp)} °C ${fromFan ? 'Umluft' : 'Ober-/Unterhitze'} ≈ Gasstufe ${stage[0]}** (${conventional} °C Ober-/Unterhitze)\n\n${OVEN_NOTE}`, source: 'cooking', val: stage[0] };
      }
      const result = toFan ? conventional - 20 : conventional;
      return { text: `**${fmtN(temp)} °C ${fromFan ? 'Umluft' : 'Ober-/Unterhitze'} ≈ ${fmtN(result)} °C ${toFan ? 'Umluft' : 'Ober-/Unterhitze'}**${!fromFan && !toFan ? ' (gleiche Betriebsart)' : ''}\n\n- Gasstufe ≈ ${GAS.reduce((best, cur) => (Math.abs(cur[1] - conventional) < Math.abs(best[1] - conventional) ? cur : best))[0]} · ${fmtN(Math.round(conventional * 9 / 5 + 32))} °F\n\n${OVEN_NOTE}`, source: 'cooking', val: result };
    }
    if ((m = s.match(/^(?:backofen\s*|ofen\s*)?gas(?:stufe|herd)?\s*(?:stufe\s*)?(\d)(?:\s+(?:in|als)\s+(?:°c|grad|celsius|umluft|ober-?\s*(?:\/|und)?\s*unterhitze))?$/i))) {
      const stage = GAS.find((g) => g[0] === Number(m![1]));
      if (!stage) return { text: 'Gasstufen gehen üblicherweise von 1 bis 8.', source: 'cooking' };
      return { text: `**Gasstufe ${stage[0]} ≈ ${stage[1]} °C Ober-/Unterhitze** (≈ ${stage[1] - 20} °C Umluft)\n\n${OVEN_NOTE}`, source: 'cooking', val: stage[1] };
    }

    // Measure conversions: „250 g Mehl in Cups“, „2 Cups Zucker in Gramm“, „3 EL Öl in ml“, „1 Tasse in ml“
    const unitRe = '(cups?|tassen?|el|esslöffel|essloeffel|tbsp|tl|teelöffel|teeloeffel|tsp|ml|l|liter|fl\\s*oz|pints?|pt|quarts?|gallonen?|gallons?|g|gramm|kg|kilo(?:gramm)?|oz|unzen?|lbs?|pfund|pounds?)';
    if ((m = s.match(new RegExp(`^(?:wie\\s*viel(?:e)?\\s+(?:gramm|ml|cups?|el|tl)\\s+(?:sind|ist|hat|haben)\\s+)?${NUM}\\s*${unitRe}\\b\\s*([a-zäöüß\\- ]*?)\\s*(?:in|als|=|sind|entspricht|entsprechen|umrechnen\\s+in)\\s+${unitRe}\\s*\\??$`, 'i')))) {
      const value = toNum(m[1]);
      const fromUnit = m[2].toLowerCase().replace(/\s+/g, '');
      const ingredientText = m[3].trim();
      const toUnit = m[4].toLowerCase().replace(/\s+/g, '');
      const fromVol = VOLUME[fromUnit] ?? VOLUME[fromUnit.replace(/s$/, '')];
      const toVol = VOLUME[toUnit] ?? VOLUME[toUnit.replace(/s$/, '')];
      const fromMass = MASS[fromUnit];
      const toMass = MASS[toUnit];
      const ingredient = findIngredient(ingredientText);
      const density = ingredient ? ingredient.perCup / 240 : null;     // g per ml
      let result: number;
      let note = '';
      if (fromVol && toVol) result = value * fromVol / toVol;
      else if (fromMass && toMass) result = value * fromMass / toMass;
      else if (fromVol && toMass) {
        if (!density) return { text: `Dafür brauche ich die Zutat (Dichte), z. B. „${fmtN(value)} ${m[2]} Mehl in ${m[4]}“. Ich kenne: ${INGREDIENTS.map((item) => item.label).join(', ')}.`, source: 'cooking' };
        result = value * fromVol * density / toMass;
        note = `Dichte ${ingredient!.label}: ${fmtN(ingredient!.perCup)} g pro Cup (240 ml).`;
      } else if (fromMass && toVol) {
        if (!density) return { text: `Dafür brauche ich die Zutat (Dichte), z. B. „${fmtN(value)} ${m[2]} Mehl in ${m[4]}“. Ich kenne: ${INGREDIENTS.map((item) => item.label).join(', ')}.`, source: 'cooking' };
        result = value * fromMass / density / toVol;
        note = `Dichte ${ingredient!.label}: ${fmtN(ingredient!.perCup)} g pro Cup (240 ml).`;
      } else return null;
      const ml = fromVol ? value * fromVol : density ? value * fromMass! / density : null;
      const lines = [`**${fmtN(value)} ${m[2]}${ingredientText ? ` ${ingredientText}` : ''} ≈ ${fmtAmount(result)} ${m[4]}**`];
      if (ml != null) lines.push('', `- Volumen: ${fmtAmount(ml)} ml → ${spoonText(ml)}`);
      if (density && ml != null) lines.push(`- Gewicht: ${fmtAmount(ml * density)} g`);
      if (note) lines.push('', `_${note} Tasse = 250 ml, US-Cup = 240 ml, EL = 15 ml, TL = 5 ml – gestrichen gemessen._`);
      else lines.push('', '_Tasse = 250 ml, US-Cup = 240 ml, EL = 15 ml, TL = 5 ml. Für Gramm die Zutat dazuschreiben, z. B. „2 Cups Zucker in Gramm“._');
      return { text: lines.join('\n'), source: 'cooking', val: Math.round(result * 100) / 100 };
    }
    return null;
  },
};
