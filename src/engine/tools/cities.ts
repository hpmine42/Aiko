/* Compact offline gazetteer: coordinates and IANA time zones for sunrise/sunset questions. */

export interface City { name: string; lat: number; lon: number; tz: string; country: string; aliases?: string[] }

const DE = 'Europe/Berlin';

export const CITIES: readonly City[] = [
  // Deutschland
  { name: 'Berlin', lat: 52.520, lon: 13.405, tz: DE, country: 'DE' },
  { name: 'Hamburg', lat: 53.551, lon: 9.994, tz: DE, country: 'DE' },
  { name: 'München', lat: 48.137, lon: 11.575, tz: DE, country: 'DE', aliases: ['muenchen', 'munich'] },
  { name: 'Köln', lat: 50.938, lon: 6.960, tz: DE, country: 'DE', aliases: ['koeln', 'cologne'] },
  { name: 'Frankfurt am Main', lat: 50.110, lon: 8.682, tz: DE, country: 'DE', aliases: ['frankfurt'] },
  { name: 'Stuttgart', lat: 48.776, lon: 9.182, tz: DE, country: 'DE' },
  { name: 'Düsseldorf', lat: 51.228, lon: 6.773, tz: DE, country: 'DE', aliases: ['duesseldorf'] },
  { name: 'Leipzig', lat: 51.340, lon: 12.375, tz: DE, country: 'DE' },
  { name: 'Dortmund', lat: 51.514, lon: 7.466, tz: DE, country: 'DE' },
  { name: 'Essen', lat: 51.456, lon: 7.012, tz: DE, country: 'DE' },
  { name: 'Bremen', lat: 53.079, lon: 8.802, tz: DE, country: 'DE' },
  { name: 'Dresden', lat: 51.050, lon: 13.738, tz: DE, country: 'DE' },
  { name: 'Hannover', lat: 52.375, lon: 9.732, tz: DE, country: 'DE' },
  { name: 'Nürnberg', lat: 49.454, lon: 11.077, tz: DE, country: 'DE', aliases: ['nuernberg'] },
  { name: 'Duisburg', lat: 51.435, lon: 6.762, tz: DE, country: 'DE' },
  { name: 'Bochum', lat: 51.482, lon: 7.216, tz: DE, country: 'DE' },
  { name: 'Wuppertal', lat: 51.256, lon: 7.151, tz: DE, country: 'DE' },
  { name: 'Bielefeld', lat: 52.030, lon: 8.532, tz: DE, country: 'DE' },
  { name: 'Bonn', lat: 50.735, lon: 7.100, tz: DE, country: 'DE' },
  { name: 'Münster', lat: 51.962, lon: 7.626, tz: DE, country: 'DE', aliases: ['muenster'] },
  { name: 'Karlsruhe', lat: 49.007, lon: 8.404, tz: DE, country: 'DE' },
  { name: 'Mannheim', lat: 49.489, lon: 8.467, tz: DE, country: 'DE' },
  { name: 'Augsburg', lat: 48.371, lon: 10.898, tz: DE, country: 'DE' },
  { name: 'Wiesbaden', lat: 50.082, lon: 8.240, tz: DE, country: 'DE' },
  { name: 'Gelsenkirchen', lat: 51.518, lon: 7.086, tz: DE, country: 'DE' },
  { name: 'Mönchengladbach', lat: 51.185, lon: 6.442, tz: DE, country: 'DE', aliases: ['moenchengladbach'] },
  { name: 'Braunschweig', lat: 52.269, lon: 10.521, tz: DE, country: 'DE' },
  { name: 'Chemnitz', lat: 50.833, lon: 12.920, tz: DE, country: 'DE' },
  { name: 'Kiel', lat: 54.323, lon: 10.122, tz: DE, country: 'DE' },
  { name: 'Aachen', lat: 50.776, lon: 6.084, tz: DE, country: 'DE' },
  { name: 'Halle (Saale)', lat: 51.483, lon: 11.970, tz: DE, country: 'DE', aliases: ['halle'] },
  { name: 'Magdeburg', lat: 52.131, lon: 11.629, tz: DE, country: 'DE' },
  { name: 'Freiburg', lat: 47.999, lon: 7.842, tz: DE, country: 'DE' },
  { name: 'Krefeld', lat: 51.334, lon: 6.564, tz: DE, country: 'DE' },
  { name: 'Lübeck', lat: 53.866, lon: 10.687, tz: DE, country: 'DE', aliases: ['luebeck'] },
  { name: 'Oldenburg', lat: 53.144, lon: 8.214, tz: DE, country: 'DE' },
  { name: 'Erfurt', lat: 50.978, lon: 11.030, tz: DE, country: 'DE' },
  { name: 'Mainz', lat: 50.000, lon: 8.271, tz: DE, country: 'DE' },
  { name: 'Rostock', lat: 54.092, lon: 12.099, tz: DE, country: 'DE' },
  { name: 'Kassel', lat: 51.313, lon: 9.479, tz: DE, country: 'DE' },
  { name: 'Saarbrücken', lat: 49.240, lon: 6.997, tz: DE, country: 'DE', aliases: ['saarbruecken'] },
  { name: 'Potsdam', lat: 52.400, lon: 13.060, tz: DE, country: 'DE' },
  { name: 'Regensburg', lat: 49.013, lon: 12.102, tz: DE, country: 'DE' },
  { name: 'Würzburg', lat: 49.792, lon: 9.938, tz: DE, country: 'DE', aliases: ['wuerzburg'] },
  { name: 'Ulm', lat: 48.401, lon: 9.987, tz: DE, country: 'DE' },
  { name: 'Heidelberg', lat: 49.399, lon: 8.672, tz: DE, country: 'DE' },
  { name: 'Trier', lat: 49.750, lon: 6.637, tz: DE, country: 'DE' },
  { name: 'Koblenz', lat: 50.356, lon: 7.594, tz: DE, country: 'DE' },
  { name: 'Konstanz', lat: 47.660, lon: 9.175, tz: DE, country: 'DE' },
  { name: 'Passau', lat: 48.574, lon: 13.460, tz: DE, country: 'DE' },
  { name: 'Flensburg', lat: 54.782, lon: 9.437, tz: DE, country: 'DE' },
  { name: 'Westerland (Sylt)', lat: 54.908, lon: 8.305, tz: DE, country: 'DE', aliases: ['sylt', 'westerland'] },
  { name: 'Garmisch-Partenkirchen', lat: 47.492, lon: 11.095, tz: DE, country: 'DE', aliases: ['garmisch'] },
  { name: 'Göttingen', lat: 51.541, lon: 9.916, tz: DE, country: 'DE', aliases: ['goettingen'] },
  { name: 'Jena', lat: 50.927, lon: 11.586, tz: DE, country: 'DE' },
  { name: 'Osnabrück', lat: 52.280, lon: 8.047, tz: DE, country: 'DE', aliases: ['osnabrueck'] },
  { name: 'Paderborn', lat: 51.719, lon: 8.754, tz: DE, country: 'DE' },
  { name: 'Siegen', lat: 50.875, lon: 8.024, tz: DE, country: 'DE' },
  { name: 'Cottbus', lat: 51.757, lon: 14.329, tz: DE, country: 'DE' },
  { name: 'Schwerin', lat: 53.629, lon: 11.413, tz: DE, country: 'DE' },
  { name: 'Leverkusen', lat: 51.046, lon: 7.000, tz: DE, country: 'DE' },
  { name: 'Darmstadt', lat: 49.872, lon: 8.651, tz: DE, country: 'DE' },
  { name: 'Heilbronn', lat: 49.142, lon: 9.219, tz: DE, country: 'DE' },
  { name: 'Ingolstadt', lat: 48.766, lon: 11.425, tz: DE, country: 'DE' },
  { name: 'Wolfsburg', lat: 52.423, lon: 10.787, tz: DE, country: 'DE' },
  { name: 'Bayreuth', lat: 49.948, lon: 11.579, tz: DE, country: 'DE' },
  { name: 'Bamberg', lat: 49.892, lon: 10.887, tz: DE, country: 'DE' },
  { name: 'Lindau', lat: 47.546, lon: 9.684, tz: DE, country: 'DE' },
  { name: 'Cuxhaven', lat: 53.868, lon: 8.694, tz: DE, country: 'DE' },
  { name: 'Görlitz', lat: 51.153, lon: 14.988, tz: DE, country: 'DE', aliases: ['goerlitz'] },
  // Europa
  { name: 'Wien', lat: 48.208, lon: 16.373, tz: 'Europe/Vienna', country: 'AT', aliases: ['vienna'] },
  { name: 'Salzburg', lat: 47.810, lon: 13.055, tz: 'Europe/Vienna', country: 'AT' },
  { name: 'Innsbruck', lat: 47.269, lon: 11.404, tz: 'Europe/Vienna', country: 'AT' },
  { name: 'Graz', lat: 47.071, lon: 15.439, tz: 'Europe/Vienna', country: 'AT' },
  { name: 'Zürich', lat: 47.377, lon: 8.541, tz: 'Europe/Zurich', country: 'CH', aliases: ['zuerich', 'zurich'] },
  { name: 'Bern', lat: 46.948, lon: 7.447, tz: 'Europe/Zurich', country: 'CH' },
  { name: 'Genf', lat: 46.204, lon: 6.143, tz: 'Europe/Zurich', country: 'CH', aliases: ['geneva', 'genève'] },
  { name: 'Basel', lat: 47.560, lon: 7.590, tz: 'Europe/Zurich', country: 'CH' },
  { name: 'Paris', lat: 48.857, lon: 2.352, tz: 'Europe/Paris', country: 'FR' },
  { name: 'Nizza', lat: 43.710, lon: 7.262, tz: 'Europe/Paris', country: 'FR', aliases: ['nice'] },
  { name: 'London', lat: 51.507, lon: -0.128, tz: 'Europe/London', country: 'GB' },
  { name: 'Edinburgh', lat: 55.953, lon: -3.188, tz: 'Europe/London', country: 'GB' },
  { name: 'Dublin', lat: 53.350, lon: -6.260, tz: 'Europe/Dublin', country: 'IE' },
  { name: 'Amsterdam', lat: 52.370, lon: 4.895, tz: 'Europe/Amsterdam', country: 'NL' },
  { name: 'Brüssel', lat: 50.850, lon: 4.352, tz: 'Europe/Brussels', country: 'BE', aliases: ['bruessel', 'brussels'] },
  { name: 'Luxemburg', lat: 49.612, lon: 6.130, tz: 'Europe/Luxembourg', country: 'LU' },
  { name: 'Kopenhagen', lat: 55.676, lon: 12.568, tz: 'Europe/Copenhagen', country: 'DK', aliases: ['copenhagen'] },
  { name: 'Stockholm', lat: 59.329, lon: 18.069, tz: 'Europe/Stockholm', country: 'SE' },
  { name: 'Oslo', lat: 59.913, lon: 10.752, tz: 'Europe/Oslo', country: 'NO' },
  { name: 'Tromsø', lat: 69.649, lon: 18.956, tz: 'Europe/Oslo', country: 'NO', aliases: ['tromso', 'tromsö'] },
  { name: 'Helsinki', lat: 60.170, lon: 24.938, tz: 'Europe/Helsinki', country: 'FI' },
  { name: 'Reykjavík', lat: 64.147, lon: -21.942, tz: 'Atlantic/Reykjavik', country: 'IS', aliases: ['reykjavik'] },
  { name: 'Lissabon', lat: 38.722, lon: -9.139, tz: 'Europe/Lisbon', country: 'PT', aliases: ['lisbon', 'lisboa'] },
  { name: 'Madrid', lat: 40.417, lon: -3.704, tz: 'Europe/Madrid', country: 'ES' },
  { name: 'Barcelona', lat: 41.385, lon: 2.173, tz: 'Europe/Madrid', country: 'ES' },
  { name: 'Palma de Mallorca', lat: 39.570, lon: 2.650, tz: 'Europe/Madrid', country: 'ES', aliases: ['mallorca', 'palma'] },
  { name: 'Las Palmas', lat: 28.124, lon: -15.436, tz: 'Atlantic/Canary', country: 'ES', aliases: ['gran canaria', 'kanaren'] },
  { name: 'Rom', lat: 41.903, lon: 12.496, tz: 'Europe/Rome', country: 'IT', aliases: ['rome', 'roma'] },
  { name: 'Mailand', lat: 45.464, lon: 9.190, tz: 'Europe/Rome', country: 'IT', aliases: ['milano', 'milan'] },
  { name: 'Venedig', lat: 45.440, lon: 12.316, tz: 'Europe/Rome', country: 'IT', aliases: ['venezia', 'venice'] },
  { name: 'Athen', lat: 37.984, lon: 23.728, tz: 'Europe/Athens', country: 'GR', aliases: ['athens'] },
  { name: 'Istanbul', lat: 41.008, lon: 28.978, tz: 'Europe/Istanbul', country: 'TR' },
  { name: 'Prag', lat: 50.075, lon: 14.438, tz: 'Europe/Prague', country: 'CZ', aliases: ['prague', 'praha'] },
  { name: 'Warschau', lat: 52.230, lon: 21.012, tz: 'Europe/Warsaw', country: 'PL', aliases: ['warsaw', 'warszawa'] },
  { name: 'Krakau', lat: 50.065, lon: 19.945, tz: 'Europe/Warsaw', country: 'PL', aliases: ['krakow', 'kraków'] },
  { name: 'Budapest', lat: 47.498, lon: 19.040, tz: 'Europe/Budapest', country: 'HU' },
  { name: 'Bratislava', lat: 48.149, lon: 17.107, tz: 'Europe/Bratislava', country: 'SK' },
  { name: 'Ljubljana', lat: 46.056, lon: 14.506, tz: 'Europe/Ljubljana', country: 'SI' },
  { name: 'Zagreb', lat: 45.815, lon: 15.982, tz: 'Europe/Zagreb', country: 'HR' },
  { name: 'Belgrad', lat: 44.787, lon: 20.457, tz: 'Europe/Belgrade', country: 'RS', aliases: ['belgrade', 'beograd'] },
  { name: 'Bukarest', lat: 44.427, lon: 26.103, tz: 'Europe/Bucharest', country: 'RO', aliases: ['bucharest'] },
  { name: 'Sofia', lat: 42.698, lon: 23.322, tz: 'Europe/Sofia', country: 'BG' },
  { name: 'Kiew', lat: 50.450, lon: 30.523, tz: 'Europe/Kyiv', country: 'UA', aliases: ['kyiv', 'kiev', 'kyjiw'] },
  { name: 'Moskau', lat: 55.756, lon: 37.617, tz: 'Europe/Moscow', country: 'RU', aliases: ['moscow', 'moskwa'] },
  { name: 'Riga', lat: 56.950, lon: 24.106, tz: 'Europe/Riga', country: 'LV' },
  { name: 'Tallinn', lat: 59.437, lon: 24.754, tz: 'Europe/Tallinn', country: 'EE' },
  { name: 'Vilnius', lat: 54.687, lon: 25.280, tz: 'Europe/Vilnius', country: 'LT' },
  // Welt
  { name: 'New York', lat: 40.713, lon: -74.006, tz: 'America/New_York', country: 'US', aliases: ['new york city', 'nyc'] },
  { name: 'Los Angeles', lat: 34.052, lon: -118.244, tz: 'America/Los_Angeles', country: 'US', aliases: ['la'] },
  { name: 'San Francisco', lat: 37.775, lon: -122.419, tz: 'America/Los_Angeles', country: 'US' },
  { name: 'Chicago', lat: 41.878, lon: -87.630, tz: 'America/Chicago', country: 'US' },
  { name: 'Miami', lat: 25.762, lon: -80.192, tz: 'America/New_York', country: 'US' },
  { name: 'Washington', lat: 38.907, lon: -77.037, tz: 'America/New_York', country: 'US', aliases: ['washington dc', 'washington, d.c.'] },
  { name: 'Honolulu', lat: 21.307, lon: -157.858, tz: 'Pacific/Honolulu', country: 'US', aliases: ['hawaii'] },
  { name: 'Anchorage', lat: 61.218, lon: -149.900, tz: 'America/Anchorage', country: 'US', aliases: ['alaska'] },
  { name: 'Toronto', lat: 43.653, lon: -79.383, tz: 'America/Toronto', country: 'CA' },
  { name: 'Vancouver', lat: 49.283, lon: -123.121, tz: 'America/Vancouver', country: 'CA' },
  { name: 'Mexiko-Stadt', lat: 19.433, lon: -99.133, tz: 'America/Mexico_City', country: 'MX', aliases: ['mexiko stadt', 'mexico city', 'mexiko'] },
  { name: 'Rio de Janeiro', lat: -22.907, lon: -43.173, tz: 'America/Sao_Paulo', country: 'BR', aliases: ['rio'] },
  { name: 'São Paulo', lat: -23.550, lon: -46.633, tz: 'America/Sao_Paulo', country: 'BR', aliases: ['sao paulo'] },
  { name: 'Buenos Aires', lat: -34.604, lon: -58.382, tz: 'America/Argentina/Buenos_Aires', country: 'AR' },
  { name: 'Lima', lat: -12.046, lon: -77.043, tz: 'America/Lima', country: 'PE' },
  { name: 'Kairo', lat: 30.044, lon: 31.236, tz: 'Africa/Cairo', country: 'EG', aliases: ['cairo'] },
  { name: 'Kapstadt', lat: -33.925, lon: 18.424, tz: 'Africa/Johannesburg', country: 'ZA', aliases: ['cape town'] },
  { name: 'Johannesburg', lat: -26.204, lon: 28.047, tz: 'Africa/Johannesburg', country: 'ZA' },
  { name: 'Nairobi', lat: -1.292, lon: 36.822, tz: 'Africa/Nairobi', country: 'KE' },
  { name: 'Lagos', lat: 6.524, lon: 3.379, tz: 'Africa/Lagos', country: 'NG' },
  { name: 'Marrakesch', lat: 31.630, lon: -8.009, tz: 'Africa/Casablanca', country: 'MA', aliases: ['marrakech'] },
  { name: 'Dubai', lat: 25.205, lon: 55.271, tz: 'Asia/Dubai', country: 'AE' },
  { name: 'Tel Aviv', lat: 32.085, lon: 34.782, tz: 'Asia/Jerusalem', country: 'IL' },
  { name: 'Teheran', lat: 35.689, lon: 51.389, tz: 'Asia/Tehran', country: 'IR', aliases: ['tehran'] },
  { name: 'Mumbai', lat: 19.076, lon: 72.878, tz: 'Asia/Kolkata', country: 'IN', aliases: ['bombay'] },
  { name: 'Neu-Delhi', lat: 28.614, lon: 77.209, tz: 'Asia/Kolkata', country: 'IN', aliases: ['delhi', 'new delhi', 'neu delhi'] },
  { name: 'Bangkok', lat: 13.756, lon: 100.502, tz: 'Asia/Bangkok', country: 'TH' },
  { name: 'Singapur', lat: 1.352, lon: 103.820, tz: 'Asia/Singapore', country: 'SG', aliases: ['singapore'] },
  { name: 'Hongkong', lat: 22.319, lon: 114.169, tz: 'Asia/Hong_Kong', country: 'HK', aliases: ['hong kong'] },
  { name: 'Peking', lat: 39.904, lon: 116.407, tz: 'Asia/Shanghai', country: 'CN', aliases: ['beijing'] },
  { name: 'Shanghai', lat: 31.230, lon: 121.474, tz: 'Asia/Shanghai', country: 'CN' },
  { name: 'Seoul', lat: 37.566, lon: 126.978, tz: 'Asia/Seoul', country: 'KR' },
  { name: 'Tokio', lat: 35.690, lon: 139.692, tz: 'Asia/Tokyo', country: 'JP', aliases: ['tokyo'] },
  { name: 'Sydney', lat: -33.869, lon: 151.209, tz: 'Australia/Sydney', country: 'AU' },
  { name: 'Melbourne', lat: -37.814, lon: 144.963, tz: 'Australia/Melbourne', country: 'AU' },
  { name: 'Perth', lat: -31.953, lon: 115.857, tz: 'Australia/Perth', country: 'AU' },
  { name: 'Auckland', lat: -36.848, lon: 174.763, tz: 'Pacific/Auckland', country: 'NZ' },
];

const fold = (s: string): string => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** Finds a city by name or alias (umlaut-insensitive). */
export function findCity(raw: string): City | null {
  const key = fold(String(raw || '').replace(/^(?:in|für|fuer|von|bei|aus)\s+/i, ''));
  if (!key) return null;
  for (const city of CITIES) {
    if (fold(city.name) === key) return city;
    if (city.aliases?.some((alias) => fold(alias) === key)) return city;
  }
  for (const city of CITIES) {
    const base = fold(city.name).split(' ')[0];
    if (base.length > 3 && base === key) return city;
  }
  return null;
}

/** Parses „50,73, 7,1“, „50.73 7.1“ or „50.73 N 7.1 E“ coordinates. */
export function parseCoords(raw: string): { lat: number; lon: number } | null {
  let s = String(raw || '').trim().replace(/°/g, ' ');
  const commas = (s.match(/,/g) || []).length;
  if (commas >= 2 || /\d,\d+\s+-?\d/.test(s) || /;/.test(s)) s = s.replace(/(\d),(\d)/g, '$1.$2');
  const m = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*([ns])?\s*[,;\s]+\s*(-?\d{1,3}(?:\.\d+)?)\s*([eow])?$/i);
  if (!m) return null;
  let lat = Number(m[1]);
  let lon = Number(m[3]);
  if (m[2] && m[2].toLowerCase() === 's') lat = -Math.abs(lat);
  if (m[4] && m[4].toLowerCase() === 'w') lon = -Math.abs(lon);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
  return { lat, lon };
}
