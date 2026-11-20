let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTone(
  type: 'correct' | 'wrong' | 'tap' | 'complete',
  enabled: boolean
) {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  const playNote = (freq: number, start: number, duration: number, vol = 0.12) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  };

  if (type === 'tap') {
    playNote(520, now, 0.08, 0.08);
  } else if (type === 'correct') {
    playNote(587.33, now, 0.12, 0.11); // D5
    playNote(880, now + 0.08, 0.18, 0.11); // A5
  } else if (type === 'wrong') {
    playNote(240, now, 0.22, 0.1);
  } else if (type === 'complete') {
    playNote(523.25, now, 0.14, 0.12); // C5
    playNote(659.25, now + 0.12, 0.14, 0.12); // E5
    playNote(783.99, now + 0.24, 0.28, 0.14); // G5
  }
}
