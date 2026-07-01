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
  if (!supabaseClient) return;

  console.log('DEBUG: Parámetros upsert:', { nombre, goles, duracion, validos: nombre !== undefined && goles !== undefined && duracion !== undefined });
  console.log('DEBUG: Enviando a Supabase:', { nombre_jugador: nombre, goles, duracion_ms: duracion });

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .upsert(
      { nombre_jugador: nombre, goles: goles, duracion_ms: duracion },
      { onConflict: 'nombre_jugador' }
    );

  if (error) {
    console.error('ERROR CRÍTICO SUPABASE:', error);
  } else {
    console.log('ÉXITO: Datos confirmados en DB', data);
  }
}

async function fetchLeaderboard() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from('leaderboard')
    .select('*')
    .order('goles', { ascending: false })
    .order('duracion_ms', { ascending: true })
    .order('created_at', { ascending: true })
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
