const { execSync } = require('child_process');

console.log("⚙️  Karacho: Inicializace spouštěcího skriptu...");

// Načteme proměnné prostředí z .env souborů v lokálním vývoji (Next.js standard)
try {
  const { loadEnvConfig } = require('@next/env');
  loadEnvConfig(process.cwd());
} catch (e) {
  // Na produkci/Railway se použijí nativní systémové proměnné
}

// 1. Vyčištění uvozovek z proměnných prostředí (Railway specifikum)
console.log("🧹 Kontrola a čištění proměnných prostředí...");
const cleanedKeys = [];
for (const key in process.env) {
  const val = process.env[key];
  if (typeof val === 'string') {
    // Odstraní případné uvozovky ze začátku a konce hodnoty
    const cleaned = val.replace(/^["']|["']$/g, '').trim();
    if (cleaned !== val) {
      process.env[key] = cleaned;
      cleanedKeys.push(key);
    }
  }
}

if (cleanedKeys.length > 0) {
  console.log(`✅ Úspěšně vyčištěny uvozovky v proměnných: ${cleanedKeys.join(", ")}`);
} else {
  console.log("ℹ️ Žádné uvozovky v proměnných prostředí nebyly detekovány.");
}

// 2. Diagnostika a validace kritických proměnných
if (!process.env.DATABASE_URL) {
  console.error("❌ CHYBA: Proměnná DATABASE_URL není nastavena!");
  console.error("👉 Zkontroluj prosím záložku 'Variables' ve své službě na Railway a ujisti se, že je tam DATABASE_URL přítomna a správně propojena s PostgreSQL.");
  process.exit(1);
}

console.log("🔎 Diagnostika databáze:");
try {
  const url = new URL(process.env.DATABASE_URL);
  console.log(`   - Protokol: ${url.protocol}`);
  console.log(`   - Hostitel: ${url.hostname}`);
  console.log(`   - Port: ${url.port || 'výchozí'}`);
  console.log(`   - Databáze: ${url.pathname.substring(1)}`);
} catch (e) {
  console.warn("⚠️  DATABASE_URL má nestandardní formát, ale zkusíme ji předat Prismě.");
}

// 3. Spuštění Prisma synchronizace databáze
console.log("🔄 Spouštím 'prisma db push' pro synchronizaci databáze...");
try {
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  console.log("✅ Databáze byla úspěšně synchronizována.");
} catch (error) {
  console.error("❌ CHYBA: Nepodařilo se připojit k databázi nebo synchronizovat schéma!");
  console.error("👉 Zkontroluj, zda databáze na Railway běží, a zda se nezměnil její veřejný port.");
  console.error("Podrobnosti chyby:", error.message);
  process.exit(1);
}

// 4. Spuštění Next.js serveru
console.log("🚀 Spouštím Next.js server na rozhraní 0.0.0.0...");
const port = process.env.PORT || '3000';
try {
  // Explicitně vynutíme vazbu na 0.0.0.0 pro přístup zvenčí na Railway
  execSync(`npx next start -p ${port} -H 0.0.0.0`, { stdio: 'inherit' });
} catch (error) {
  console.error("❌ Next.js server neočekávaně skončil:");
  console.error(error.message);
  process.exit(1);
}
