/**
 * UA Cup — Capa de datos Supabase (registro, récords, ranking)
 * Encapsulado en IIFE; sin exposición global del cliente.
 */
(() => {
  'use strict';

  const PLAYER_NAME_RE = /^[A-Za-z0-9]{1,12}$/;
  const MAX_GOLES = 999;
  const MAX_DURACION_MS = 3_600_000;
  const MIN_MS_PER_GOL = 150;

  let supabaseClient = null;

  function sanitizePlayerName(raw) {
    const nombre = String(raw || '').trim();
    return PLAYER_NAME_RE.test(nombre) ? nombre : '';
  }

  function validateScore(goles, duracionMs) {
    const g = Number(goles);
    const d = Number(duracionMs);
    if (!Number.isInteger(g) || g < 0 || g > MAX_GOLES) return false;
    if (!Number.isFinite(d) || d < 0 || d > MAX_DURACION_MS) return false;
    if (g > 0 && d < g * MIN_MS_PER_GOL) return false;
    return true;
  }

  function initApi(client) {
    supabaseClient = client;
  }

  async function nombreJugadorExiste(nombre) {
    if (!supabaseClient) return false;

    const safeName = sanitizePlayerName(nombre);
    if (!safeName) return false;

    const { data, error } = await supabaseClient
      .from('leaderboard')
      .select('nombre_jugador')
      .eq('nombre_jugador', safeName)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async function registrarJugador(nombre) {
    if (!supabaseClient) return { ok: true };

    const safeName = sanitizePlayerName(nombre);
    if (!safeName) return { ok: false, duplicate: false };

    const { error } = await supabaseClient
      .from('leaderboard')
      .insert({
        nombre_jugador: safeName,
        goles: 0,
        duracion_ms: 0
      });

    if (error) {
      if (error.code === '23505') return { ok: false, duplicate: true };
      return { ok: false, duplicate: false };
    }
    return { ok: true };
  }

  async function guardarPuntaje(nombre, goles, duracion) {
    if (!supabaseClient) return;

    const safeName = sanitizePlayerName(nombre);
    if (!safeName) throw new Error('Nombre de jugador inválido');

    if (!validateScore(goles, duracion)) {
      throw new Error('Puntaje rechazado por validación de seguridad');
    }

    const { error } = await supabaseClient
      .from('leaderboard')
      .upsert(
        {
          nombre_jugador: safeName,
          goles: Number(goles),
          duracion_ms: Number(duracion)
        },
        { onConflict: 'nombre_jugador' }
      );

    if (error) throw error;
  }

  async function fetchLeaderboard() {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
      .from('leaderboard')
      .select('nombre_jugador, goles, duracion_ms, created_at')
      .order('goles', { ascending: false })
      .order('duracion_ms', { ascending: true })
      .limit(10);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  const api = Object.freeze({
    initApi,
    nombreJugadorExiste,
    registrarJugador,
    guardarPuntaje,
    fetchLeaderboard,
    sanitizePlayerName,
    validateScore
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.dispatchEvent(new CustomEvent('uacup:api-ready', { detail: api }));
  }, { once: true });
})();
