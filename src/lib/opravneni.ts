import { auth } from '@/auth';

/**
 * Kontrola práv pro serverové akce.
 *
 * Middleware hlídá STRÁNKY, ne akce. Server actions se na serveru najdou
 * podle svého ID, ne podle routy, ze které se volají — dají se tedy poslat
 * i na veřejnou stránku, kterou middleware pustí. Každá akce, která něco
 * mění nebo stojí peníze, si proto musí ověřit práva sama.
 */
export async function jenSpravce() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('Nemáte oprávnění k této akci.');
  }
  return session;
}

/** Je volající správce? Vrací true/false místo výjimky. */
export async function jeSpravce() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}
