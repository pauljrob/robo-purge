import { spawnEnemy, getActiveEnemyCount } from './enemies.js';
import { randomRange, randomInt } from './utils.js';

let currentWave = 0;
let enemiesRemaining = 0;
let enemiesToSpawn = [];
let spawnTimer = 0;
let spawnInterval = 2;
let waveActive = false;

export function startWave(waveNum, arenaW, arenaH) {
    currentWave = waveNum;
    waveActive = true;
    spawnTimer = 0;
    spawnInterval = Math.max(0.8, 2 - waveNum * 0.05);

    const hpMult = 1 + waveNum * 0.05;

    // Build spawn list
    enemiesToSpawn = [];

    const drones = Math.max(0, 3 + waveNum * 2);
    const shooters = Math.max(0, (waveNum - 2) * 2);
    const chargers = Math.max(0, (waveNum - 4));
    const tanks = Math.max(0, Math.floor((waveNum - 6) / 2));
    const phasers = Math.max(0, Math.floor((waveNum - 8) / 2));

    for (let i = 0; i < drones; i++) enemiesToSpawn.push({ type: 'drone', hpMult });
    for (let i = 0; i < shooters; i++) enemiesToSpawn.push({ type: 'shooter', hpMult });
    for (let i = 0; i < chargers; i++) enemiesToSpawn.push({ type: 'charger', hpMult });
    for (let i = 0; i < tanks; i++) enemiesToSpawn.push({ type: 'tank', hpMult });
    for (let i = 0; i < phasers; i++) enemiesToSpawn.push({ type: 'phaser', hpMult });

    // Shuffle
    for (let i = enemiesToSpawn.length - 1; i > 0; i--) {
        const j = randomInt(0, i);
        [enemiesToSpawn[i], enemiesToSpawn[j]] = [enemiesToSpawn[j], enemiesToSpawn[i]];
    }

    enemiesRemaining = enemiesToSpawn.length;
}

export function updateWaveSpawning(dt, arenaW, arenaH, playerX, playerY) {
    if (!waveActive || enemiesToSpawn.length === 0) return;

    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;

        const batchSize = Math.min(randomInt(2, 4), enemiesToSpawn.length);
        for (let i = 0; i < batchSize; i++) {
            const entry = enemiesToSpawn.pop();
            if (!entry) break;

            // Spawn at arena edges, away from player
            let x, y;
            const side = randomInt(0, 3);
            switch (side) {
                case 0: x = randomRange(0, arenaW); y = -20; break;
                case 1: x = randomRange(0, arenaW); y = arenaH + 20; break;
                case 2: x = -20; y = randomRange(0, arenaH); break;
                case 3: x = arenaW + 20; y = randomRange(0, arenaH); break;
            }

            spawnEnemy(entry.type, x, y, entry.hpMult);
        }
    }
}

export function isWaveComplete() {
    return waveActive && enemiesToSpawn.length === 0 && getActiveEnemyCount() === 0;
}

export function getCurrentWave() {
    return currentWave;
}

export function getEnemiesRemaining() {
    return enemiesToSpawn.length + getActiveEnemyCount();
}

export function stopWave() {
    waveActive = false;
}
