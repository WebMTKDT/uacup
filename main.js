/**
 * UA Cup — Núcleo interactivo del juego (penaltis muerte súbita)
 * Parámetros según GDD (uacup.md)
 */

// ═══════════════════════════════════════════
// CONSTANTES (GDD)
// ═══════════════════════════════════════════

const VIEWPORT = { W: 1080, H: 1920 };
const VIEWPORT_ASPECT = VIEWPORT.W / VIEWPORT.H;
const CANVAS_HEIGHT_RATIO = 0.90;
const FRICTION = 0.98;
const MIN_DRAG_PX = 50;
const BALL_RADIUS = 65;
const BALL_START_X = VIEWPORT.W / 2;
const BALL_START_Y = VIEWPORT.H * 0.85;

const GOAL_LINE_Y = 300;
const GOAL_LEFT = 260;
const GOAL_RIGHT = 820;
const POST_THICKNESS = 24;
const CROSSBAR_THICKNESS = 20;

const GK_WIDTH = 130;
const GK_HEIGHT = 170;
const GK_BASE_Y = GOAL_LINE_Y + 90;

const PORTERO_TIEMPO_BASE = 2.5;
const PORTERO_IDLE_BASE = 0.3;
const DIFICULTAD_TIEMPO_FACTOR = 0.96;
const DIFICULTAD_IDLE_FACTOR = 0.95;
const EASE_IN_OUT_DESDE_GOL = 12;

const RESET_BALON_MS = 400;
const FLOAT_PLUS_MS = 1000;
const GK_CATCH_DISPLAY_MS = 1750;
const GK_VICTORY_DISPLAY_MS = 1000;
const FORCE_SCALE = 0.38;

const ASSET_PATHS = {
  porteria: 'assets/porteria.png',
  balon: 'assets/balon.png'
};

const GK_SPRITE_PATHS = {
  idle: 'assets/idle-max.png',
  shiftL: 'assets/left-lateral-shift-max.png',
  shiftR: 'assets/right-lateral-shift-max.png',
  diveL: 'assets/left-dive-max.png',
  diveR: 'assets/right-dive-max.png',
  catch: 'assets/caught-ball-max.png',
  victory: 'assets/victory-pose-max.png'
};

const GkVisuals = {
  images: {},
  currentState: 'idle',
  previousState: 'idle',
  transitionAlpha: 1,
  TRANSITION_SPEED: 8
};

const GameAssets = {
  porteria: null,
  balon: null
};

let assetsReady = false;
let assetsLoadPromise = null;

// ═══════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════

/** @type {'IDLE'|'PLAYING'|'GOAL_PAUSE'|'GAMEOVER_ANIM'|'GAMEOVER'} */
let estadoJuego = 'IDLE';

let tiempoInicio = null;
let duracionTotal = 0;
let racha = 0;

let porteroTiempoRecorrido = PORTERO_TIEMPO_BASE;
let porteroIdle = PORTERO_IDLE_BASE;

// ═══════════════════════════════════════════
// ENTIDADES
// ═══════════════════════════════════════════

const Balon = {
  x: BALL_START_X,
  y: BALL_START_Y,
  vx: 0,
  vy: 0,
  activo: true,
  enVuelo: false,
  tocoPortero: false,
  tocoPalo: false
};

const Portero = {
  x: GOAL_LEFT + GK_WIDTH / 2,
  y: GK_BASE_Y,
  direccion: 1,
  fase: 'mover',
  faseTiempo: 0,
  minX: GOAL_LEFT + GK_WIDTH / 2,
  maxX: GOAL_RIGHT - GK_WIDTH / 2
};

// ═══════════════════════════════════════════
// INPUT (POINTER EVENTS)
// ═══════════════════════════════════════════

const pointer = {
  activo: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  pointerId: null
};

// ═══════════════════════════════════════════
// RUNTIME
// ═══════════════════════════════════════════

let canvas = null;
let ctx = null;
let animId = null;
let lastFrame = 0;
let goalResetTimer = 0;
let floatPlusTimer = 0;
let showFloatPlus = false;
let primerDisparoHecho = false;
/** @type {'catch'|'victory'|null} */
let gkDefeatPhase = null;
let gkDefeatTimer = 0;

// ═══════════════════════════════════════════
// PRECARGA DE ASSETS
// ═══════════════════════════════════════════

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    img.src = src;
  });
}

/** Convierte fondo negro opaco a alpha real (JPEG disfrazado de PNG). */
function loadPorteriaImage(src, darkThreshold = 45) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const off = document.createElement('canvas');
      off.width = img.naturalWidth;
      off.height = img.naturalHeight;
      const octx = off.getContext('2d');
      octx.drawImage(img, 0, 0);
      const { data } = octx.getImageData(0, 0, off.width, off.height);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] <= darkThreshold && data[i + 1] <= darkThreshold && data[i + 2] <= darkThreshold) {
          data[i + 3] = 0;
        }
      }
      octx.putImageData(new ImageData(data, off.width, off.height), 0, 0);
      const processed = new Image();
      processed.onload = () => resolve(processed);
      processed.onerror = reject;
      processed.src = off.toDataURL('image/png');
    };
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    img.src = src;
  });
}

function preloadAssets() {
  if (assetsReady) return Promise.resolve();
  if (assetsLoadPromise) return assetsLoadPromise;

  assetsLoadPromise = Promise.all([
    loadPorteriaImage(ASSET_PATHS.porteria).then((img) => { GameAssets.porteria = img; }),
    loadImage(ASSET_PATHS.balon).then((img) => { GameAssets.balon = img; }),
    ...Object.entries(GK_SPRITE_PATHS).map(([key, src]) =>
      loadImage(src).then((img) => { GkVisuals.images[key] = img; })
    )
  ])
    .then(() => {
      assetsReady = true;
      console.log('UA Cup: assets precargados correctamente (incl. Max el Pingüino)');
    })
    .catch((err) => {
      console.warn('UA Cup: error al precargar assets, usando fallback vectorial', err);
      assetsReady = false;
      assetsLoadPromise = null;
    });

  return assetsLoadPromise;
}

// ═══════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function formatDuracion(ms) {
  const totalSeg = ms / 1000;
  const seg = Math.floor(totalSeg);
  const dec = Math.floor((totalSeg - seg) * 10);
  return `${String(seg).padStart(2, '0')}:${String(dec).padStart(1, '0')}`;
}

function formatTiempoJuego(ms) {
  if (ms == null) return '00:00.0';
  const totalSeg = ms / 1000;
  const min = Math.floor(totalSeg / 60);
  const seg = Math.floor(totalSeg % 60);
  const dec = Math.floor((totalSeg % 1) * 10);
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}.${dec}`;
}

/** Convierte coordenadas del puntero al espacio lógico del canvas (1080×1920). */
function pointerToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * VIEWPORT.W;
  const y = ((clientY - rect.top) / rect.height) * VIEWPORT.H;
  return { x, y };
}

function distanciaPuntoBalon(px, py) {
  return Math.hypot(px - Balon.x, py - Balon.y);
}

function balonHitbox() {
  const d = BALL_RADIUS * 2;
  return {
    x: Balon.x - BALL_RADIUS,
    y: Balon.y - BALL_RADIUS,
    w: d,
    h: d
  };
}

function porteroHitbox() {
  return {
    x: Portero.x - GK_WIDTH / 2,
    y: Portero.y - GK_HEIGHT / 2,
    w: GK_WIDTH,
    h: GK_HEIGHT
  };
}

// ═══════════════════════════════════════════
// CANVAS Y ESCALADO
// ═══════════════════════════════════════════

/** Escala el canvas de forma uniforme (sin distorsión) para mantener proporción 9:16. */
function ajustarEscalaCanvas() {
  if (!canvas) return;

  const container = canvas.parentElement;
  const esMovil = window.innerWidth <= 767;
  let displayW;
  let displayH;

  if (esMovil) {
    const availW = window.innerWidth;
    const hud = document.querySelector('.game-hud');
    const hudH = hud?.offsetHeight || 0;
    const availH = container?.clientHeight || Math.max(0, window.innerHeight - hudH);

    displayH = availH;
    displayW = displayH * VIEWPORT_ASPECT;

    if (displayW > availW) {
      displayW = availW;
      displayH = displayW / VIEWPORT_ASPECT;
    }
  } else {
    displayH = window.innerHeight * CANVAS_HEIGHT_RATIO;
    displayW = displayH * VIEWPORT_ASPECT;
  }

  canvas.style.height = `${displayH}px`;
  canvas.style.width = `${displayW}px`;

  if (container) {
    container.style.height = esMovil ? '100%' : `${displayH}px`;
    container.style.width = esMovil ? '100%' : `${displayW}px`;
    container.style.maxWidth = '100%';
  }
}

function resizeCanvas() {
  if (!canvas) return;

  canvas.width = VIEWPORT.W;
  canvas.height = VIEWPORT.H;
  ajustarEscalaCanvas();
}

// ═══════════════════════════════════════════
// RESETEO DE ENTIDADES
// ═══════════════════════════════════════════

function resetBalon() {
  Balon.x = BALL_START_X;
  Balon.y = BALL_START_Y;
  Balon.vx = 0;
  Balon.vy = 0;
  Balon.activo = true;
  Balon.enVuelo = false;
  Balon.tocoPortero = false;
  Balon.tocoPalo = false;
}

function resetPorteroDificultad() {
  porteroTiempoRecorrido = PORTERO_TIEMPO_BASE;
  porteroIdle = PORTERO_IDLE_BASE;
  Portero.x = Portero.minX;
  Portero.direccion = 1;
  Portero.fase = 'mover';
  Portero.faseTiempo = 0;
  GkVisuals.currentState = 'idle';
  GkVisuals.previousState = 'idle';
  GkVisuals.transitionAlpha = 1;
}

function resetPartida() {
  racha = 0;
  tiempoInicio = null;
  duracionTotal = 0;
  primerDisparoHecho = false;
  goalResetTimer = 0;
  floatPlusTimer = 0;
  showFloatPlus = false;
  gkDefeatPhase = null;
  gkDefeatTimer = 0;
  resetBalon();
  resetPorteroDificultad();
  actualizarMarcadorUI();
  actualizarCronometroUI(0);
}

// ═══════════════════════════════════════════
// POINTER EVENTS
// ═══════════════════════════════════════════

function onPointerDown(e) {
  if (estadoJuego !== 'PLAYING') return;
  if (!Balon.activo || Balon.enVuelo) return;
  if (pointer.activo) return;

  const { x, y } = pointerToCanvas(e.clientX, e.clientY);
  if (distanciaPuntoBalon(x, y) > BALL_RADIUS * 2.2) return;

  pointer.activo = true;
  pointer.pointerId = e.pointerId;
  pointer.startX = x;
  pointer.startY = y;
  pointer.currentX = x;
  pointer.currentY = y;

  canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onPointerMove(e) {
  if (!pointer.activo || e.pointerId !== pointer.pointerId) return;

  const { x, y } = pointerToCanvas(e.clientX, e.clientY);
  pointer.currentX = x;
  pointer.currentY = y;
  e.preventDefault();
}

function onPointerUp(e) {
  if (!pointer.activo || e.pointerId !== pointer.pointerId) return;

  const { x, y } = pointerToCanvas(e.clientX, e.clientY);
  pointer.currentX = x;
  pointer.currentY = y;

  const dx = pointer.currentX - pointer.startX;
  const dy = pointer.currentY - pointer.startY;
  const magnitud = Math.hypot(dx, dy);

  pointer.activo = false;
  pointer.pointerId = null;

  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }

  if (magnitud >= MIN_DRAG_PX && Balon.activo && !Balon.enVuelo) {
    if (!primerDisparoHecho) {
      tiempoInicio = Date.now();
      primerDisparoHecho = true;
    }

    Balon.vx = dx * FORCE_SCALE;
    Balon.vy = dy * FORCE_SCALE;
    Balon.enVuelo = true;
  }

  e.preventDefault();
}

function bindPointerEvents() {
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.style.touchAction = 'none';
}

// ═══════════════════════════════════════════
// FÍSICA — BALÓN
// ═══════════════════════════════════════════

function updateBalon(dt) {
  if (!Balon.enVuelo) return;

  Balon.vx *= FRICTION;
  Balon.vy *= FRICTION;
  Balon.x += Balon.vx;
  Balon.y += Balon.vy;

  if (Math.abs(Balon.vx) < 0.05) Balon.vx = 0;
  if (Math.abs(Balon.vy) < 0.05) Balon.vy = 0;

  if (Balon.vx === 0 && Balon.vy === 0 && Balon.y < BALL_START_Y - 20) {
    Balon.enVuelo = false;
  }
}

// ═══════════════════════════════════════════
// MOVIMIENTO — PORTERO
// ═══════════════════════════════════════════

function determinarEstadoPortero() {
  if (estadoJuego === 'GAMEOVER_ANIM' || estadoJuego === 'GAMEOVER') {
    return GkVisuals.currentState;
  }
  if (estadoJuego === 'GOAL_PAUSE' || Portero.fase === 'idle') return 'idle';

  const margen = (Portero.maxX - Portero.minX) * 0.25;

  if (Portero.direccion === -1) {
    if (Portero.x < Portero.minX + margen) return 'diveL';
    return 'shiftL';
  }

  if (Portero.direccion === 1) {
    if (Portero.x > Portero.maxX - margen) return 'diveR';
    return 'shiftR';
  }

  return 'idle';
}

function updateGkVisuals(dt) {
  const nuevoEstado = determinarEstadoPortero();

  if (nuevoEstado !== GkVisuals.currentState) {
    GkVisuals.previousState = GkVisuals.currentState;
    GkVisuals.currentState = nuevoEstado;
    GkVisuals.transitionAlpha = 0;
  }

  GkVisuals.transitionAlpha = Math.min(1, GkVisuals.transitionAlpha + dt * GkVisuals.TRANSITION_SPEED);
}

function updatePortero(dt) {
  Portero.faseTiempo += dt;

  if (Portero.fase === 'idle') {
    if (Portero.faseTiempo >= porteroIdle) {
      Portero.fase = 'mover';
      Portero.faseTiempo = 0;
      Portero.direccion *= -1;
    }
    updateGkVisuals(dt);
    return;
  }

  const origen = Portero.direccion > 0 ? Portero.minX : Portero.maxX;
  const destino = Portero.direccion > 0 ? Portero.maxX : Portero.minX;
  const progreso = clamp(Portero.faseTiempo / porteroTiempoRecorrido, 0, 1);

  const t = racha >= EASE_IN_OUT_DESDE_GOL ? easeInOut(progreso) : progreso;
  Portero.x = origen + (destino - origen) * t;

  if (progreso >= 1) {
    Portero.x = destino;
    Portero.fase = 'idle';
    Portero.faseTiempo = 0;
  }

  updateGkVisuals(dt);
}

// ═══════════════════════════════════════════
// COLISIONES AABB
// ═══════════════════════════════════════════

function enZonaGolX() {
  return Balon.x >= GOAL_LEFT && Balon.x <= GOAL_RIGHT;
}

function enAreaGol() {
  return enZonaGolX() && Balon.y <= GOAL_LINE_Y;
}

function checkColisiones() {
  if (!Balon.enVuelo) return;

  const ball = balonHitbox();
  const gk = porteroHitbox();
  const enPorteria = enZonaGolX();

  // 1. Límites (sin game over lateral dentro del ancho de portería)
  if (Balon.y > VIEWPORT.H + 100) {
    triggerGameOver();
    return;
  }
  if (!enPorteria && (Balon.x - BALL_RADIUS < -50 || Balon.x + BALL_RADIUS > VIEWPORT.W + 50)) {
    triggerGameOver();
    return;
  }

  // 2. Colisión con el Portero
  if (aabbOverlap(ball.x, ball.y, ball.w, ball.h, gk.x, gk.y, gk.w, gk.h)) {
    iniciarSecuenciaGameOver(true);
    return;
  }

  // 3. Colisión con los Postes
  const posteIzq = { x: GOAL_LEFT - POST_THICKNESS / 2, y: GOAL_LINE_Y - CROSSBAR_THICKNESS, w: POST_THICKNESS, h: GK_BASE_Y + GK_HEIGHT - GOAL_LINE_Y + CROSSBAR_THICKNESS };
  const posteDer = { x: GOAL_RIGHT - POST_THICKNESS / 2, y: GOAL_LINE_Y - CROSSBAR_THICKNESS, w: POST_THICKNESS, h: GK_BASE_Y + GK_HEIGHT - GOAL_LINE_Y + CROSSBAR_THICKNESS };

  const tocaIzq = aabbOverlap(ball.x, ball.y, ball.w, ball.h, posteIzq.x, posteIzq.y, posteIzq.w, posteIzq.h);
  const tocaDer = aabbOverlap(ball.x, ball.y, ball.w, ball.h, posteDer.x, posteDer.y, posteDer.w, posteDer.h);

  if (tocaIzq || tocaDer) {
    if (Balon.y > GOAL_LINE_Y) {
      rebotePosteInterior(tocaIzq ? posteIzq : posteDer);
    } else if (enPorteria) {
      triggerGol();
      return;
    }
  }

  // 4. Detección de área de gol (generosa: ancho completo entre postes)
  if (enAreaGol()) {
    triggerGol();
    return;
  }
}

function rebotePosteInterior(palo) {
  const centroX = (GOAL_LEFT + GOAL_RIGHT) / 2;
  Balon.vx += (centroX - Balon.x) * 0.12;
  Balon.vy -= Math.abs(Balon.vy) * 0.35 + 4;
  if (Balon.vy > -2) Balon.vy = -4;
}

function rebotePalo(palo) {
  const ballCx = Balon.x;
  const ballCy = Balon.y;
  const paloCx = palo.x + palo.w / 2;
  const paloCy = palo.y + palo.h / 2;

  const overlapX = BALL_RADIUS + palo.w / 2 - Math.abs(ballCx - paloCx);
  const overlapY = BALL_RADIUS + palo.h / 2 - Math.abs(ballCy - paloCy);

  if (overlapX < overlapY) {
    Balon.vx *= -0.45;
    Balon.x += ballCx < paloCx ? -4 : 4;
  } else {
    Balon.vy *= -0.35;
    Balon.y += ballCy < paloCy ? -4 : 4;
  }

  Balon.vy = Math.abs(Balon.vy) + 2;
}

// ═══════════════════════════════════════════
// GOL Y GAME OVER
// ═══════════════════════════════════════════

function triggerGol() {
  estadoJuego = 'GOAL_PAUSE';
  Balon.enVuelo = false;
  Balon.vx = 0;
  Balon.vy = 0;
  Balon.y = GOAL_LINE_Y - 40;

  racha += 1;
  porteroTiempoRecorrido *= DIFICULTAD_TIEMPO_FACTOR;
  porteroIdle *= DIFICULTAD_IDLE_FACTOR;

  showFloatPlus = true;
  floatPlusTimer = FLOAT_PLUS_MS;
  goalResetTimer = RESET_BALON_MS;

  actualizarMarcadorUI();
}

function enterGkPose(state, instant = false) {
  if (GkVisuals.currentState !== state) {
    GkVisuals.previousState = GkVisuals.currentState;
    GkVisuals.currentState = state;
    GkVisuals.transitionAlpha = instant ? 1 : 0;
  } else if (instant) {
    GkVisuals.transitionAlpha = 1;
  }
}

function iniciarSecuenciaGameOver(caughtByGk) {
  if (estadoJuego === 'GAMEOVER_ANIM' || estadoJuego === 'GAMEOVER') return;

  estadoJuego = 'GAMEOVER_ANIM';
  Balon.enVuelo = false;
  Balon.activo = false;
  Balon.vx = 0;
  Balon.vy = 0;
  Portero.fase = 'idle';

  if (tiempoInicio != null) {
    duracionTotal = Date.now() - tiempoInicio;
  } else {
    duracionTotal = 0;
  }

  if (caughtByGk) {
    Balon.tocoPortero = true;
    enterGkPose('catch', true);
    gkDefeatPhase = 'catch';
    gkDefeatTimer = GK_CATCH_DISPLAY_MS;
    return;
  }

  enterGkPose('victory', true);
  gkDefeatPhase = 'victory';
  gkDefeatTimer = GK_VICTORY_DISPLAY_MS;
}

function updateGameOverSequence(dt) {
  updateGkVisuals(dt);
  gkDefeatTimer -= dt * 1000;
  if (gkDefeatTimer > 0) return;

  if (gkDefeatPhase === 'catch') {
    enterGkPose('victory', false);
    gkDefeatPhase = 'victory';
    gkDefeatTimer = GK_VICTORY_DISPLAY_MS;
    return;
  }

  if (gkDefeatPhase === 'victory') {
    finalizarGameOver();
  }
}

function finalizarGameOver() {
  if (estadoJuego === 'GAMEOVER') return;

  estadoJuego = 'GAMEOVER';
  gkDefeatPhase = null;
  gkDefeatTimer = 0;

  const finalScore = { goles: racha, duracion_ms: duracionTotal };
  mostrarPantallaFinal(finalScore);
}

function triggerGameOver() {
  iniciarSecuenciaGameOver(false);
}

function mostrarPantallaFinal(score) {
  if (typeof window.onUACupGameOver === 'function') {
    window.onUACupGameOver(score || { goles: racha, duracion_ms: duracionTotal });
  }
}

// ═══════════════════════════════════════════
// UI EN JUEGO
// ═══════════════════════════════════════════

function actualizarMarcadorUI() {
  const rachaEl = document.getElementById('hud-racha') || document.querySelector('[data-hud-racha]');
  if (rachaEl) rachaEl.textContent = String(racha);
}

function actualizarCronometroUI(elapsedMs) {
  const timerEl = document.getElementById('hud-timer') || document.querySelector('[data-hud-timer]');
  if (timerEl) timerEl.textContent = formatTiempoJuego(elapsedMs);
}

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════

function drawField() {
  if (GameAssets.porteria) {
    const goalW = GOAL_RIGHT - GOAL_LEFT + POST_THICKNESS;
    const goalH = GK_BASE_Y + GK_HEIGHT - GOAL_LINE_Y + CROSSBAR_THICKNESS;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(
      GameAssets.porteria,
      GOAL_LEFT - POST_THICKNESS / 2,
      GOAL_LINE_Y - CROSSBAR_THICKNESS,
      goalW,
      goalH
    );
    ctx.restore();
  }
}

function drawGkSprite(stateKey, alpha) {
  const img = GkVisuals.images[stateKey];
  if (!img || alpha <= 0) return;

  const drawW = GK_WIDTH * 1.5;
  const drawH = GK_HEIGHT * 1.5;
  const drawX = Portero.x - drawW / 2;
  const drawY = Portero.y - drawH / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

function drawPortero() {
  const hasSprites = GkVisuals.images.idle;

  if (!hasSprites) {
    const gk = porteroHitbox();
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(gk.x, gk.y, gk.w, gk.h);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(gk.x, gk.y, gk.w, gk.h);
    return;
  }

  const alphaPrev = 1 - GkVisuals.transitionAlpha;
  const alphaCurr = GkVisuals.transitionAlpha;

  if (GkVisuals.previousState !== GkVisuals.currentState && alphaPrev > 0) {
    drawGkSprite(GkVisuals.previousState, alphaPrev);
  }
  drawGkSprite(GkVisuals.currentState, alphaCurr);
}

function drawBalon() {
  const size = BALL_RADIUS * 2;

  if (GameAssets.balon) {
    ctx.drawImage(
      GameAssets.balon,
      Balon.x - BALL_RADIUS,
      Balon.y - BALL_RADIUS,
      size,
      size
    );
    return;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(Balon.x, Balon.y + BALL_RADIUS * 0.6, BALL_RADIUS * 0.85, BALL_RADIUS * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(Balon.x, Balon.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawAimLine() {
  if (!pointer.activo || Balon.enVuelo) return;

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(pointer.startX, pointer.startY);
  ctx.lineTo(pointer.currentX, pointer.currentY);
  ctx.stroke();
  ctx.setLineDash([]);

  const dx = pointer.startX - pointer.currentX;
  const dy = pointer.startY - pointer.currentY;
  const mag = Math.hypot(dx, dy);
  if (mag < MIN_DRAG_PX) return;

  ctx.strokeStyle = 'rgba(236, 119, 0, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(Balon.x, Balon.y);
  ctx.lineTo(Balon.x + dx, Balon.y + dy);
  ctx.stroke();
}

function updateFloatPlus(dt) {
  if (!showFloatPlus) return;
  floatPlusTimer -= dt * 1000;
  if (floatPlusTimer <= 0) showFloatPlus = false;
}

function drawFloatPlus() {
  if (!showFloatPlus) return;

  const alpha = clamp(floatPlusTimer / FLOAT_PLUS_MS, 0, 1);
  const offsetY = (1 - alpha) * 60;
  const x = VIEWPORT.W / 2;
  const y = VIEWPORT.H * 0.42 - offsetY;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '700 88px Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const label = '+1';
  const textW = ctx.measureText(label).width;
  const padX = 30;
  const padY = 18;
  const boxW = textW + padX * 2;
  const boxH = 88 + padY * 2;
  const diameter = Math.max(boxW, boxH);

  ctx.fillStyle = '#ec7700';
  ctx.beginPath();
  ctx.arc(x, y, diameter / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 2);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, VIEWPORT.W, VIEWPORT.H);
  drawField();
  drawPortero();
  drawBalon();
  drawAimLine();
  drawFloatPlus();
}

// ═══════════════════════════════════════════
// BUCLE PRINCIPAL
// ═══════════════════════════════════════════

function gameLoop(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const dt = Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;

  if (estadoJuego === 'PLAYING') {
    updateBalon(dt);
    updatePortero(dt);
    updateFloatPlus(dt);
    checkColisiones();

    if (tiempoInicio != null) {
      actualizarCronometroUI(Date.now() - tiempoInicio);
    }
  } else if (estadoJuego === 'GOAL_PAUSE') {
    updatePortero(dt);
    updateFloatPlus(dt);
    goalResetTimer -= dt * 1000;

    if (goalResetTimer <= 0) {
      resetBalon();
      estadoJuego = 'PLAYING';
    }
  } else if (estadoJuego === 'GAMEOVER_ANIM') {
    updateGameOverSequence(dt);
  } else if (estadoJuego === 'GAMEOVER') {
    updateGkVisuals(dt);
  }

  render();

  if (estadoJuego !== 'GAMEOVER') {
    animId = requestAnimationFrame(gameLoop);
  }
}

function detenerBucle() {
  if (animId != null) {
    cancelAnimationFrame(animId);
    animId = null;
  }
  lastFrame = 0;
}

// ═══════════════════════════════════════════
// API PÚBLICA (menús / Supabase externos)
// ═══════════════════════════════════════════

function iniciarJuego() {
  canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.warn('UA Cup: #gameCanvas no encontrado.');
    return;
  }

  ctx = canvas.getContext('2d');
  resizeCanvas();
  requestAnimationFrame(() => resizeCanvas());
  window.addEventListener('resize', resizeCanvas);

  if (!canvas.dataset.pointerBound) {
    bindPointerEvents();
    canvas.dataset.pointerBound = '1';
  }

  preloadAssets().finally(() => {
    detenerBucle();
    resetPartida();
    estadoJuego = 'PLAYING';
    animId = requestAnimationFrame(gameLoop);
  });
}

function pausarJuego() {
  detenerBucle();
}

function reanudarJuego() {
  if (estadoJuego === 'GAMEOVER') return;
  if (!animId) {
    lastFrame = 0;
    animId = requestAnimationFrame(gameLoop);
  }
}

window.UACup = {
  iniciarJuego,
  pausarJuego,
  reanudarJuego,
  resetPartida,
  preloadAssets,
  get estado() { return estadoJuego; },
  get racha() { return racha; },
  get duracionTotal() { return duracionTotal; },
  get tiempoInicio() { return tiempoInicio; }
};

document.addEventListener('DOMContentLoaded', () => {
  preloadAssets();
  if (document.getElementById('gameCanvas') && document.body.dataset.autoStart === 'true') {
    iniciarJuego();
  }
});
