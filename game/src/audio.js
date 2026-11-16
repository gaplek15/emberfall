// Every sound in EMBERFALL is synthesised live with WebAudio: no audio files,
// no network. Short blips and noise bursts for effects, and a quiet looping
// bass-and-pad line for music, scheduled a little ahead of time. Everything
// is a no-op until the first user gesture unlocks the context, and until
// then the game simply plays silent.
const MUSIC_BPM = 96;
const BEAT = 60 / MUSIC_BPM;
// A minor walk the bass follows, one note a beat, two bars long.
const BASS_LINE = [55, 0, 55, 65.41, 49, 0, 58.27, 65.41, 55, 0, 55, 82.41, 73.42, 65.41, 58.27, 49];
// Pad roots, one chord a bar.
const PAD_ROOTS = [110, 87.31, 98, 82.41];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let nextNoteTime = 0;
  let stepIndex = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function scheduleMusic() {
    if (!ctx || muted) return;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const bass = BASS_LINE[stepIndex % BASS_LINE.length];
      if (bass > 0) {
        const t0 = nextNoteTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = bass;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.5, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + BEAT * 0.9);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(t0);
        osc.stop(t0 + BEAT);
      }
      if (stepIndex % 16 === 0) {
        const root = PAD_ROOTS[Math.floor(stepIndex / 16) % PAD_ROOTS.length];
        for (const ratio of [1, 1.189, 1.498]) {
          const t0 = nextNoteTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = root * ratio;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.12, t0 + 0.6);
          gain.gain.linearRampToValueAtTime(0.001, t0 + BEAT * 16);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(t0);
          osc.stop(t0 + BEAT * 16);
        }
      }
      nextNoteTime += BEAT;
      stepIndex += 1;
    }
  }

  return {
    get muted() {
      return muted;
    },
    // Call from a real gesture (click / key) so the browser lets sound start.
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      nextNoteTime = ctx.currentTime + 0.1;
      stepIndex = 0;
      musicTimer = window.setInterval(scheduleMusic, 90);
    },
    stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    shoot() { tone(920, 0.07, 'square', 0.10, 340); },
    hit() { noise(0.05, 0.10, 3200); },
    die(big) {
      noise(big ? 0.5 : 0.28, big ? 0.35 : 0.2, big ? 900 : 1600);
      tone(big ? 160 : 220, big ? 0.5 : 0.25, 'sawtooth', 0.16, 40);
    },
    pickup(combo) {
      const base = 520 * Math.pow(1.059, Math.min(combo, 12));
      tone(base, 0.09, 'sine', 0.16, base * 1.5);
    },
    heart() { tone(523, 0.12, 'sine', 0.18); tone(659, 0.12, 'sine', 0.18, null, 0.09); tone(784, 0.2, 'sine', 0.18, null, 0.18); },
    hurt() { tone(140, 0.3, 'sawtooth', 0.25, 55); noise(0.2, 0.2, 700); },
    dash() { noise(0.18, 0.14, 2400); },
    waveClear() { tone(523, 0.14, 'sine', 0.16); tone(659, 0.14, 'sine', 0.16, null, 0.11); tone(784, 0.3, 'sine', 0.18, null, 0.22); },
    roar() { tone(70, 0.9, 'sawtooth', 0.3, 38); noise(0.8, 0.2, 400); },
    upgrade() { tone(392, 0.1, 'triangle', 0.18); tone(523, 0.1, 'triangle', 0.18, null, 0.08); tone(659, 0.22, 'triangle', 0.18, null, 0.16); },
    click() { tone(660, 0.05, 'sine', 0.12); },
    victory() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.18, null, i * 0.14)); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.16, null, i * 0.18)); },
  };
}
