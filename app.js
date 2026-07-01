/**
 * UA Cup — Shell de UI, navegación y Supabase (GDD §6–§8)
 */

const RECORD_LOCAL_KEY = 'uacup_record_local';
const GAME_OVER_PAUSE_MS = 1200;

const SUPABASE_URL = window.UACUP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.UACUP_SUPABASE_ANON_KEY || '';

let supabaseClient = null;
let muted = false;
let pendingScore = null;
let validatedPlayerName = '';

const $ = (sel) => document.querySelector(sel);

function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) return null;
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getLocalRecord() {
  try {
    return parseInt(localStorage.getItem(RECORD_LOCAL_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function setLocalRecord(goles) {
  const current = getLocalRecord();
  if (goles > current) {
    localStorage.setItem(RECORD_LOCAL_KEY, String(goles));
  }
  updateRecordHUD();
}

function updateRecordHUD() {
  const el = $('#hud-record');
  if (el) el.textContent = String(getLocalRecord());
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => {
    const active = screen.id === id;
    screen.classList.toggle('screen--active', active);
    screen.hidden = !active;
  });
}

function showIntroMessage() {
  const intro = $('#intro-message');
  if (!intro) return;
  intro.classList.remove('fade-out');
  intro.style.display = 'block';
  setTimeout(() => intro.classList.add('fade-out'), 1500);
  setTimeout(() => { intro.style.display = 'none'; }, 2100);
}

function startGame() {
  showScreen('game-screen');
  updateRecordHUD();
  showIntroMessage();
  if (window.UACup) window.UACup.iniciarJuego();
}

function exitToMenu() {
  if (window.UACup) window.UACup.pausarJuego();
  const endScreen = $('#end-screen');
  if (endScreen) {
    endScreen.classList.add('hidden');
    endScreen.classList.remove('visible', 'slide-in');
    endScreen.setAttribute('aria-hidden', 'true');
  }
  showScreen('boot-screen');
}

function showEndScreen(data) {
  const endScreen = $('#end-screen');
  if (!endScreen) return;

  const golesEl = $('#end-goles');
  const tiempoEl = $('#end-tiempo');
  const nameEl = $('#end-player-name');

  if (golesEl) golesEl.textContent = String(data.goles);
  if (tiempoEl) tiempoEl.textContent = (data.duracion_ms / 1000).toFixed(1);

  if (nameEl) {
    if (validatedPlayerName) {
      nameEl.textContent = validatedPlayerName;
      nameEl.classList.remove('hidden');
      nameEl.setAttribute('aria-hidden', 'false');
    } else {
      nameEl.classList.add('hidden');
      nameEl.setAttribute('aria-hidden', 'true');
    }
  }

  setLocalRecord(data.goles);
  showScreen('game-screen');

  endScreen.classList.remove('hidden', 'slide-in');
  endScreen.classList.add('visible');
  endScreen.setAttribute('aria-hidden', 'false');

  setTimeout(() => endScreen.classList.add('slide-in'), GAME_OVER_PAUSE_MS);
}

function formatLeaderboardTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
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

  if (error) throw error;
  return data || [];
}

function renderLeaderboard(rows) {
  const tbody = $('#leaderboard-body');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">Sin registros aún.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(row.nombre_jugador)}</td>
      <td class="score-cell">${row.goles} <span class="time-cell">(${formatLeaderboardTime(row.duracion_ms)})</span></td>
      <td class="time-cell">${formatLeaderboardTime(row.duracion_ms)}</td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function openLeaderboard() {
  const modal = $('#leaderboard-modal');
  if (!modal) return;

  renderLeaderboard([]);
  const tbody = $('#leaderboard-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">Cargando ranking…</td></tr>';

  modal.showModal();

  try {
    const rows = await fetchLeaderboard();
    renderLeaderboard(rows);
  } catch {
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">No se pudo cargar el ranking.</td></tr>';
    }
  }
}

async function getTenthPlace() {
  if (!supabaseClient) return null;
  const rows = await fetchLeaderboard();
  return rows.length >= 10 ? rows[9] : null;
}

function qualifiesForTop10(score, tenth) {
  if (!tenth) return score.goles > 0;
  if (score.goles > tenth.goles) return true;
  if (score.goles < tenth.goles) return false;
  return score.duracion_ms <= tenth.duracion_ms;
}

async function submitScore(nombre, score) {
  if (!supabaseClient) return { ok: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const { error } = await supabaseClient
      .from('leaderboard')
      .insert({
        nombre_jugador: nombre,
        goles: score.goles,
        duracion_ms: score.duracion_ms
      });

    clearTimeout(timeout);
    if (error) {
      if (error.code === '23505') return { ok: false, duplicate: true };
      return { ok: false, duplicate: false };
    }
    return { ok: true };
  } catch {
    clearTimeout(timeout);
    return { ok: false, duplicate: false };
  }
}

function openRegisterModal() {
  const modal = $('#register-modal');
  const input = $('#register-username');
  const error = $('#register-error');
  if (!modal) return;

  if (error) error.classList.add('hidden');
  if (input) {
    input.value = '';
    input.classList.remove('register-form-shake');
  }
  modal.showModal();
  if (input) input.focus();
}

async function handleGameOver(score) {
  pendingScore = score;
  validatedPlayerName = '';

  try {
    const tenth = await getTenthPlace();
    if (qualifiesForTop10(score, tenth)) {
      openRegisterModal();
      return;
    }
  } catch {
    /* Sin conexión: mostrar resultados sin registro */
  }

  await trySilentSubmit();
  showEndScreen(score);
}

async function trySilentSubmit() {
  if (!pendingScore || !supabaseClient) return;
  await submitScore('Anónimo', pendingScore).catch(() => {});
}

async function onRegisterSubmit(e) {
  e.preventDefault();
  const form = $('#register-form');
  const input = $('#register-username');
  const error = $('#register-error');
  if (!input || !pendingScore) return;

  const nombre = input.value.trim();
  if (!/^[A-Za-z0-9]{1,12}$/.test(nombre)) {
    if (form) form.classList.add('register-form-shake');
    setTimeout(() => form?.classList.remove('register-form-shake'), 500);
    return;
  }

  const result = await submitScore(nombre, pendingScore);

  if (result.duplicate) {
    if (error) error.classList.remove('hidden');
    if (form) {
      form.classList.add('register-form-shake');
      setTimeout(() => form.classList.remove('register-form-shake'), 500);
    }
    return;
  }

  validatedPlayerName = nombre;
  $('#register-modal')?.close();
  if (error) error.classList.add('hidden');
  showEndScreen(pendingScore);
}

function shareScore() {
  const goles = $('#end-goles')?.textContent || '0';
  const tiempo = $('#end-tiempo')?.textContent || '0';
  const text = `¡Hice ${goles} goles en ${tiempo}s en UA Cup! Muerte súbita — ¿me superas?`;

  if (navigator.share) {
    navigator.share({ title: 'UA Cup', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function bindUI() {
  $('#btn-jugar')?.addEventListener('click', startGame);

  $('#btn-leaderboard')?.addEventListener('click', openLeaderboard);
  $('#btn-end-leaderboard')?.addEventListener('click', openLeaderboard);
  $('#btn-close-leaderboard')?.addEventListener('click', () => $('#leaderboard-modal')?.close());

  $('#btn-close-game')?.addEventListener('click', exitToMenu);

  $('#btn-mute')?.addEventListener('click', (e) => {
    muted = !muted;
    const btn = e.currentTarget;
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-pressed', String(muted));
  });

  $('#btn-play-again')?.addEventListener('click', () => {
    $('#end-screen')?.classList.remove('visible', 'slide-in');
    startGame();
  });

  $('#btn-share')?.addEventListener('click', shareScore);

  $('#register-form')?.addEventListener('submit', onRegisterSubmit);

  $('#leaderboard-modal')?.addEventListener('click', (e) => {
    if (e.target === $('#leaderboard-modal')) e.target.close();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  supabaseClient = initSupabase();
  updateRecordHUD();
  bindUI();

  window.onUACupGameOver = handleGameOver;
});
