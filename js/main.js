import { initInput, isKeyDown } from './input.js';
import { initRenderer, clear, setCamera, beginCamera, endCamera, updateShake, triggerShake, drawText, drawRect, drawCircle, drawLine, getCtx } from './renderer.js';
import { player, resetPlayer, updatePlayer, renderPlayer, damagePlayer } from './player.js';
import { updateProjectiles, renderProjectiles, getProjectiles, clearProjectiles } from './projectiles.js';
import { updateEnemies, renderEnemies, getEnemies, clearEnemies } from './enemies.js';
import { updateParticles, renderParticles, clearParticles } from './particles.js';
import { spawnExplosion } from './particles.js';
import { circleVsCircle } from './collision.js';
import { startWave, updateWaveSpawning, isWaveComplete, getCurrentWave, stopWave } from './waves.js';
import { validateCode, isUnlocked, applyUnlock, isSlowMoActive, resetUnlocks } from './codes.js';
import { getWeaponOrder, WEAPONS } from './weapons.js';
import { renderHUD } from './hud.js';
import { playShoot, playEnemyHit, playEnemyDeath, playPlayerHit, playUnlock, playWaveComplete, toggleMute } from './audio.js';

// Arena
const ARENA_W = 1600;
const ARENA_H = 1200;

// Canvas
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Code entry UI
const codeOverlay = document.getElementById('code-overlay');
const codeInput = document.getElementById('code-input');
const codeFeedback = document.getElementById('code-feedback');

// Game state
let state = 'MENU';
let score = 0;
let waveNum = 0;
let stateTimer = 0;
let lastTime = 0;
let lastShootWeapon = null;

// Key tracking for single-press
const prevKeys = {};

function wasKeyPressed(key) {
    const down = isKeyDown(key);
    const prev = prevKeys[key] || false;
    prevKeys[key] = down;
    return down && !prev;
}

// Init
initRenderer(ctx, canvas.width, canvas.height);
initInput(canvas);

function startGame() {
    state = 'PLAYING';
    score = 0;
    waveNum = 1;
    resetPlayer(ARENA_W, ARENA_H);
    resetUnlocks();
    clearProjectiles();
    clearEnemies();
    clearParticles();
    startWave(waveNum, ARENA_W, ARENA_H);
}

function openCodeEntry() {
    state = 'CODE_ENTRY';
    codeOverlay.classList.remove('hidden');
    codeInput.value = '';
    codeFeedback.textContent = '';
    codeFeedback.className = '';
    setTimeout(() => codeInput.focus(), 50);
}

function closeCodeEntry() {
    codeOverlay.classList.add('hidden');
    state = 'PLAYING';
}

// Code input handlers
codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.preventDefault();
        closeCodeEntry();
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = codeInput.value.trim();
        if (!val) {
            closeCodeEntry();
            return;
        }
        const unlock = validateCode(val);
        if (!unlock) {
            codeFeedback.textContent = 'INVALID CODE';
            codeFeedback.className = 'error';
            codeInput.value = '';
        } else if (unlock.type === 'instant') {
            // BAN - kill all enemies
            const enemies = getEnemies();
            for (const enemy of enemies) {
                if (!enemy.active) continue;
                score += enemy.points;
                spawnExplosion(enemy.x, enemy.y, '#f00', 15, 200, 4, 0.6);
                playEnemyDeath();
                enemy.active = false;
            }
            codeFeedback.textContent = `${unlock.name}`;
            codeFeedback.className = 'success';
            playUnlock();
            triggerShake(15);
            setTimeout(closeCodeEntry, 1200);
        } else if (isUnlocked(unlock.id)) {
            codeFeedback.textContent = 'ALREADY UNLOCKED';
            codeFeedback.className = 'already';
            codeInput.value = '';
        } else {
            applyUnlock(unlock);
            codeFeedback.textContent = `UNLOCKED: ${unlock.name}!`;
            codeFeedback.className = 'success';
            playUnlock();
            setTimeout(closeCodeEntry, 1200);
        }
    }
    e.stopPropagation();
});

// Prevent game input while typing codes
codeInput.addEventListener('keyup', (e) => e.stopPropagation());

function update(dt) {
    if (state === 'MENU' || state === 'GAME_OVER') {
        if (wasKeyPressed('enter')) {
            startGame();
        }
        return;
    }

    if (state !== 'PLAYING') return;

    // Mute toggle
    if (wasKeyPressed('m')) toggleMute();

    // Open code entry with C
    if (wasKeyPressed('c')) {
        openCodeEntry();
        return;
    }

    // Weapon switching
    for (let i = 0; i < 6; i++) {
        if (wasKeyPressed(`${i + 1}`)) {
            const order = getWeaponOrder();
            const wep = WEAPONS[order[i]];
            if (wep && !wep.locked) {
                player.weapon = order[i];
            }
        }
    }

    const enemySpeedMult = isSlowMoActive() ? 0.5 : 1;

    updatePlayer(dt, ARENA_W, ARENA_H);
    updateProjectiles(dt, ARENA_W, ARENA_H);
    updateEnemies(dt, player.x, player.y, enemySpeedMult);
    updateWaveSpawning(dt, ARENA_W, ARENA_H, player.x, player.y);
    updateParticles(dt);
    updateShake();

    // Play shoot sounds
    if (player.fireCooldown > 0 && player.fireCooldown < 0.05 && lastShootWeapon !== player.weapon + player.fireCooldown) {
        playShoot(player.weapon);
        lastShootWeapon = player.weapon + player.fireCooldown;
    }

    // Collision: player projectiles vs enemies
    const projectiles = getProjectiles();
    const enemies = getEnemies();

    for (const p of projectiles) {
        if (!p.active || p.owner !== 'player') continue;
        for (const e of enemies) {
            if (!e.active) continue;
            if (circleVsCircle(p.x, p.y, p.size, e.x, e.y, e.radius)) {
                e.hp -= p.damage;
                e.flashTimer = 0.08;
                playEnemyHit();
                spawnExplosion(p.x, p.y, e.color, 4, 80, 2, 0.2);

                if (!p.piercing) {
                    p.active = false;
                }

                if (p.explosive) {
                    // AoE explosion
                    spawnExplosion(p.x, p.y, '#f80', 15, 150, 4, 0.4);
                    for (const e2 of enemies) {
                        if (!e2.active || e2 === e) continue;
                        if (circleVsCircle(p.x, p.y, p.explosionRadius, e2.x, e2.y, e2.radius)) {
                            e2.hp -= p.damage * 0.5;
                            e2.flashTimer = 0.08;
                        }
                    }
                    p.active = false;
                }

                if (e.hp <= 0) {
                    e.active = false;
                    score += e.points;
                    playEnemyDeath();
                    spawnExplosion(e.x, e.y, e.color, 12, 150, 3, 0.5);

                    // Lifesteal
                    if (player.lifesteal > 0) {
                        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * player.lifesteal);
                    }

                    // Explosive kills
                    if (player.explosiveKills) {
                        spawnExplosion(e.x, e.y, '#f80', 10, 120, 3, 0.4);
                        for (const e3 of enemies) {
                            if (!e3.active) continue;
                            if (circleVsCircle(e.x, e.y, 50, e3.x, e3.y, e3.radius)) {
                                e3.hp -= 15;
                                e3.flashTimer = 0.08;
                            }
                        }
                    }
                }
                break;
            }
        }
    }

    // Collision: enemy projectiles vs player
    for (const p of projectiles) {
        if (!p.active || p.owner !== 'enemy') continue;
        if (circleVsCircle(p.x, p.y, p.size, player.x, player.y, player.radius)) {
            damagePlayer(p.damage);
            p.active = false;
            triggerShake(6);
            playPlayerHit();
            spawnExplosion(player.x, player.y, '#f44', 5, 80, 2, 0.2);
        }
    }

    // Collision: enemies vs player (contact damage)
    for (const e of enemies) {
        if (!e.active) continue;
        if (circleVsCircle(e.x, e.y, e.radius, player.x, player.y, player.radius)) {
            damagePlayer(15);
            triggerShake(8);
            playPlayerHit();
            // Push enemy back
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            e.x += (dx / dist) * 30;
            e.y += (dy / dist) * 30;
        }
    }

    // Check death
    if (player.hp <= 0) {
        state = 'GAME_OVER';
        stateTimer = 0;
        spawnExplosion(player.x, player.y, '#4af', 30, 200, 4, 1);
    }

    // Check wave complete
    if (isWaveComplete()) {
        stopWave();
        playWaveComplete();
        state = 'WAVE_COMPLETE';
        stateTimer = 0;
    }
}

function render() {
    clear();

    if (state === 'MENU') {
        renderMenu();
        return;
    }

    if (state === 'GAME_OVER') {
        setCamera(player.x, player.y);
        beginCamera();
        renderArena();
        renderParticles(ctx);
        endCamera();
        renderGameOver();
        return;
    }

    // Game world
    setCamera(player.x, player.y);
    beginCamera();

    renderArena();
    renderParticles(ctx);
    renderEnemies(ctx);
    renderPlayer(ctx);
    renderProjectiles(ctx);

    endCamera();

    // HUD
    renderHUD(ctx, score);

    if (state === 'WAVE_COMPLETE') {
        stateTimer += 1 / 60;
        drawText('WAVE COMPLETE!', 400, 280, '#0f0', 28, 'center');
        drawText(`Score: ${score}`, 400, 320, '#ff0', 18, 'center');
        if (stateTimer > 1.5) {
            state = 'PLAYING';
            waveNum++;
            startWave(waveNum, ARENA_W, ARENA_H);
        }
    }
}

function renderArena() {
    const gctx = getCtx();

    // Grid
    gctx.strokeStyle = '#1a1a1a';
    gctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x <= ARENA_W; x += gridSize) {
        gctx.beginPath();
        gctx.moveTo(x, 0);
        gctx.lineTo(x, ARENA_H);
        gctx.stroke();
    }
    for (let y = 0; y <= ARENA_H; y += gridSize) {
        gctx.beginPath();
        gctx.moveTo(0, y);
        gctx.lineTo(ARENA_W, y);
        gctx.stroke();
    }

    // Border
    gctx.strokeStyle = '#0f0';
    gctx.lineWidth = 2;
    gctx.strokeRect(0, 0, ARENA_W, ARENA_H);
}

function renderMenu() {
    const gctx = getCtx();

    // Title
    gctx.shadowBlur = 20;
    gctx.shadowColor = '#0f0';
    drawText('ROBO PURGE', 400, 180, '#0f0', 48, 'center');
    gctx.shadowBlur = 0;

    drawText('DESTROY THE ROBOTS', 400, 230, '#0a0', 16, 'center');
    drawText('DISCOVER SECRET CODES', 400, 255, '#0a0', 16, 'center');

    // Controls
    drawText('CONTROLS:', 400, 310, '#888', 14, 'center');
    drawText('WASD - Move    |    Arrows/Mouse - Aim & Shoot', 400, 335, '#666', 12, 'center');
    drawText('1-6 - Switch Weapons    |    C - Enter Code', 400, 355, '#666', 12, 'center');
    drawText('M - Mute', 400, 375, '#666', 12, 'center');

    // Robot preview
    drawCircle(320, 430, 12, '#888'); // drone
    drawText('Drone', 320, 460, '#888', 10, 'center');

    drawCircle(370, 430, 14, '#f44'); // shooter
    drawText('Shooter', 370, 460, '#f44', 10, 'center');

    drawCircle(425, 430, 13, '#ff0'); // charger
    drawText('Charger', 425, 460, '#ff0', 10, 'center');

    drawCircle(480, 430, 20, '#4a4'); // tank
    drawText('Tank', 480, 460, '#4a4', 10, 'center');

    gctx.globalAlpha = 0.7;
    drawCircle(530, 430, 11, '#a4f'); // phaser
    gctx.globalAlpha = 1;
    drawText('Phaser', 530, 460, '#a4f', 10, 'center');

    // Start prompt
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    gctx.globalAlpha = pulse;
    drawText('PRESS ENTER TO START', 400, 530, '#0f0', 20, 'center');
    gctx.globalAlpha = 1;
}

function renderGameOver() {
    const gctx = getCtx();

    gctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    gctx.fillRect(0, 0, 800, 600);

    gctx.shadowBlur = 20;
    gctx.shadowColor = '#f00';
    drawText('GAME OVER', 400, 220, '#f44', 44, 'center');
    gctx.shadowBlur = 0;

    drawText(`Final Score: ${score}`, 400, 280, '#ff0', 22, 'center');
    drawText(`Waves Survived: ${getCurrentWave()}`, 400, 315, '#888', 16, 'center');

    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    gctx.globalAlpha = pulse;
    drawText('PRESS ENTER TO RETRY', 400, 400, '#0f0', 18, 'center');
    gctx.globalAlpha = 1;
}

// Game loop
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 1 / 30);
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

// Handle visibility
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        lastTime = performance.now();
    }
});

// Start
lastTime = performance.now();
requestAnimationFrame(gameLoop);
