'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function GlobalEscape() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC klávesa pro inteligentní navigaci "Zpět"
      if (e.code === 'Escape') {
        // Ignorujeme, pokud jsme v inputu nebo textarei
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        if (pathname.includes('/designer') || pathname.includes('/renderer')) {
          router.push('/admin');
        } else if (pathname === '/admin') {
          router.push('/');
        } else if (pathname !== '/') {
          router.back();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pathname, router]);

  return null;
}
