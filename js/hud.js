import { drawRect, drawText, getCtx } from './renderer.js';
import { player } from './player.js';
import { getWeapon, getWeaponOrder, WEAPONS } from './weapons.js';
import { getCurrentWave, getEnemiesRemaining, isBossLevel } from './waves.js';
import { getUnlocked } from './codes.js';
import { isAutoShoot } from './input.js';
import { isMuted } from './audio.js';

export function renderHUD(ctx, score) {
    const gctx = getCtx();

    // Health bar
    const hpBarW = 200;
    const hpBarH = 16;
    const hpX = 15;
    const hpY = 15;

    drawRect(hpX, hpY, hpBarW, hpBarH, '#300');
    const hpFrac = Math.max(0, player.hp / player.maxHp);
    const hpColor = hpFrac > 0.5 ? '#0f0' : hpFrac > 0.25 ? '#ff0' : '#f00';
    drawRect(hpX, hpY, hpBarW * hpFrac, hpBarH, hpColor);
    drawRect(hpX, hpY, hpBarW, hpBarH, '#555', false);
    drawText(`HP: ${Math.ceil(player.hp)}`, hpX + 5, hpY + 13, '#fff', 12);

    // Wave info
    if (isBossLevel()) {
        const gctx2 = getCtx();
        gctx2.shadowBlur = 15;
        gctx2.shadowColor = '#f00';
        drawText(`BOSS WAVE ${getCurrentWave()}`, 400, 25, '#f00', 20, 'center');
        gctx2.shadowBlur = 0;
    } else {
        drawText(`WAVE ${getCurrentWave()}`, 400, 25, '#0f0', 20, 'center');
    }
    drawText(`Enemies: ${getEnemiesRemaining()}`, 400, 45, '#888', 12, 'center');

    // Score
    drawText(`SCORE: ${score}`, 785, 25, '#ff0', 16, 'right');

    // Active weapon
    const weapon = getWeapon(player.weapon);
    if (weapon) {
        drawText(`[${weapon.name}]`, 15, 580, weapon.color, 14);
    }

    // Weapon slots
    const order = getWeaponOrder();
    let slotX = 15;
    const slotY = 555;
    for (let i = 0; i < order.length; i++) {
        const w = WEAPONS[order[i]];
        const isActive = player.weapon === order[i];
        const isLocked = w.locked;

        if (isLocked) {
            gctx.globalAlpha = 0.3;
            drawRect(slotX, slotY, 22, 16, '#333');
            drawText(`${i + 1}`, slotX + 4, slotY + 13, '#555', 11);
            gctx.globalAlpha = 1;
        } else {
            drawRect(slotX, slotY, 22, 16, isActive ? w.color : '#333');
            drawText(`${i + 1}`, slotX + 4, slotY + 13, isActive ? '#000' : '#aaa', 11);
        }
        slotX += 26;
    }

    // Unlocked abilities/modifiers
    const unlocked = getUnlocked();
    const abilityIcons = [];
    if (unlocked.has('armor')) abilityIcons.push({ letter: 'A', color: '#4af' });
    if (unlocked.has('speed')) abilityIcons.push({ letter: 'S', color: '#fa4' });
    if (unlocked.has('lifesteal')) abilityIcons.push({ letter: 'V', color: '#f4a' });
    if (unlocked.has('explosive')) abilityIcons.push({ letter: 'E', color: '#f80' });
    if (unlocked.has('invincible')) abilityIcons.push({ letter: 'G', color: '#ff0' });
    if (unlocked.has('doubleDmg')) abilityIcons.push({ letter: 'D', color: '#f44' });
    if (unlocked.has('slowmo')) abilityIcons.push({ letter: 'M', color: '#a4f' });
    if (unlocked.has('aimbot')) abilityIcons.push({ letter: '@', color: '#f00' });

    let iconX = 785;
    for (const icon of abilityIcons) {
        drawRect(iconX - 18, slotY, 18, 16, '#222');
        drawText(icon.letter, iconX - 15, slotY + 13, icon.color, 11);
        iconX -= 22;
    }

    // Aim assist indicator
    if (player.softAimbot) {
        drawText('AIM ASSIST', 785, 550, '#4af', 10, 'right');
    }

    // Code entry hint
    drawText('[C] CODE  [P] POWERS  [Q] AIM ASSIST', 400, 590, '#0a0', 11, 'center');

    // Auto shoot indicator
    if (isAutoShoot()) {
        drawText('AUTO-FIRE ON', 785, 565, '#f80', 10, 'right');
    }

    // Mute indicator
    if (isMuted()) {
        drawText('MUTED', 785, 580, '#555', 10, 'right');
    }
}
