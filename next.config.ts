import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['fluent-ffmpeg', '@ffmpeg-installer/ffmpeg', 'sharp'],
  experimental: {
    // Kolik těla requestu si smí Next naklonovat do paměti, když na routu sedí
    // middleware. Přes limit se tělo mlčky uřízne a handler dostane půlku –
    // u uploadu to shodí `req.formData()`. Výchozích 10 MB bylo málo (MP3
    // ve 320 kb/s má klidně 11 MB). Vlastní upload middleware neprochází
    // (viz vyjímka v `src/middleware.ts`), tohle je pojistka pro ostatní routy.
    proxyClientMaxBodySize: '20mb',
  },
};

export default nextConfig;
