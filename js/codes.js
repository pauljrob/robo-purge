import { WEAPONS } from './weapons.js';
import { player } from './player.js';

const unlocked = new Set();

const CODE_REGISTRY = new Map([
    ['BOOMSTICK',   { type: 'weapon',   id: 'shotgun',    name: 'Shotgun' }],
    ['BULLETSTORM', { type: 'weapon',   id: 'machinegun', name: 'Machine Gun' }],
    ['LONGSHOT',    { type: 'weapon',   id: 'railgun',    name: 'Railgun' }],
    ['PLASMA',      { type: 'weapon',   id: 'plasma',     name: 'Plasma Cannon' }],
    ['PEWPEW',      { type: 'weapon',   id: 'laser',      name: 'Laser' }],
    ['IRONCLAD',    { type: 'ability',  id: 'armor',      name: 'Damage Reduction 50%' }],
    ['SPEEDFREAK',  { type: 'ability',  id: 'speed',      name: 'Movement Speed +50%' }],
    ['VAMPIRIC',    { type: 'ability',  id: 'lifesteal',  name: 'Heal 5% on Kill' }],
    ['BIGBOOM',     { type: 'ability',  id: 'explosive',  name: 'Enemies Explode on Death' }],
    ['GHOST',       { type: 'skin',     id: 'ghost',      name: 'Ghost Skin' }],
    ['NEON',        { type: 'skin',     id: 'neon',       name: 'Neon Glow Skin' }],
    ['CHROME',      { type: 'skin',     id: 'chrome',     name: 'Chrome Skin' }],
    ['GODMODE',     { type: 'modifier', id: 'invincible', name: 'Invincibility' }],
    ['DOUBLETAP',   { type: 'modifier', id: 'doubleDmg',  name: 'Double Damage' }],
    ['MATRIX',      { type: 'modifier', id: 'slowmo',     name: 'Slow Motion Enemies' }],
    ['AIMBOT',      { type: 'modifier', id: 'aimbot',     name: 'Auto-Aim Aimbot' }],
    ['BAN',         { type: 'instant',  id: 'ban',       name: 'BAN HAMMER - Kill All Bots!' }],
    ['BOSS_MODE',   { type: 'weapon',   id: 'bossmode',  name: 'BOSS MODE - One Shot Kill' }],
    ['HEAVY',       { type: 'tank',     id: 'heavy',     name: 'Heavy Tank' }],
    ['INFERNO',     { type: 'tank',     id: 'flame',     name: 'Inferno Tank' }],
    ['STEALTH',     { type: 'tank',     id: 'stealth',   name: 'Stealth Tank' }],
    ['GOLDTANK',    { type: 'tank',     id: 'gold',      name: 'Gold Tank' }],
    ['FROST',       { type: 'tank',     id: 'ice',       name: 'Frost Tank' }],
    ['SKIP',        { type: 'instant',  id: 'skip',      name: 'Skip Wave!' }],
    ['ORB',         { type: 'instant',  id: 'orb',       name: '20 Orbs!' }],
]);

export function validateCode(input) {
    const code = input.trim().toUpperCase();

    // Support "SKIP 5", "SKIP 10", etc.
    const skipMatch = code.match(/^SKIP\s+(\d+)$/);
    if (skipMatch) {
        const num = parseInt(skipMatch[1], 10);
        return { type: 'instant', id: 'skip', name: `Skip ${num} Waves!`, skipCount: num };
    }

    return CODE_REGISTRY.get(code) || null;
}

export function isUnlocked(id) {
    return unlocked.has(id);
}

export function applyUnlock(unlock) {
    unlocked.add(unlock.id);

    switch (unlock.type) {
        case 'weapon':
            if (WEAPONS[unlock.id]) {
                WEAPONS[unlock.id].locked = false;
            }
            break;
        case 'ability':
            switch (unlock.id) {
                case 'armor': player.damageReduction = 0.5; break;
                case 'speed': player.speedMultiplier = 1.5; break;
                case 'lifesteal': player.lifesteal = 0.05; break;
                case 'explosive': player.explosiveKills = true; break;
            }
            break;
        case 'skin':
            player.skin = unlock.id;
            break;
        case 'modifier':
            switch (unlock.id) {
                case 'invincible': player.invincible = true; break;
                case 'doubleDmg': player.doubleDamage = true; break;
                case 'slowmo': break; // handled in main game loop
                case 'aimbot': player.aimbot = true; break;
            }
            break;
        case 'tank':
            player.tank = unlock.id;
            break;
    }
}

export function isSlowMoActive() {
    return unlocked.has('slowmo');
}

export function getUnlocked() {
    return unlocked;
}

export function resetUnlocks() {
    unlocked.clear();
    // Re-lock all weapons except pistol
    for (const [id, w] of Object.entries(WEAPONS)) {
        w.locked = id !== 'pistol';
    }
}

export function getAllCodes() {
    return CODE_REGISTRY;
}
