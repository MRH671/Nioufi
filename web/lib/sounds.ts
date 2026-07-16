// ─── Sons du jeu (synthèse WebAudio, aucun asset) ────────────────────────────
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

/** Bruit blanc filtré — la base des sons de cartes */
function noiseBurst(duration: number, freq: number, gain: number, delay = 0) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
}

function tone(freq: number, duration: number, gain: number, delay = 0, type: OscillatorType = "sine") {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

/** Carte distribuée : swoosh bref */
export function sfxDeal() {
  noiseBurst(0.12, 2600, 0.25);
}

/** Carte retournée : snap sec en deux temps */
export function sfxFlip() {
  noiseBurst(0.05, 3200, 0.3);
  noiseBurst(0.07, 1800, 0.22, 0.045);
}

/** Jetons misés : clinks */
export function sfxChip() {
  tone(2100, 0.06, 0.12, 0, "square");
  tone(2600, 0.05, 0.1, 0.05, "square");
  noiseBurst(0.04, 4200, 0.08, 0.02);
}

/** Victoire : petit arpège doré */
export function sfxWin() {
  tone(523, 0.15, 0.14, 0);
  tone(659, 0.15, 0.14, 0.1);
  tone(784, 0.25, 0.16, 0.2);
}

/** Défaite : deux notes descendantes discrètes */
export function sfxLose() {
  tone(330, 0.18, 0.1, 0);
  tone(247, 0.28, 0.1, 0.15);
}

/** Nioufi (9) : fanfare */
export function sfxNioufi() {
  tone(659, 0.12, 0.15, 0);
  tone(784, 0.12, 0.15, 0.1);
  tone(988, 0.12, 0.16, 0.2);
  tone(1319, 0.35, 0.18, 0.3);
}
