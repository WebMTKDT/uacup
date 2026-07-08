/**
 * UA Cup — Shell de UI, navegación y flujo de registro (GDD §6–§8)
 */

const RECORD_LOCAL_KEY = 'uacup_record_local';
const PLAYER_NAME_KEY = 'uacup_nombre';
const GAME_OVER_PAUSE_MS = 1200;

let muted = false;
let validatedPlayerName = '';
let bgmAudio = null;
const BGM_VOLUME = 0.35;

const $ = (sel) => document.querySelector(sel);

function initSupabase() {
  const url = window.UACUP_SUPABASE_URL || '';
  const key = window.UACUP_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    console.warn('UA Cup: faltan UACUP_SUPABASE_URL o UACUP_SUPABASE_ANON_KEY');
    return null;
  }
  if (!window.supabase) {
    console.warn('UA Cup: librería @supabase/supabase-js no cargada');
    return null;
  }
  const client = window.supabase.createClient(url, key);
  console.log('UA Cup: Supabase inicializado con URL:', url);
  return client;
}

function getPlayerName() {
  if (validatedPlayerName) return validatedPlayerName;
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  } catch {
    return '';
  }
}

function setPlayerName(nombre) {
  validatedPlayerName = nombre;
  try {
    localStorage.setItem(PLAYER_NAME_KEY, nombre);
  } catch {
    /* almacenamiento no disponible */
  }
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

function initBgm() {
  if (bgmAudio) return;
  bgmAudio = new Audio('assets/Epic Rock Action Trailer.wav');
  bgmAudio.loop = true;
  bgmAudio.preload = 'auto';
  bgmAudio.volume = BGM_VOLUME;
}

function setBgmMuted(nextMuted) {
  muted = nextMuted;
  if (!bgmAudio) return;
  bgmAudio.muted = muted;
}

function updateBgmButtonUI() {
  const btn = $('#btn-mute');
  if (!btn) return;
  btn.textContent = muted ? '🔇' : '🎵';
  btn.setAttribute('aria-pressed', String(muted));
}

function playBgm() {
  initBgm();
  if (!bgmAudio) return;
  bgmAudio.play().catch(() => {
    /* Autoplay bloqueado hasta interacción del usuario */
  });
}

function stopBgm() {
  if (!bgmAudio) return;
  bgmAudio.pause();
  bgmAudio.currentTime = 0;
}

function startGame() {
  playBgm();
  showScreen('game-screen');
  updateRecordHUD();
  showIntroMessage();
  if (window.UACup) window.UACup.iniciarJuego();
}

function onJugarClick() {
  if (!getPlayerName()) {
    openRegisterModal();
    return;
  }
  startGame();
}

function exitToMenu() {
  stopBgm();
  if (window.UACup) {
    window.UACup.pausarJuego();
    window.UACup.resetPartida();
  }
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
  const nombre = getPlayerName();

  if (golesEl) golesEl.textContent = String(data.goles);
  if (tiempoEl) tiempoEl.textContent = (data.duracion_ms / 1000).toFixed(1);

  if (nameEl) {
    if (nombre) {
      nameEl.textContent = nombre;
      nameEl.classList.remove('hidden');
      nameEl.setAttribute('aria-hidden', 'false');
    } else {
      nameEl.classList.add('hidden');
      nameEl.setAttribute('aria-hidden', 'true');
    }
  }

  setLocalRecord(data.goles);
  stopBgm();
  showScreen('game-screen');

  endScreen.classList.remove('hidden', 'slide-in');
  endScreen.classList.add('visible');
  endScreen.setAttribute('aria-hidden', 'false');

  setTimeout(() => endScreen.classList.add('slide-in'), GAME_OVER_PAUSE_MS);
}

function formatLeaderboardTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function renderLeaderboard(rows) {
  const tbody = $('#leaderboard-body');
  if (!tbody) return;

  tbody.innerHTML = '';

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
    const rows = await window.UACupApi.fetchLeaderboard();
    renderLeaderboard(rows);
  } catch {
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">No se pudo cargar el ranking.</td></tr>';
    }
  }
}

function openRegisterModal() {
  if (window.UACup && window.UACup.estado === 'PLAYING') return;

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

function shakeRegisterForm() {
  const form = $('#register-form');
  if (!form) return;
  form.classList.add('register-form-shake');
  setTimeout(() => form.classList.remove('register-form-shake'), 500);
}

async function handleGameOver(score) {
  if (window.UACup && window.UACup.estado !== 'GAMEOVER') return;

  showEndScreen(score);

  const nombre = getPlayerName();
  if (!nombre || !window.UACupApi) return;

  try {
    await window.UACupApi.guardarPuntaje(nombre, score.goles, score.duracion_ms);
    const rows = await window.UACupApi.fetchLeaderboard();
    renderLeaderboard(rows);
  } catch (err) {
    console.error('UA Cup: error al guardar puntaje o actualizar ranking', err);
  }
}

async function onRegisterSubmit(e) {
  e.preventDefault();
  const input = $('#register-username');
  const error = $('#register-error');
  if (!input) return;

  const nombre = input.value.trim();
  if (!/^[A-Za-z0-9]{1,12}$/.test(nombre)) {
    shakeRegisterForm();
    return;
  }

  try {
    const existe = await window.UACupApi.nombreJugadorExiste(nombre);
    if (existe) {
      if (error) error.classList.remove('hidden');
      shakeRegisterForm();
      return;
    }

    const result = await window.UACupApi.registrarJugador(nombre);
    if (!result.ok) {
      if (result.duplicate && error) error.classList.remove('hidden');
      shakeRegisterForm();
      return;
    }

    setPlayerName(nombre);
    $('#register-modal')?.close();
    if (error) error.classList.add('hidden');

    try {
      const rows = await window.UACupApi.fetchLeaderboard();
      renderLeaderboard(rows);
    } catch {
      /* fetchLeaderboard ya registra el error en consola */
    }

    startGame();
  } catch {
    shakeRegisterForm();
  }
}

function bindUI() {
  $('#btn-jugar')?.addEventListener('click', onJugarClick);

  $('#btn-leaderboard')?.addEventListener('click', openLeaderboard);
  $('#btn-end-leaderboard')?.addEventListener('click', openLeaderboard);
  $('#btn-close-leaderboard')?.addEventListener('click', () => $('#leaderboard-modal')?.close());

  $('#btn-close-game')?.addEventListener('click', exitToMenu);
  $('#btn-home')?.addEventListener('click', exitToMenu);

  $('#btn-mute')?.addEventListener('click', () => {
    setBgmMuted(!muted);
    updateBgmButtonUI();
  });

  $('#btn-play-again')?.addEventListener('click', () => {
    $('#end-screen')?.classList.remove('visible', 'slide-in');
    startGame();
  });

  $('#register-form')?.addEventListener('submit', onRegisterSubmit);

  $('#leaderboard-modal')?.addEventListener('click', (e) => {
    if (e.target === $('#leaderboard-modal')) e.target.close();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBgm();
  const client = initSupabase();
  if (window.UACupApi) {
    window.UACupApi.initApi(client);
    if (client) {
      console.log('UA Cup: UACupApi conectada a Supabase');
    } else {
      console.warn('UA Cup: UACupApi sin cliente Supabase (modo offline)');
    }
  }
  validatedPlayerName = getPlayerName();
  updateRecordHUD();
  bindUI();

  updateBgmButtonUI();

  window.onUACupGameOver = handleGameOver;
});
