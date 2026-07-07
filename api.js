/**
 * UA Cup — Capa de datos Supabase (registro, récords, ranking)
 */

let supabaseClient = null;

function initApi(client) {
  supabaseClient = client;
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

  nombre = nombre.trim();

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

async function guardarPuntaje(nombre, goles, duracion) {
  if (!supabaseClient) {
    console.warn('UA Cup: Supabase no configurado, puntaje no guardado');
    return;
  }

  console.log('Intentando guardar:', { nombre, goles, duracion });

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .upsert(
      { nombre_jugador: nombre, goles, duracion_ms: duracion },
      { onConflict: 'nombre_jugador' }
    );

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
    .limit(10);

  if (error) throw error;
  console.log('Leaderboard crudo:', data);
  return data || [];
}

window.UACupApi = {
  initApi,
  nombreJugadorExiste,
  registrarJugador,
  guardarPuntaje,
  fetchLeaderboard
};
