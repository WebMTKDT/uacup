/**
 * Plantilla de configuración. Copia a config.js (gitignored) o genera con:
 *   node scripts/inject-config.mjs
 */
window.__UACUP_CONFIG__ = Object.freeze({
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
});
