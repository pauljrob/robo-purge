let audioCtx = null;
let muted = false;

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playTone(freq, duration, type = 'square', volume = 0.15) {
    if (muted) return;
    try {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        // Audio not available
    }
}

function playNoise(duration, volume = 0.1) {
    if (muted) return;
    try {
        const ctx = getCtx();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(ctx.currentTime);
    } catch (e) {
        // Audio not available
    }
}

export function playShoot(weaponId) {
    const freqs = {
        pistol: 800,
        machinegun: 600,
        shotgun: 200,
        railgun: 1200,
        plasma: 300,
        laser: 1500,
    };
    playTone(freqs[weaponId] || 800, 0.05, 'square', 0.1);
}

export function playEnemyHit() {
    playNoise(0.03, 0.08);
}

export function playEnemyDeath() {
    playTone(400, 0.05, 'square', 0.1);
    setTimeout(() => playTone(200, 0.08, 'square', 0.08), 50);
}

export function playPlayerHit() {
    playTone(100, 0.08, 'sawtooth', 0.15);
}

export function playUnlock() {
    playTone(523, 0.1, 'square', 0.12);
    setTimeout(() => playTone(659, 0.1, 'square', 0.12), 100);
    setTimeout(() => playTone(784, 0.15, 'square', 0.12), 200);
}

export function playWaveComplete() {
    playTone(440, 0.1, 'square', 0.1);
    setTimeout(() => playTone(660, 0.15, 'square', 0.1), 120);
}

export function toggleMute() {
    muted = !muted;
    return muted;
}

export function isMuted() {
    return muted;
}
