/**
 * UA Cup — Capa de datos Supabase (registro, récords, ranking)
 */

let supabaseClient = null;

function initApi(client) {
  supabaseClient = client;
}

function esMejorRecord(nuevosGoles, nuevaDuracion, golesActuales, duracionActual) {
  if (nuevosGoles > golesActuales) return true;
  if (nuevosGoles < golesActuales) return false;
  return nuevaDuracion < duracionActual;
}

async function nombreJugadorExiste(nombre) {
  if (!supabaseClient) return false;

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .select('nombre_jugador')
    .eq('nombre_jugador', nombre)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function registrarJugador(nombre) {
  if (!supabaseClient) return { ok: true };

  const { error } = await supabaseClient
    .from('leaderboard')
    .insert({
      nombre_jugador: nombre,
      goles: 0,
      duracion_ms: 0
    });

  if (error) {
    if (error.code === '23505') return { ok: false, duplicate: true };
    return { ok: false, duplicate: false };
  }
  return { ok: true };
}

async function obtenerRecordJugador(nombre) {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .select('goles, duracion_ms')
    .eq('nombre_jugador', nombre)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function guardarPuntaje(nombre, goles, duracion) {
  if (!supabaseClient) return;

  const actual = await obtenerRecordJugador(nombre);

  if (actual && !esMejorRecord(goles, duracion, actual.goles, actual.duracion_ms)) {
    return;
  }

  const payload = { nombre_jugador: nombre, goles, duracion_ms: duracion };
  console.log('Intentando guardar:', { nombre, goles, duracion });

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .upsert(payload, { onConflict: 'nombre_jugador' });

  console.log('Resultado de inserción:', { data, error });

  if (error) throw error;
}

async function fetchLeaderboard() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .select('nombre_jugador, goles, duracion_ms, created_at')
    .order('goles', { ascending: false })
    .order('duracion_ms', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(10);

  console.log('Resultado de lectura:', { data, error });

  if (error) throw error;
  return data || [];
}

window.UACupApi = {
  initApi,
  nombreJugadorExiste,
  registrarJugador,
  guardarPuntaje,
  fetchLeaderboard
};
