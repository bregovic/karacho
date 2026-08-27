/**
 * Korekce staženého časování podle pár ručně zaklíčovaných bodů.
 *
 * Časy z LRC bývají správné vůči nahrávce, ze které vznikly — jenže naše
 * verze může mít delší předehru nebo být z jiného vydání. Místo klíčování
 * celé písně od nuly stačí trefit několik slov a zbytek se dopočítá.
 *
 * Se dvěma a víc body se hledá přímka `novy = a·puvodni + b`, ne jen
 * posun. Dvě vydání téže písně se totiž občas liší i rychlostí (jiný
 * master, jiný přepis) a samotný offset by sedl na začátku a rozešel se
 * na konci.
 */

export type Dvojice = { puvodni: number; novy: number };

export type Korekce = {
  /** Násobek času — 1 znamená stejné tempo. */
  a: number;
  /** Posun v sekundách. */
  b: number;
  /** Kolik bodů se použilo. */
  bodu: number;
  /** Největší odchylka zadaných bodů od výsledné přímky, v sekundách. */
  odchylka: number;
  /** Proč se použil jen posun, i když bodů bylo víc. */
  poznamka?: string;
};

/** Mimo tenhle rozsah už to nevypadá na tutéž nahrávku, ale na chybu obsluhy. */
const MEZ_TEMPA = 0.12;

export function spocitejKorekci(dvojice: Dvojice[]): Korekce | null {
  const body = dvojice.filter((d) => Number.isFinite(d.puvodni) && Number.isFinite(d.novy));
  if (!body.length) return null;

  const jenPosun = (poznamka?: string): Korekce => {
    const b = body.reduce((a, d) => a + (d.novy - d.puvodni), 0) / body.length;
    return {
      a: 1,
      b,
      bodu: body.length,
      odchylka: Math.max(...body.map((d) => Math.abs(d.novy - (d.puvodni + b)))),
      poznamka,
    };
  };

  if (body.length === 1) return jenPosun();

  const n = body.length;
  const sx = body.reduce((a, d) => a + d.puvodni, 0);
  const sy = body.reduce((a, d) => a + d.novy, 0);
  const sxx = body.reduce((a, d) => a + d.puvodni * d.puvodni, 0);
  const sxy = body.reduce((a, d) => a + d.puvodni * d.novy, 0);

  const jmenovatel = n * sxx - sx * sx;
  // Body příliš blízko u sebe: sklon by vyšel z šumu. Radši jen posun.
  if (Math.abs(jmenovatel) < 1e-6) return jenPosun('body byly příliš blízko u sebe');

  const a = (n * sxy - sx * sy) / jmenovatel;
  const b = (sy - a * sx) / n;

  // Nesmyslné tempo znamená, že se klíčovalo na jiná slova, než systém čekal.
  if (Math.abs(a - 1) > MEZ_TEMPA) {
    return jenPosun(`vyšlo tempo ${a.toFixed(2)}×, což nevypadá na tutéž nahrávku`);
  }

  return {
    a,
    b,
    bodu: n,
    odchylka: Math.max(...body.map((d) => Math.abs(d.novy - (a * d.puvodni + b)))),
  };
}

/** Přepočítá čas podle korekce. Do záporných hodnot se nejde. */
export function uprav(cas: number, k: Korekce): number {
  return Math.max(0, Number((k.a * cas + k.b).toFixed(2)));
}
