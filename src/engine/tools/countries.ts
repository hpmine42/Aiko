import type { Tool } from './types';
import { clean, fmtN, reorder } from './shared';

/* Compact country facts: capital, ISO codes, calling code, currency, TLD, population (approx., millions), languages. */

export interface Country { name: string; capital: string; iso2: string; iso3: string; phone: string; currency: string; tld: string; pop: number; lang: string; continent: string; aliases?: string[] }

export const COUNTRIES: Country[] = [
  { name: 'Deutschland', capital: 'Berlin', iso2: 'DE', iso3: 'DEU', phone: '+49', currency: 'Euro (EUR)', tld: '.de', pop: 84.5, lang: 'Deutsch', continent: 'Europa', aliases: ['brd', 'germany'] },
  { name: 'Österreich', capital: 'Wien', iso2: 'AT', iso3: 'AUT', phone: '+43', currency: 'Euro (EUR)', tld: '.at', pop: 9.1, lang: 'Deutsch', continent: 'Europa', aliases: ['oesterreich', 'austria'] },
  { name: 'Schweiz', capital: 'Bern', iso2: 'CH', iso3: 'CHE', phone: '+41', currency: 'Schweizer Franken (CHF)', tld: '.ch', pop: 8.9, lang: 'Deutsch, Französisch, Italienisch, Rätoromanisch', continent: 'Europa', aliases: ['switzerland'] },
  { name: 'Frankreich', capital: 'Paris', iso2: 'FR', iso3: 'FRA', phone: '+33', currency: 'Euro (EUR)', tld: '.fr', pop: 68.4, lang: 'Französisch', continent: 'Europa', aliases: ['france'] },
  { name: 'Italien', capital: 'Rom', iso2: 'IT', iso3: 'ITA', phone: '+39', currency: 'Euro (EUR)', tld: '.it', pop: 58.9, lang: 'Italienisch', continent: 'Europa', aliases: ['italy', 'italia'] },
  { name: 'Spanien', capital: 'Madrid', iso2: 'ES', iso3: 'ESP', phone: '+34', currency: 'Euro (EUR)', tld: '.es', pop: 48.6, lang: 'Spanisch', continent: 'Europa', aliases: ['spain', 'españa'] },
  { name: 'Portugal', capital: 'Lissabon', iso2: 'PT', iso3: 'PRT', phone: '+351', currency: 'Euro (EUR)', tld: '.pt', pop: 10.6, lang: 'Portugiesisch', continent: 'Europa' },
  { name: 'Niederlande', capital: 'Amsterdam', iso2: 'NL', iso3: 'NLD', phone: '+31', currency: 'Euro (EUR)', tld: '.nl', pop: 17.9, lang: 'Niederländisch', continent: 'Europa', aliases: ['holland', 'netherlands'] },
  { name: 'Belgien', capital: 'Brüssel', iso2: 'BE', iso3: 'BEL', phone: '+32', currency: 'Euro (EUR)', tld: '.be', pop: 11.8, lang: 'Niederländisch, Französisch, Deutsch', continent: 'Europa', aliases: ['belgium'] },
  { name: 'Luxemburg', capital: 'Luxemburg', iso2: 'LU', iso3: 'LUX', phone: '+352', currency: 'Euro (EUR)', tld: '.lu', pop: 0.67, lang: 'Luxemburgisch, Französisch, Deutsch', continent: 'Europa' },
  { name: 'Dänemark', capital: 'Kopenhagen', iso2: 'DK', iso3: 'DNK', phone: '+45', currency: 'Dänische Krone (DKK)', tld: '.dk', pop: 5.9, lang: 'Dänisch', continent: 'Europa', aliases: ['daenemark', 'denmark'] },
  { name: 'Schweden', capital: 'Stockholm', iso2: 'SE', iso3: 'SWE', phone: '+46', currency: 'Schwedische Krone (SEK)', tld: '.se', pop: 10.6, lang: 'Schwedisch', continent: 'Europa', aliases: ['sweden'] },
  { name: 'Norwegen', capital: 'Oslo', iso2: 'NO', iso3: 'NOR', phone: '+47', currency: 'Norwegische Krone (NOK)', tld: '.no', pop: 5.6, lang: 'Norwegisch', continent: 'Europa', aliases: ['norway'] },
  { name: 'Finnland', capital: 'Helsinki', iso2: 'FI', iso3: 'FIN', phone: '+358', currency: 'Euro (EUR)', tld: '.fi', pop: 5.6, lang: 'Finnisch, Schwedisch', continent: 'Europa', aliases: ['finland'] },
  { name: 'Island', capital: 'Reykjavík', iso2: 'IS', iso3: 'ISL', phone: '+354', currency: 'Isländische Krone (ISK)', tld: '.is', pop: 0.39, lang: 'Isländisch', continent: 'Europa', aliases: ['iceland'] },
  { name: 'Irland', capital: 'Dublin', iso2: 'IE', iso3: 'IRL', phone: '+353', currency: 'Euro (EUR)', tld: '.ie', pop: 5.3, lang: 'Englisch, Irisch', continent: 'Europa', aliases: ['ireland'] },
  { name: 'Vereinigtes Königreich', capital: 'London', iso2: 'GB', iso3: 'GBR', phone: '+44', currency: 'Pfund Sterling (GBP)', tld: '.uk', pop: 68.3, lang: 'Englisch', continent: 'Europa', aliases: ['großbritannien', 'grossbritannien', 'england', 'uk', 'united kingdom', 'britannien'] },
  { name: 'Polen', capital: 'Warschau', iso2: 'PL', iso3: 'POL', phone: '+48', currency: 'Złoty (PLN)', tld: '.pl', pop: 36.7, lang: 'Polnisch', continent: 'Europa', aliases: ['poland', 'polska'] },
  { name: 'Tschechien', capital: 'Prag', iso2: 'CZ', iso3: 'CZE', phone: '+420', currency: 'Tschechische Krone (CZK)', tld: '.cz', pop: 10.9, lang: 'Tschechisch', continent: 'Europa', aliases: ['tschechische republik', 'czechia'] },
  { name: 'Slowakei', capital: 'Bratislava', iso2: 'SK', iso3: 'SVK', phone: '+421', currency: 'Euro (EUR)', tld: '.sk', pop: 5.4, lang: 'Slowakisch', continent: 'Europa', aliases: ['slovakia'] },
  { name: 'Ungarn', capital: 'Budapest', iso2: 'HU', iso3: 'HUN', phone: '+36', currency: 'Forint (HUF)', tld: '.hu', pop: 9.6, lang: 'Ungarisch', continent: 'Europa', aliases: ['hungary'] },
  { name: 'Slowenien', capital: 'Ljubljana', iso2: 'SI', iso3: 'SVN', phone: '+386', currency: 'Euro (EUR)', tld: '.si', pop: 2.1, lang: 'Slowenisch', continent: 'Europa', aliases: ['slovenia'] },
  { name: 'Kroatien', capital: 'Zagreb', iso2: 'HR', iso3: 'HRV', phone: '+385', currency: 'Euro (EUR)', tld: '.hr', pop: 3.9, lang: 'Kroatisch', continent: 'Europa', aliases: ['croatia'] },
  { name: 'Serbien', capital: 'Belgrad', iso2: 'RS', iso3: 'SRB', phone: '+381', currency: 'Serbischer Dinar (RSD)', tld: '.rs', pop: 6.6, lang: 'Serbisch', continent: 'Europa', aliases: ['serbia'] },
  { name: 'Bosnien und Herzegowina', capital: 'Sarajevo', iso2: 'BA', iso3: 'BIH', phone: '+387', currency: 'Konvertible Mark (BAM)', tld: '.ba', pop: 3.2, lang: 'Bosnisch, Kroatisch, Serbisch', continent: 'Europa', aliases: ['bosnien'] },
  { name: 'Rumänien', capital: 'Bukarest', iso2: 'RO', iso3: 'ROU', phone: '+40', currency: 'Leu (RON)', tld: '.ro', pop: 19.1, lang: 'Rumänisch', continent: 'Europa', aliases: ['rumaenien', 'romania'] },
  { name: 'Bulgarien', capital: 'Sofia', iso2: 'BG', iso3: 'BGR', phone: '+359', currency: 'Lew (BGN)', tld: '.bg', pop: 6.4, lang: 'Bulgarisch', continent: 'Europa', aliases: ['bulgaria'] },
  { name: 'Griechenland', capital: 'Athen', iso2: 'GR', iso3: 'GRC', phone: '+30', currency: 'Euro (EUR)', tld: '.gr', pop: 10.4, lang: 'Griechisch', continent: 'Europa', aliases: ['greece'] },
  { name: 'Türkei', capital: 'Ankara', iso2: 'TR', iso3: 'TUR', phone: '+90', currency: 'Türkische Lira (TRY)', tld: '.tr', pop: 85.3, lang: 'Türkisch', continent: 'Europa/Asien', aliases: ['tuerkei', 'turkey', 'türkiye'] },
  { name: 'Ukraine', capital: 'Kyjiw', iso2: 'UA', iso3: 'UKR', phone: '+380', currency: 'Hrywnja (UAH)', tld: '.ua', pop: 37.0, lang: 'Ukrainisch', continent: 'Europa' },
  { name: 'Russland', capital: 'Moskau', iso2: 'RU', iso3: 'RUS', phone: '+7', currency: 'Rubel (RUB)', tld: '.ru', pop: 144.0, lang: 'Russisch', continent: 'Europa/Asien', aliases: ['russia', 'russische föderation'] },
  { name: 'Estland', capital: 'Tallinn', iso2: 'EE', iso3: 'EST', phone: '+372', currency: 'Euro (EUR)', tld: '.ee', pop: 1.4, lang: 'Estnisch', continent: 'Europa', aliases: ['estonia'] },
  { name: 'Lettland', capital: 'Riga', iso2: 'LV', iso3: 'LVA', phone: '+371', currency: 'Euro (EUR)', tld: '.lv', pop: 1.9, lang: 'Lettisch', continent: 'Europa', aliases: ['latvia'] },
  { name: 'Litauen', capital: 'Vilnius', iso2: 'LT', iso3: 'LTU', phone: '+370', currency: 'Euro (EUR)', tld: '.lt', pop: 2.9, lang: 'Litauisch', continent: 'Europa', aliases: ['lithuania'] },
  { name: 'Liechtenstein', capital: 'Vaduz', iso2: 'LI', iso3: 'LIE', phone: '+423', currency: 'Schweizer Franken (CHF)', tld: '.li', pop: 0.04, lang: 'Deutsch', continent: 'Europa' },
  { name: 'Malta', capital: 'Valletta', iso2: 'MT', iso3: 'MLT', phone: '+356', currency: 'Euro (EUR)', tld: '.mt', pop: 0.55, lang: 'Maltesisch, Englisch', continent: 'Europa' },
  { name: 'Zypern', capital: 'Nikosia', iso2: 'CY', iso3: 'CYP', phone: '+357', currency: 'Euro (EUR)', tld: '.cy', pop: 1.3, lang: 'Griechisch, Türkisch', continent: 'Europa/Asien', aliases: ['cyprus'] },
  { name: 'USA', capital: 'Washington, D.C.', iso2: 'US', iso3: 'USA', phone: '+1', currency: 'US-Dollar (USD)', tld: '.us', pop: 335.0, lang: 'Englisch', continent: 'Nordamerika', aliases: ['vereinigte staaten', 'amerika', 'united states', 'us'] },
  { name: 'Kanada', capital: 'Ottawa', iso2: 'CA', iso3: 'CAN', phone: '+1', currency: 'Kanadischer Dollar (CAD)', tld: '.ca', pop: 40.1, lang: 'Englisch, Französisch', continent: 'Nordamerika', aliases: ['canada'] },
  { name: 'Mexiko', capital: 'Mexiko-Stadt', iso2: 'MX', iso3: 'MEX', phone: '+52', currency: 'Mexikanischer Peso (MXN)', tld: '.mx', pop: 129.0, lang: 'Spanisch', continent: 'Nordamerika', aliases: ['mexico'] },
  { name: 'Brasilien', capital: 'Brasília', iso2: 'BR', iso3: 'BRA', phone: '+55', currency: 'Real (BRL)', tld: '.br', pop: 216.0, lang: 'Portugiesisch', continent: 'Südamerika', aliases: ['brazil', 'brasil'] },
  { name: 'Argentinien', capital: 'Buenos Aires', iso2: 'AR', iso3: 'ARG', phone: '+54', currency: 'Argentinischer Peso (ARS)', tld: '.ar', pop: 46.7, lang: 'Spanisch', continent: 'Südamerika', aliases: ['argentina'] },
  { name: 'Chile', capital: 'Santiago de Chile', iso2: 'CL', iso3: 'CHL', phone: '+56', currency: 'Chilenischer Peso (CLP)', tld: '.cl', pop: 19.6, lang: 'Spanisch', continent: 'Südamerika' },
  { name: 'Kolumbien', capital: 'Bogotá', iso2: 'CO', iso3: 'COL', phone: '+57', currency: 'Kolumbianischer Peso (COP)', tld: '.co', pop: 52.1, lang: 'Spanisch', continent: 'Südamerika', aliases: ['colombia'] },
  { name: 'Peru', capital: 'Lima', iso2: 'PE', iso3: 'PER', phone: '+51', currency: 'Sol (PEN)', tld: '.pe', pop: 34.0, lang: 'Spanisch, Quechua', continent: 'Südamerika' },
  { name: 'China', capital: 'Peking', iso2: 'CN', iso3: 'CHN', phone: '+86', currency: 'Renminbi Yuan (CNY)', tld: '.cn', pop: 1410.0, lang: 'Chinesisch (Mandarin)', continent: 'Asien', aliases: ['volksrepublik china'] },
  { name: 'Japan', capital: 'Tokio', iso2: 'JP', iso3: 'JPN', phone: '+81', currency: 'Yen (JPY)', tld: '.jp', pop: 124.0, lang: 'Japanisch', continent: 'Asien' },
  { name: 'Südkorea', capital: 'Seoul', iso2: 'KR', iso3: 'KOR', phone: '+82', currency: 'Won (KRW)', tld: '.kr', pop: 51.7, lang: 'Koreanisch', continent: 'Asien', aliases: ['suedkorea', 'korea', 'south korea'] },
  { name: 'Indien', capital: 'Neu-Delhi', iso2: 'IN', iso3: 'IND', phone: '+91', currency: 'Indische Rupie (INR)', tld: '.in', pop: 1430.0, lang: 'Hindi, Englisch u. a.', continent: 'Asien', aliases: ['india'] },
  { name: 'Indonesien', capital: 'Jakarta', iso2: 'ID', iso3: 'IDN', phone: '+62', currency: 'Rupiah (IDR)', tld: '.id', pop: 278.0, lang: 'Indonesisch', continent: 'Asien', aliases: ['indonesia'] },
  { name: 'Thailand', capital: 'Bangkok', iso2: 'TH', iso3: 'THA', phone: '+66', currency: 'Baht (THB)', tld: '.th', pop: 71.8, lang: 'Thai', continent: 'Asien' },
  { name: 'Vietnam', capital: 'Hanoi', iso2: 'VN', iso3: 'VNM', phone: '+84', currency: 'Đồng (VND)', tld: '.vn', pop: 99.5, lang: 'Vietnamesisch', continent: 'Asien' },
  { name: 'Philippinen', capital: 'Manila', iso2: 'PH', iso3: 'PHL', phone: '+63', currency: 'Philippinischer Peso (PHP)', tld: '.ph', pop: 117.0, lang: 'Filipino, Englisch', continent: 'Asien', aliases: ['philippines'] },
  { name: 'Pakistan', capital: 'Islamabad', iso2: 'PK', iso3: 'PAK', phone: '+92', currency: 'Pakistanische Rupie (PKR)', tld: '.pk', pop: 240.0, lang: 'Urdu, Englisch', continent: 'Asien' },
  { name: 'Bangladesch', capital: 'Dhaka', iso2: 'BD', iso3: 'BGD', phone: '+880', currency: 'Taka (BDT)', tld: '.bd', pop: 173.0, lang: 'Bengalisch', continent: 'Asien', aliases: ['bangladesh'] },
  { name: 'Iran', capital: 'Teheran', iso2: 'IR', iso3: 'IRN', phone: '+98', currency: 'Rial (IRR)', tld: '.ir', pop: 89.2, lang: 'Persisch', continent: 'Asien' },
  { name: 'Irak', capital: 'Bagdad', iso2: 'IQ', iso3: 'IRQ', phone: '+964', currency: 'Irakischer Dinar (IQD)', tld: '.iq', pop: 45.5, lang: 'Arabisch, Kurdisch', continent: 'Asien', aliases: ['iraq'] },
  { name: 'Israel', capital: 'Jerusalem', iso2: 'IL', iso3: 'ISR', phone: '+972', currency: 'Schekel (ILS)', tld: '.il', pop: 9.8, lang: 'Hebräisch', continent: 'Asien' },
  { name: 'Saudi-Arabien', capital: 'Riad', iso2: 'SA', iso3: 'SAU', phone: '+966', currency: 'Saudi-Rial (SAR)', tld: '.sa', pop: 36.9, lang: 'Arabisch', continent: 'Asien', aliases: ['saudi arabien', 'saudi-arabia'] },
  { name: 'Vereinigte Arabische Emirate', capital: 'Abu Dhabi', iso2: 'AE', iso3: 'ARE', phone: '+971', currency: 'Dirham (AED)', tld: '.ae', pop: 10.0, lang: 'Arabisch', continent: 'Asien', aliases: ['vae', 'emirate', 'dubai'] },
  { name: 'Kasachstan', capital: 'Astana', iso2: 'KZ', iso3: 'KAZ', phone: '+7', currency: 'Tenge (KZT)', tld: '.kz', pop: 20.0, lang: 'Kasachisch, Russisch', continent: 'Asien', aliases: ['kazakhstan'] },
  { name: 'Australien', capital: 'Canberra', iso2: 'AU', iso3: 'AUS', phone: '+61', currency: 'Australischer Dollar (AUD)', tld: '.au', pop: 26.6, lang: 'Englisch', continent: 'Ozeanien', aliases: ['australia'] },
  { name: 'Neuseeland', capital: 'Wellington', iso2: 'NZ', iso3: 'NZL', phone: '+64', currency: 'Neuseeland-Dollar (NZD)', tld: '.nz', pop: 5.2, lang: 'Englisch, Māori', continent: 'Ozeanien', aliases: ['new zealand'] },
  { name: 'Ägypten', capital: 'Kairo', iso2: 'EG', iso3: 'EGY', phone: '+20', currency: 'Ägyptisches Pfund (EGP)', tld: '.eg', pop: 113.0, lang: 'Arabisch', continent: 'Afrika', aliases: ['aegypten', 'egypt'] },
  { name: 'Marokko', capital: 'Rabat', iso2: 'MA', iso3: 'MAR', phone: '+212', currency: 'Dirham (MAD)', tld: '.ma', pop: 37.8, lang: 'Arabisch, Berberisch', continent: 'Afrika', aliases: ['morocco'] },
  { name: 'Tunesien', capital: 'Tunis', iso2: 'TN', iso3: 'TUN', phone: '+216', currency: 'Tunesischer Dinar (TND)', tld: '.tn', pop: 12.4, lang: 'Arabisch', continent: 'Afrika', aliases: ['tunisia'] },
  { name: 'Nigeria', capital: 'Abuja', iso2: 'NG', iso3: 'NGA', phone: '+234', currency: 'Naira (NGN)', tld: '.ng', pop: 224.0, lang: 'Englisch', continent: 'Afrika' },
  { name: 'Kenia', capital: 'Nairobi', iso2: 'KE', iso3: 'KEN', phone: '+254', currency: 'Kenia-Schilling (KES)', tld: '.ke', pop: 55.1, lang: 'Swahili, Englisch', continent: 'Afrika', aliases: ['kenya'] },
  { name: 'Äthiopien', capital: 'Addis Abeba', iso2: 'ET', iso3: 'ETH', phone: '+251', currency: 'Birr (ETB)', tld: '.et', pop: 127.0, lang: 'Amharisch', continent: 'Afrika', aliases: ['aethiopien', 'ethiopia'] },
  { name: 'Südafrika', capital: 'Pretoria (Regierung), Kapstadt (Parlament), Bloemfontein (Justiz)', iso2: 'ZA', iso3: 'ZAF', phone: '+27', currency: 'Rand (ZAR)', tld: '.za', pop: 60.4, lang: 'Zulu, Xhosa, Afrikaans, Englisch u. a.', continent: 'Afrika', aliases: ['suedafrika', 'south africa'] },
  { name: 'Ghana', capital: 'Accra', iso2: 'GH', iso3: 'GHA', phone: '+233', currency: 'Cedi (GHS)', tld: '.gh', pop: 34.1, lang: 'Englisch', continent: 'Afrika' },
  { name: 'Demokratische Republik Kongo', capital: 'Kinshasa', iso2: 'CD', iso3: 'COD', phone: '+243', currency: 'Kongo-Franc (CDF)', tld: '.cd', pop: 102.0, lang: 'Französisch', continent: 'Afrika', aliases: ['kongo', 'dr kongo'] },
];

const fold = (s: string): string => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function findCountry(raw: string): Country | null {
  const q = fold(raw);
  if (!q) return null;
  const upper = raw.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) { const byCode = COUNTRIES.find((c) => c.iso2 === upper); if (byCode) return byCode; }
  if (/^[A-Z]{3}$/.test(upper)) { const byCode = COUNTRIES.find((c) => c.iso3 === upper); if (byCode) return byCode; }
  if (/^\+\d{1,4}$/.test(raw.trim())) { const byPhone = COUNTRIES.find((c) => c.phone === raw.trim()); if (byPhone) return byPhone; }
  if (/^\.[a-z]{2}$/i.test(raw.trim())) { const byTld = COUNTRIES.find((c) => c.tld === raw.trim().toLowerCase()); if (byTld) return byTld; }
  return COUNTRIES.find((c) => fold(c.name) === q || (c.aliases || []).some((alias) => fold(alias) === q))
    || COUNTRIES.find((c) => fold(c.capital) === q)
    || COUNTRIES.find((c) => q.length >= 4 && (fold(c.name).startsWith(q) || (c.aliases || []).some((alias) => fold(alias).startsWith(q))))
    || null;
}

const card = (c: Country): string => `**${c.name}** (${c.iso2}/${c.iso3}) – ${c.continent}\n\n- Hauptstadt: **${c.capital}**\n- Vorwahl: ${c.phone} · Domain: ${c.tld}\n- Währung: ${c.currency}\n- Einwohner: ≈ ${c.pop >= 1 ? `${fmtN(c.pop, 1)} Mio.` : `${fmtN(c.pop * 1000, 0)} Tsd.`}\n- Sprache: ${c.lang}\n\n_Offline-Kurzinfo (Stand ca. 2024, Einwohner gerundet)._`;

export const countryTool: Tool = {
  id: 'countries',
  label: 'Länder',
  help: '- **Länder:** „Hauptstadt von Portugal“, „Vorwahl Österreich“, „Währung Japan“, „Welches Land hat die Vorwahl +41?“, „Länderinfo Kenia“, „Land mit Hauptstadt Lima“',
  run(input) {
    const s = clean(input).replace(/\?$/, '').trim();
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(?:welches\s+land\s+hat\s+)?(?:die\s+)?(?:(?:landes|länder|telefon)?vorwahl|ländervorwahl|ländercode|länderkürzel|iso-?code|iso\s*code|tld|domain(?:endung)?|länderdomain)\s*(?:von|für|fuer|:)?\s*(\+?\d{1,4}|\.[a-z]{2}|[A-Za-z]{2,3})$/i))) {
      const c = findCountry(m[1]);
      if (c) return { text: card(c), source: 'countries' };
      if (/^\+?\d+$/.test(m[1])) { const byPhone = COUNTRIES.find((x) => x.phone === `+${m![1].replace('+', '')}`); if (byPhone) return { text: card(byPhone), source: 'countries' }; }
    }
    if ((m = s.match(/^(?:was\s+ist\s+|wie\s+(?:heißt|heisst|lautet)\s+)?(?:die\s+)?(hauptstadt|vorwahl|ländervorwahl|landesvorwahl|telefonvorwahl|währung|waehrung|landessprache|sprache|amtssprache|einwohner(?:zahl)?|bevölkerung|bevoelkerung|iso-?code|ländercode|länderkürzel|domain|tld|kontinent)\s+(?:von|in|für|fuer|des|der)?\s*(.+)$/i))
      || (m = s.match(/^(?:welche\s+)?(hauptstadt|vorwahl|währung|waehrung|sprache|einwohner)\s+hat\s+(.+)$/i))
      || (m = reorder(s.match(/^(.+?)\s+(hauptstadt|vorwahl|währung|waehrung|einwohner|iso-?code|tld|domain)$/i), 0, 2, 1))) {
      const field = m[1].toLowerCase();
      const c = findCountry(m[2]);
      if (!c) return s.length < 60 && /hauptstadt|vorwahl|währung|waehrung/.test(field) ? { text: `„${m[2]}“ kenne ich nicht – ich habe Kurzinfos zu ${COUNTRIES.length} Ländern (z. B. alle EU-Staaten, USA, China, Japan, Brasilien, Südafrika).`, source: 'countries' } : null;
      let answer: string;
      if (/hauptstadt/.test(field)) answer = `Die Hauptstadt von ${c.name} ist **${c.capital}**.`;
      else if (/vorwahl/.test(field)) answer = `Die Vorwahl von ${c.name} ist **${c.phone}** (statt + auch 00${c.phone.slice(1)}).`;
      else if (/währung|waehrung/.test(field)) answer = `Die Währung von ${c.name} ist der/die **${c.currency}**.`;
      else if (/sprache/.test(field)) answer = `Amtssprache(n) in ${c.name}: **${c.lang}**.`;
      else if (/einwohner|bevölkerung|bevoelkerung/.test(field)) answer = `${c.name} hat etwa **${fmtN(c.pop, 1)} Millionen** Einwohner (Stand ca. 2024).`;
      else if (/iso|code|kürzel/.test(field)) answer = `ISO-Codes von ${c.name}: **${c.iso2}** (Alpha-2) und **${c.iso3}** (Alpha-3).`;
      else if (/domain|tld/.test(field)) answer = `Die Länderdomain von ${c.name} ist **${c.tld}**.`;
      else answer = `${c.name} liegt in **${c.continent}**.`;
      return { text: `${answer}\n\n${card(c)}`, source: 'countries' };
    }
    if ((m = s.match(/^(?:welches\s+land\s+hat\s+die\s+hauptstadt|land\s+(?:mit|zur)\s+(?:der\s+)?hauptstadt|hauptstadt\s+welchen\s+landes\s+ist|wo\s+liegt|in\s+welchem\s+land\s+liegt)\s+(.+)$/i))) {
      const c = COUNTRIES.find((x) => fold(x.capital) === fold(m![1]) || fold(x.capital).startsWith(fold(m![1])));
      if (c) return { text: `**${m[1].trim()}** ist die Hauptstadt von **${c.name}**.\n\n${card(c)}`, source: 'countries' };
      return null;
    }
    if ((m = s.match(/^(?:länderinfo|laenderinfo|land|landesinfo|steckbrief|infos?\s+(?:zu|über|ueber))\s*:?\s*(.+)$/i))) {
      const c = findCountry(m[1]);
      return c ? { text: card(c), source: 'countries' } : null;
    }
    if ((m = s.match(/^(?:länder|laender|staaten)\s+(?:in|von)\s+(europa|asien|afrika|nordamerika|südamerika|suedamerika|ozeanien)$/i))) {
      const continent = fold(m[1]);
      const list = COUNTRIES.filter((c) => fold(c.continent).includes(continent));
      return { text: `**${list.length} Länder in ${m[1]} (meine Liste):**\n\n${list.map((c) => `- ${c.name} – ${c.capital}`).join('\n')}`, source: 'countries', val: list.length };
    }
    return null;
  },
};
