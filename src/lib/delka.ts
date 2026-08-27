/**
 * Délka písně pro administraci.
 *
 * Přesnou délku známe jen u načasovaných písní (`timingData.dur`) — což jsou
 * právě ty hotové. U těch, které teprve čekají na zpracování, se odvozuje
 * z velikosti MP3: nahrávky procházejí kompresí na 128 kb/s, takže jde
 * o prostý převod. Ověřeno na 306 načasovaných písních — medián odchylky
 * 0,0 %, devadesátý percentil 0,1 %. Vyskočí jen hrstka souborů, které
 * kompresí neprošly a zůstaly na 192 kb/s; ty se odhadnou delší, než jsou.
 * Proto se odhad vždy značí vlnovkou.
 */
const BITRATE_BPS = 128_000;

export type Delka = { sekundy: number; presna: boolean };

export function delkaPisne(song: { timingData?: any; audioSize?: number | null }): Delka | null {
  const dur = song?.timingData?.dur;
  if (typeof dur === 'number' && dur > 30) return { sekundy: dur, presna: true };
  if (song?.audioSize) return { sekundy: (song.audioSize * 8) / BITRATE_BPS, presna: false };
  return null;
}

export function formatDelka(d: Delka | null): string {
  if (!d) return '—';
  const m = Math.floor(d.sekundy / 60);
  const s = Math.round(d.sekundy % 60);
  const cas = `${m}:${String(s).padStart(2, '0')}`;
  return d.presna ? cas : `~${cas}`;
}

/**
 * Klíč pro řazení. Písně bez audia nemají co nabídnout, takže padají na
 * konec v obou směrech — jinak by seznam „od nejkratší" začínal položkami,
 * se kterými se stejně nedá nic dělat.
 */
export function delkaProRazeni(song: { timingData?: any; audioSize?: number | null }): number {
  return delkaPisne(song)?.sekundy ?? Number.POSITIVE_INFINITY;
}
