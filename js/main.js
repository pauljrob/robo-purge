import { initInput, isKeyDown, isAimAssist, toggleAimAssist } from './input.js';
import { initRenderer, clear, setCamera, beginCamera, endCamera, updateShake, triggerShake, drawText, drawRect, drawCircle, drawLine, getCtx, screenToWorld } from './renderer.js';
import { player, resetPlayer, updatePlayer, renderPlayer, damagePlayer, getTankDefs, buyOrb, buyDrone, applyTankStats } from './player.js';
import { updateProjectiles, renderProjectiles, getProjectiles, clearProjectiles } from './projectiles.js';
import { updateEnemies, renderEnemies, getEnemies, clearEnemies } from './enemies.js';
import { updateParticles, renderParticles, clearParticles } from './particles.js';
import { spawnExplosion } from './particles.js';
import { circleVsCircle } from './collision.js';
import { startWave, updateWaveSpawning, isWaveComplete, getCurrentWave, stopWave } from './waves.js';
import { validateCode, isUnlocked, applyUnlock, isSlowMoActive, resetUnlocks, getAllCodes } from './codes.js';
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

// Codes list UI
const codesListOverlay = document.getElementById('codes-list-overlay');
const codesListContent = document.getElementById('codes-list-content');
let codesListOpen = false;

// Powers menu UI
const powersOverlay = document.getElementById('powers-overlay');
const powersList = document.getElementById('powers-list');

// Game state
let state = 'MENU';
let score = 0;
let waveNum = 0;
let stateTimer = 0;
let lastTime = 0;
let lastShootWeapon = null;

// Tank selection
const tankIds = Object.keys(getTankDefs());
let selectedTankIndex = 0;

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

// Click handler for tank selection and buying orbs/drones
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (state === 'TANK_SELECT') {
        for (const pos of tankSelectPositions) {
            const dx = mx - pos.x;
            const dy = my - pos.y;
            if (dx * dx + dy * dy < pos.r * pos.r) {
                selectedTankIndex = pos.index;
                break;
            }
        }
    }

    if (state === 'PLAYING') {
        // Click near player to buy orb/drone
        const world = screenToWorld(mx, my);
        const dx = world.x - player.x;
        const dy = world.y - player.y;
        const clickDist = dx * dx + dy * dy;
        const buyRadius = 60;

        if (clickDist < buyRadius * buyRadius) {
            if (player.tank === 'orbit') {
                const result = buyOrb(score);
                if (result.success) { score -= result.cost; playUnlock(); }
            } else if (player.tank === 'default') {
                const result = buyDrone(score);
                if (result.success) { score -= result.cost; playUnlock(); }
            }
        }
    }
});

function startGame() {
    const chosenTank = player.tank;
    state = 'PLAYING';
    score = 0;
    waveNum = 1;
    resetPlayer(ARENA_W, ARENA_H);
    player.tank = chosenTank;
    applyTankStats();
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

function openCodesList() {
    codesListOpen = true;
    state = 'CODES_LIST';
    codesListContent.innerHTML = '';
    const allCodes = getAllCodes();
    for (const [code, unlock] of allCodes) {
        const unlocked = isUnlocked(unlock.id);
        const div = document.createElement('div');
        div.className = 'code-entry' + (unlocked ? ' unlocked' : '');
        div.innerHTML = `<span class="code-name">${code}</span><span class="code-desc">${unlock.name}</span>`;
        codesListContent.appendChild(div);
    }
    codesListOverlay.classList.remove('hidden');
}

function closeCodesList() {
    codesListOpen = false;
    codesListOverlay.classList.add('hidden');
    state = 'PLAYING';
}

function getActivePowers() {
    const powers = [];
    powers.push({ key: 'softAimbot', name: 'Aim Assist (Q)', active: isAimAssist() });
    if (isUnlocked('aimbot')) powers.push({ key: 'aimbot', name: 'Aimbot (Homing)', active: player.aimbot });
    if (isUnlocked('invincible')) powers.push({ key: 'invincible', name: 'God Mode', active: player.invincible });
    if (isUnlocked('doubleDmg')) powers.push({ key: 'doubleDamage', name: 'Double Damage', active: player.doubleDamage });
    if (isUnlocked('slowmo')) powers.push({ key: 'slowmo', name: 'Slow Motion', active: true }); // always on if unlocked
    if (isUnlocked('armor')) powers.push({ key: 'damageReduction', name: 'Armor (50%)', active: player.damageReduction > 0 });
    if (isUnlocked('speed')) powers.push({ key: 'speedMultiplier', name: 'Speed Boost', active: player.speedMultiplier > 1 });
    if (isUnlocked('lifesteal')) powers.push({ key: 'lifesteal', name: 'Vampiric', active: player.lifesteal > 0 });
    if (isUnlocked('explosive')) powers.push({ key: 'explosiveKills', name: 'Explosive Kills', active: player.explosiveKills });
    return powers;
}

function togglePower(key) {
    switch (key) {
        case 'softAimbot': player.softAimbot = !player.softAimbot; break;
        case 'aimbot': player.aimbot = !player.aimbot; break;
        case 'invincible': player.invincible = !player.invincible; break;
        case 'doubleDamage': player.doubleDamage = !player.doubleDamage; break;
        case 'damageReduction': player.damageReduction = player.damageReduction > 0 ? 0 : 0.5; break;
        case 'speedMultiplier': player.speedMultiplier = player.speedMultiplier > 1 ? 1 : 1.5; break;
        case 'lifesteal': player.lifesteal = player.lifesteal > 0 ? 0 : 0.05; break;
        case 'explosiveKills': player.explosiveKills = !player.explosiveKills; break;
    }
    renderPowersList();
}

function renderPowersList() {
    powersList.innerHTML = '';
    const powers = getActivePowers();
    if (powers.length === 0) {
        powersList.innerHTML = '<p style="color:#555">No powers active. Use codes to unlock powers!</p>';
        return;
    }
    for (const p of powers) {
        const div = document.createElement('div');
        div.className = 'power-item';
        div.innerHTML = `<span class="power-name">${p.name}</span><span class="power-status ${p.active ? 'on' : 'off'}">${p.active ? 'ON' : 'OFF'}</span>`;
        div.addEventListener('click', () => togglePower(p.key));
        powersList.appendChild(div);
    }
}

function openPowersMenu() {
    state = 'POWERS_MENU';
    renderPowersList();
    powersOverlay.classList.remove('hidden');
}

function closePowersMenu() {
    powersOverlay.classList.add('hidden');
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
            if (unlock.id === 'skip') {
                // SKIP - clear wave and jump ahead
                const skipCount = unlock.skipCount || 1;
                const enemies = getEnemies();
                for (const enemy of enemies) {
                    if (!enemy.active) continue;
                    enemy.active = false;
                    spawnExplosion(enemy.x, enemy.y, '#0ff', 10, 150, 3, 0.4);
                }
                stopWave();
                waveNum += skipCount;
                startWave(waveNum, ARENA_W, ARENA_H);
            } else {
                // BAN - kill all enemies for points
                const enemies = getEnemies();
                for (const enemy of enemies) {
                    if (!enemy.active) continue;
                    score += enemy.points;
                    spawnExplosion(enemy.x, enemy.y, '#f00', 15, 200, 4, 0.6);
                    playEnemyDeath();
                    enemy.active = false;
                }
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
    if (state === 'MENU') {
        if (wasKeyPressed('enter')) {
            state = 'TANK_SELECT';
        }
        return;
    }

    if (state === 'GAME_OVER') {
        if (wasKeyPressed('enter')) {
            state = 'TANK_SELECT';
        }
        return;
    }

    if (state === 'TANK_SELECT') {
        if (wasKeyPressed('arrowleft') || wasKeyPressed('a')) {
            selectedTankIndex = (selectedTankIndex - 1 + tankIds.length) % tankIds.length;
        }
        if (wasKeyPressed('arrowright') || wasKeyPressed('d')) {
            selectedTankIndex = (selectedTankIndex + 1) % tankIds.length;
        }
        if (wasKeyPressed('enter')) {
            player.tank = tankIds[selectedTankIndex];
            startGame();
        }
        return;
    }

    if (state === 'CODES_LIST') {
        if (wasKeyPressed('k') || wasKeyPressed('escape')) {
            closeCodesList();
        }
        return;
    }

    if (state === 'POWERS_MENU') {
        if (wasKeyPressed('p') || wasKeyPressed('escape')) {
            closePowersMenu();
        }
        return;
    }

    if (state !== 'PLAYING') return;

    // Mute toggle
    if (wasKeyPressed('m')) toggleMute();

    // Q - toggle aim assist or auto-drive for Clasher
    if (wasKeyPressed('q')) {
        if (player.tank === 'clasher') {
            player.autoDrive = !player.autoDrive;
        } else {
            toggleAimAssist();
        }
    }

    // P - open powers menu
    if (wasKeyPressed('p')) {
        openPowersMenu();
        return;
    }

    // Open code entry with C
    if (wasKeyPressed('c')) {
        openCodeEntry();
        return;
    }

    // Shift+K - enable all codes
    if (isKeyDown('shift') && wasKeyPressed('k')) {
        const allCodes = getAllCodes();
        for (const [code, unlock] of allCodes) {
            if (unlock.type !== 'instant' && !isUnlocked(unlock.id)) {
                applyUnlock(unlock);
            }
        }
        playUnlock();
        triggerShake(10);
        return;
    }

    // Open codes list with K
    if (wasKeyPressed('k')) {
        openCodesList();
        return;
    }

    // Weapon switching
    for (let i = 0; i < 7; i++) {
        if (wasKeyPressed(`${i + 1}`)) {
            const order = getWeaponOrder();
            const wep = WEAPONS[order[i]];
            if (wep && !wep.locked) {
                player.weapon = order[i];
            }
        }
    }

    // Buy orb (Orbit Master) or drone (Drone tank)
    if (wasKeyPressed('b')) {
        if (player.tank === 'orbit') {
            const result = buyOrb(score);
            if (result.success) { score -= result.cost; playUnlock(); }
        } else if (player.tank === 'default') {
            const result = buyDrone(score);
            if (result.success) { score -= result.cost; playUnlock(); }
        }
    }

    const enemySpeedMult = isSlowMoActive() ? 0.5 : 1;

    updatePlayer(dt, ARENA_W, ARENA_H);
    updateProjectiles(dt, ARENA_W, ARENA_H, getEnemies());
    updateEnemies(dt, player.x, player.y, enemySpeedMult, ARENA_W, ARENA_H);
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

    // Collision: enemies vs player (contact damage / Clasher ramming)
    for (const e of enemies) {
        if (!e.active) continue;
        if (circleVsCircle(e.x, e.y, e.radius, player.x, player.y, player.radius)) {
            if (player.tank === 'clasher') {
                // Clasher rams enemies - deals massive damage to them
                e.hp -= player.clasherDamage;
                e.flashTimer = 0.1;
                triggerShake(5);
                playEnemyHit();
                spawnExplosion(e.x, e.y, '#f60', 8, 120, 3, 0.3);

                // Small self-damage (10% of normal)
                if (player.clasherInvincibleTimer <= 0) {
                    damagePlayer(2);
                    player.clasherInvincibleTimer = 0.15;
                }

                // Push enemy back hard
                const dx = e.x - player.x;
                const dy = e.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                e.x += (dx / dist) * 50;
                e.y += (dy / dist) * 50;

                if (e.hp <= 0) {
                    e.active = false;
                    score += e.points;
                    playEnemyDeath();
                    spawnExplosion(e.x, e.y, '#f60', 15, 180, 4, 0.5);

                    if (player.lifesteal > 0) {
                        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * player.lifesteal);
                    }
                    if (player.explosiveKills) {
                        for (const e2 of enemies) {
                            if (!e2.active) continue;
                            if (circleVsCircle(e.x, e.y, 50, e2.x, e2.y, e2.radius)) {
                                e2.hp -= 15;
                                e2.flashTimer = 0.08;
                            }
                        }
                    }
                }
            } else {
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
        player.hp = player.maxHp;
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

    if (state === 'TANK_SELECT') {
        renderTankSelect();
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

// Store tank positions for click detection
const tankSelectPositions = [];

function drawTankPreview(gctx, id, t, x, y, r) {
    switch (id) {
        case 'default': // Scout - circle with buddy drone orbit ring
            drawCircle(x, y, r, t.body);
            drawCircle(x, y, r * 0.5, '#fff');
            drawCircle(x, y, r * 0.3, t.accent);
            // Orbit ring
            gctx.setLineDash([4, 4]);
            drawCircle(x, y, r + 10, '#4af', false);
            gctx.setLineDash([]);
            // Mini buddy
            const buddyAngle = Date.now() / 800;
            const bx = x + Math.cos(buddyAngle) * (r + 10);
            const by = y + Math.sin(buddyAngle) * (r + 10);
            drawCircle(bx, by, 4, '#4af');
            drawCircle(bx, by, 2, '#fff');
            break;

        case 'heavy': // Shooter - rectangular with multiple barrels
            gctx.fillStyle = t.body;
            gctx.fillRect(x - r, y - r * 0.7, r * 2, r * 1.4);
            gctx.fillStyle = t.accent;
            gctx.fillRect(x - r * 0.7, y - r * 0.5, r * 1.4, r);
            // Triple barrel
            gctx.fillStyle = t.barrel;
            gctx.fillRect(x - 5, y - r - 14, 3, 16);
            gctx.fillRect(x - 1, y - r - 16, 3, 18);
            gctx.fillRect(x + 3, y - r - 14, 3, 16);
            // Speed lines
            gctx.strokeStyle = '#8f8';
            gctx.lineWidth = 1;
            for (let s = 0; s < 3; s++) {
                const sy = y + r * 0.8 + s * 4;
                gctx.beginPath();
                gctx.moveTo(x - 8, sy);
                gctx.lineTo(x + 8, sy);
                gctx.stroke();
            }
            break;

        case 'flame': // Charger - round with glowing core
            drawCircle(x, y, r, t.body);
            drawCircle(x, y, r * 0.7, t.accent);
            // Glowing charge core
            const chargePulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
            gctx.globalAlpha *= chargePulse;
            drawCircle(x, y, r * 0.4, '#ff0');
            gctx.globalAlpha = gctx.globalAlpha / chargePulse;
            // Wide cannon barrel
            gctx.fillStyle = t.barrel;
            gctx.fillRect(x - 4, y - r - 14, 8, 16);
            // Charge indicator marks
            gctx.strokeStyle = '#ff0';
            gctx.lineWidth = 2;
            for (let c = 0; c < 3; c++) {
                const ca = -Math.PI / 2 + (c - 1) * 0.4;
                gctx.beginPath();
                gctx.arc(x, y, r + 5, ca - 0.1, ca + 0.1);
                gctx.stroke();
            }
            break;

        case 'stealth': // Stealth - diamond with camo pattern
            gctx.beginPath();
            gctx.moveTo(x, y - r * 1.1);
            gctx.lineTo(x + r * 0.8, y);
            gctx.lineTo(x, y + r * 1.1);
            gctx.lineTo(x - r * 0.8, y);
            gctx.closePath();
            gctx.fillStyle = t.body;
            gctx.fill();
            // Inner diamond
            gctx.beginPath();
            gctx.moveTo(x, y - r * 0.5);
            gctx.lineTo(x + r * 0.35, y);
            gctx.lineTo(x, y + r * 0.5);
            gctx.lineTo(x - r * 0.35, y);
            gctx.closePath();
            gctx.fillStyle = t.accent;
            gctx.fill();
            // Thin barrel
            gctx.fillStyle = t.barrel;
            gctx.fillRect(x - 1.5, y - r * 1.1 - 10, 3, 12);
            break;

        case 'gold': // Tank - big circle with thick armor rings
            drawCircle(x, y, r, t.body);
            // Armor rings
            gctx.lineWidth = 3;
            drawCircle(x, y, r + 3, '#fa0', false);
            gctx.lineWidth = 2;
            drawCircle(x, y, r - 4, t.accent, false);
            drawCircle(x, y, r * 0.4, '#fff');
            // Huge cannon
            gctx.fillStyle = t.barrel;
            gctx.fillRect(x - 4, y - r - 18, 8, 20);
            gctx.fillRect(x - 6, y - r - 18, 12, 4);
            break;

        case 'ice': // Phaser - hexagon with phase effect
            gctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const ha = (Math.PI * 2 / 6) * j - Math.PI / 2;
                const hx = x + Math.cos(ha) * r;
                const hy = y + Math.sin(ha) * r;
                if (j === 0) gctx.moveTo(hx, hy);
                else gctx.lineTo(hx, hy);
            }
            gctx.closePath();
            gctx.fillStyle = t.body;
            gctx.fill();
            gctx.strokeStyle = '#fff';
            gctx.lineWidth = 1;
            gctx.stroke();
            // Phase ghost effect
            const phaseOffset = Math.sin(Date.now() / 400) * 4;
            gctx.globalAlpha *= 0.3;
            gctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const ha = (Math.PI * 2 / 6) * j - Math.PI / 2;
                const hx = x + phaseOffset + Math.cos(ha) * r;
                const hy = y + Math.sin(ha) * r;
                if (j === 0) gctx.moveTo(hx, hy);
                else gctx.lineTo(hx, hy);
            }
            gctx.closePath();
            gctx.fillStyle = '#aef';
            gctx.fill();
            gctx.globalAlpha = gctx.globalAlpha / 0.3;
            // Barrel
            gctx.fillStyle = t.barrel;
            gctx.fillRect(x - 2, y - r - 12, 4, 14);
            break;

        case 'orbit': // Orbit Master - circle with spinning orbs
            drawCircle(x, y, r * 0.8, t.body);
            drawCircle(x, y, r * 0.4, t.accent);
            // Orbit ring
            gctx.setLineDash([3, 3]);
            drawCircle(x, y, r + 6, '#e4f', false);
            gctx.setLineDash([]);
            // Spinning orbs
            const orbCount = 3;
            const orbTime = Date.now() / 600;
            for (let o = 0; o < orbCount; o++) {
                const oa = orbTime + (Math.PI * 2 / orbCount) * o;
                const ox2 = x + Math.cos(oa) * (r + 6);
                const oy2 = y + Math.sin(oa) * (r + 6);
                gctx.shadowBlur = 8;
                gctx.shadowColor = '#e4f';
                drawCircle(ox2, oy2, 5, '#e4f');
                drawCircle(ox2, oy2, 3, '#fff');
                gctx.shadowBlur = 0;
            }
            // Barrel
            gctx.fillStyle = t.barrel;
            gctx.fillRect(x - 2, y - r * 0.8 - 12, 4, 14);
            break;

        case 'clasher': // Clasher - spiked ram ball
            // Spikes
            for (let s = 0; s < 8; s++) {
                const sa = (Math.PI * 2 / 8) * s + Date.now() / 1000;
                const sx = x + Math.cos(sa) * (r + 4);
                const sy = y + Math.sin(sa) * (r + 4);
                gctx.beginPath();
                gctx.moveTo(sx, sy);
                gctx.lineTo(x + Math.cos(sa - 0.25) * r, y + Math.sin(sa - 0.25) * r);
                gctx.lineTo(x + Math.cos(sa + 0.25) * r, y + Math.sin(sa + 0.25) * r);
                gctx.closePath();
                gctx.fillStyle = '#f60';
                gctx.fill();
            }
            drawCircle(x, y, r, t.body);
            gctx.lineWidth = 3;
            drawCircle(x, y, r, t.accent, false);
            drawCircle(x, y, r * 0.5, t.accent);
            // Ram point
            gctx.beginPath();
            gctx.moveTo(x, y - r - 8);
            gctx.lineTo(x - 6, y - r + 2);
            gctx.lineTo(x + 6, y - r + 2);
            gctx.closePath();
            gctx.fillStyle = '#ff0';
            gctx.fill();
            break;
    }
}

function renderTankSelect() {
    const gctx = getCtx();
    const tanks = getTankDefs();
    const ids = tankIds;

    gctx.shadowBlur = 15;
    gctx.shadowColor = '#0f0';
    drawText('CHOOSE YOUR TANK', 400, 70, '#0f0', 32, 'center');
    gctx.shadowBlur = 0;

    drawText('Click a tank or use A/D to select', 400, 100, '#555', 12, 'center');

    const cols = 4;
    const rows = Math.ceil(ids.length / cols);
    const spacingX = 160;
    const spacingY = 160;
    const startY = rows === 1 ? 270 : 200;

    tankSelectPositions.length = 0;

    for (let i = 0; i < ids.length; i++) {
        const t = tanks[ids[i]];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rowCount = row < rows - 1 ? cols : ids.length - row * cols;
        const rowStartX = 400 - ((rowCount - 1) * spacingX) / 2;
        const x = rowStartX + col * spacingX;
        const y = startY + row * spacingY;
        const selected = i === selectedTankIndex;
        const r = 24;

        tankSelectPositions.push({ x, y, r: r + 15, index: i });

        // Background plate
        const plateSize = 60;
        if (selected) {
            gctx.fillStyle = 'rgba(0, 255, 0, 0.08)';
            gctx.fillRect(x - plateSize, y - plateSize, plateSize * 2, plateSize * 2);
            gctx.strokeStyle = '#0f0';
            gctx.lineWidth = 2;
            gctx.strokeRect(x - plateSize, y - plateSize, plateSize * 2, plateSize * 2);
        } else {
            gctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            gctx.fillRect(x - plateSize, y - plateSize, plateSize * 2, plateSize * 2);
            gctx.strokeStyle = '#333';
            gctx.lineWidth = 1;
            gctx.strokeRect(x - plateSize, y - plateSize, plateSize * 2, plateSize * 2);
        }

        gctx.globalAlpha = selected ? 1 : 0.5;

        // Draw unique tank
        drawTankPreview(gctx, ids[i], t, x, y, r);

        gctx.globalAlpha = 1;

        // Name below
        drawText(t.name, x, y + 65, selected ? '#fff' : '#666', 13, 'center');

        // Big bouncing arrow above selected
        if (selected) {
            const bounce = Math.sin(Date.now() / 200) * 6;

            // Arrow shaft
            gctx.fillStyle = '#0f0';
            gctx.fillRect(x - 3, y - 80 + bounce, 6, 16);

            // Arrow head
            gctx.beginPath();
            gctx.moveTo(x, y - 55 + bounce);
            gctx.lineTo(x - 14, y - 72 + bounce);
            gctx.lineTo(x + 14, y - 72 + bounce);
            gctx.closePath();
            gctx.fill();

            // Glow
            gctx.shadowBlur = 10;
            gctx.shadowColor = '#0f0';
            gctx.beginPath();
            gctx.moveTo(x, y - 55 + bounce);
            gctx.lineTo(x - 14, y - 72 + bounce);
            gctx.lineTo(x + 14, y - 72 + bounce);
            gctx.closePath();
            gctx.fill();
            gctx.shadowBlur = 0;
        }
    }

    // Selected tank description
    const selectedTank = tanks[ids[selectedTankIndex]];
    const descY = startY + rows * spacingY - 30;
    gctx.shadowBlur = 8;
    gctx.shadowColor = '#0f0';
    drawText(selectedTank.desc, 400, descY, '#0f0', 14, 'center');
    gctx.shadowBlur = 0;

    // Controls
    drawText('< A/LEFT', 30, startY + 40, '#555', 12, 'left');
    drawText('D/RIGHT >', 770, startY + 40, '#555', 12, 'right');

    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    gctx.globalAlpha = pulse;
    drawText('PRESS ENTER TO START', 400, descY + 40, '#0f0', 20, 'center');
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
