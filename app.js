/**
 * UA Cup — Shell de UI, navegación y flujo de registro (GDD §6–§8)
 */
(() => {
  'use strict';

  const RECORD_LOCAL_KEY = 'uacup_record_local';
  const PLAYER_NAME_KEY = 'uacup_nombre';
  const BGM_FADE_ON_CATCH_MS = 2800;
  const MAX_LOCAL_RECORD = 999;

  let muted = false;
  let validatedPlayerName = '';
  let bgmAudio = null;
  let bgmFadeRaf = null;
  let gameApi = null;
  let dataApi = null;
  const BGM_VOLUME = 0.35;

  const $ = (sel) => document.querySelector(sel);

  function consumeConfig() {
    const cfg = window.__UACUP_CONFIG__;
    if (cfg) delete window.__UACUP_CONFIG__;
    return cfg || null;
  }

  function initSupabase() {
    const cfg = consumeConfig();
    const url = cfg?.supabaseUrl || '';
    const key = cfg?.supabaseAnonKey || '';
    if (!url || !key) {
      console.warn('UA Cup: faltan credenciales Supabase (config.js / variables de entorno)');
      return null;
    }
    if (!window.supabase) {
      console.warn('UA Cup: librería @supabase/supabase-js no cargada');
      return null;
    }
    return window.supabase.createClient(url, key);
  }

  function sanitizeStoredName(raw) {
    if (!dataApi?.sanitizePlayerName) return '';
    return dataApi.sanitizePlayerName(raw);
  }

  function getPlayerName() {
    if (validatedPlayerName) return validatedPlayerName;
    try {
      return sanitizeStoredName(localStorage.getItem(PLAYER_NAME_KEY) || '');
    } catch {
      return '';
    }
  }

  function setPlayerName(nombre) {
    const safe = sanitizeStoredName(nombre);
    if (!safe) return;
    validatedPlayerName = safe;
    try {
      localStorage.setItem(PLAYER_NAME_KEY, safe);
    } catch {
      /* almacenamiento no disponible */
    }
  }

  function getLocalRecord() {
    try {
      const n = parseInt(localStorage.getItem(RECORD_LOCAL_KEY) || '0', 10);
      return Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_LOCAL_RECORD) : 0;
    } catch {
      return 0;
    }
  }

  function setLocalRecord(goles) {
    const safeGoles = Number(goles);
    if (!Number.isInteger(safeGoles) || safeGoles < 0 || safeGoles > MAX_LOCAL_RECORD) return;
    const current = getLocalRecord();
    if (safeGoles > current) {
      localStorage.setItem(RECORD_LOCAL_KEY, String(safeGoles));
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

  function cancelBgmFade() {
    if (bgmFadeRaf != null) {
      cancelAnimationFrame(bgmFadeRaf);
      bgmFadeRaf = null;
    }
  }

  function fadeOutBgm(durationMs = BGM_FADE_ON_CATCH_MS) {
    initBgm();
    if (!bgmAudio || muted) return;

    cancelBgmFade();
    const startVolume = bgmAudio.volume;
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 2);
      bgmAudio.volume = Math.max(0, startVolume * (1 - eased));

      if (progress < 1) {
        bgmFadeRaf = requestAnimationFrame(step);
        return;
      }

      stopBgm();
      bgmAudio.volume = BGM_VOLUME;
      bgmFadeRaf = null;
    };

    bgmFadeRaf = requestAnimationFrame(step);
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
    cancelBgmFade();
    bgmAudio.volume = BGM_VOLUME;
    bgmAudio.play().catch(() => {
      /* Autoplay bloqueado hasta interacción del usuario */
    });
  }

  function stopBgm() {
    cancelBgmFade();
    if (!bgmAudio) return;
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
  }

  function startGame() {
    playBgm();
    showScreen('game-screen');
    updateRecordHUD();
    showIntroMessage();
    gameApi?.start();
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
    gameApi?.pause();
    gameApi?.reset();
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
    if (bgmAudio && bgmAudio.volume > 0.02 && !bgmFadeRaf) {
      fadeOutBgm(500);
    }
    showScreen('game-screen');

    endScreen.classList.remove('hidden', 'slide-in');
    endScreen.classList.add('visible');
    endScreen.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => endScreen.classList.add('slide-in'));
    });
  }

  function formatLeaderboardTime(ms) {
    const safe = Number(ms);
    if (!Number.isFinite(safe) || safe < 0) return '0.0s';
    return `${(safe / 1000).toFixed(1)}s`;
  }

  function setLeaderboardMessage(message) {
    const tbody = $('#leaderboard-body');
    if (!tbody) return;
    tbody.replaceChildren();
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'leaderboard-empty';
    td.textContent = message;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function renderLeaderboard(rows) {
    const tbody = $('#leaderboard-body');
    if (!tbody) return;

    tbody.replaceChildren();

    if (!Array.isArray(rows) || !rows.length) {
      setLeaderboardMessage('Sin registros aún.');
      return;
    }

    rows.forEach((row, i) => {
      const tr = document.createElement('tr');

      const tdRank = document.createElement('td');
      tdRank.textContent = String(i + 1);

      const tdName = document.createElement('td');
      tdName.textContent = String(row.nombre_jugador ?? '');

      const tdScore = document.createElement('td');
      tdScore.className = 'score-cell';
      const goles = Number(row.goles);
      tdScore.textContent = `${Number.isFinite(goles) ? goles : 0} `;
      const span = document.createElement('span');
      span.className = 'time-cell';
      span.textContent = `(${formatLeaderboardTime(row.duracion_ms)})`;
      tdScore.appendChild(span);

      const tdTime = document.createElement('td');
      tdTime.className = 'time-cell';
      tdTime.textContent = formatLeaderboardTime(row.duracion_ms);

      tr.append(tdRank, tdName, tdScore, tdTime);
      tbody.appendChild(tr);
    });
  }

  async function openLeaderboard() {
    const modal = $('#leaderboard-modal');
    if (!modal) return;

    setLeaderboardMessage('Cargando ranking…');
    modal.showModal();

    try {
      const rows = await dataApi?.fetchLeaderboard();
      renderLeaderboard(rows || []);
    } catch {
      setLeaderboardMessage('No se pudo cargar el ranking.');
    }
  }

  function openRegisterModal() {
    if (gameApi?.getPhase() === 'PLAYING') return;

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

  function isValidScorePayload(score) {
    if (!score || typeof score !== 'object') return false;
    return dataApi?.validateScore(score.goles, score.duracion_ms) ?? false;
  }

  async function handleGameOver(score) {
    if (!isValidScorePayload(score)) {
      console.warn('UA Cup: puntaje inválido descartado');
      return;
    }

    showEndScreen(score);

    const nombre = getPlayerName();
    if (!nombre || !dataApi) return;

    try {
      await dataApi.guardarPuntaje(nombre, score.goles, score.duracion_ms);
      const rows = await dataApi.fetchLeaderboard();
      renderLeaderboard(rows);
    } catch (err) {
      console.error('UA Cup: error al guardar puntaje o actualizar ranking', err);
    }
  }

  async function onRegisterSubmit(e) {
    e.preventDefault();
    const input = $('#register-username');
    const error = $('#register-error');
    if (!input || !dataApi) return;

    const nombre = dataApi.sanitizePlayerName(input.value);
    if (!nombre) {
      shakeRegisterForm();
      return;
    }

    try {
      const existe = await dataApi.nombreJugadorExiste(nombre);
      if (existe) {
        if (error) error.classList.remove('hidden');
        shakeRegisterForm();
        return;
      }

      const result = await dataApi.registrarJugador(nombre);
      if (!result.ok) {
        if (result.duplicate && error) error.classList.remove('hidden');
        shakeRegisterForm();
        return;
      }

      setPlayerName(nombre);
      $('#register-modal')?.close();
      if (error) error.classList.add('hidden');

      try {
        const rows = await dataApi.fetchLeaderboard();
        renderLeaderboard(rows);
      } catch {
        /* ranking opcional tras registro */
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

  document.addEventListener('uacup:engine-ready', (e) => {
    gameApi = e.detail;
  });

  document.addEventListener('uacup:api-ready', (e) => {
    dataApi = e.detail;
  });

  document.addEventListener('uacup:gameover', (e) => {
    handleGameOver(e.detail);
  });

  document.addEventListener('uacup:ball-caught', () => {
    fadeOutBgm(BGM_FADE_ON_CATCH_MS);
  });

  document.addEventListener('DOMContentLoaded', () => {
    initBgm();
    const client = initSupabase();
    if (dataApi) {
      dataApi.initApi(client);
    }
    validatedPlayerName = getPlayerName();
    updateRecordHUD();
    bindUI();
    updateBgmButtonUI();
  });
})();
