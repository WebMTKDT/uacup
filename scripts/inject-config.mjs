import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile(path.join(root, '.env'));
const url = process.env.UACUP_SUPABASE_URL || fileEnv.UACUP_SUPABASE_URL;
const key = process.env.UACUP_SUPABASE_ANON_KEY || fileEnv.UACUP_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('UA Cup: faltan UACUP_SUPABASE_URL o UACUP_SUPABASE_ANON_KEY en entorno o .env');
  process.exit(1);
}

const output = `/** Generado por scripts/inject-config.mjs — no editar a mano */\nwindow.__UACUP_CONFIG__ = Object.freeze({\n  supabaseUrl: ${JSON.stringify(url)},\n  supabaseAnonKey: ${JSON.stringify(key)}\n});\n`;

fs.writeFileSync(path.join(root, 'config.js'), output, 'utf8');
console.log('UA Cup: config.js generado correctamente');
