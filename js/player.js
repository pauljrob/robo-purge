import { isKeyDown, getMousePos, isShooting } from './input.js';
import { normalize, clamp, angleToTarget, randomRange, distanceSq } from './utils.js';
import { drawCircle, drawLine, getCtx, screenToWorld } from './renderer.js';
import { getWeapon } from './weapons.js';
import { getEnemies } from './enemies.js';
import { spawnProjectile } from './projectiles.js';
import { spawnExplosion } from './particles.js';

export const player = {
    x: 400,
    y: 300,
    radius: 16,
    hp: 100,
    maxHp: 100,
    speed: 200,
    weapon: 'pistol',
    angle: 0,
    fireCooldown: 0,
    invincibleTimer: 0,
    skin: 'default',
    damageReduction: 0,
    speedMultiplier: 1,
    lifesteal: 0,
    explosiveKills: false,
    doubleDamage: false,
    invincible: false,
    aimbot: false,
};

export function resetPlayer(arenaW, arenaH) {
    player.x = arenaW / 2;
    player.y = arenaH / 2;
    player.hp = 100;
    player.maxHp = 100;
    player.speed = 200;
    player.weapon = 'pistol';
    player.fireCooldown = 0;
    player.invincibleTimer = 0;
    player.skin = 'default';
    player.damageReduction = 0;
    player.speedMultiplier = 1;
    player.lifesteal = 0;
    player.explosiveKills = false;
    player.doubleDamage = false;
    player.invincible = false;
    player.aimbot = false;
}

export function updatePlayer(dt, arenaW, arenaH) {
    // Movement (WASD)
    let mx = 0, my = 0;
    if (isKeyDown('w')) my -= 1;
    if (isKeyDown('s')) my += 1;
    if (isKeyDown('a')) mx -= 1;
    if (isKeyDown('d')) mx += 1;

    const dir = normalize(mx, my);
    const spd = player.speed * player.speedMultiplier;
    player.x += dir.x * spd * dt;
    player.y += dir.y * spd * dt;

    // Clamp to arena
    player.x = clamp(player.x, player.radius, arenaW - player.radius);
    player.y = clamp(player.y, player.radius, arenaH - player.radius);

    // Aiming — arrow keys set angle and auto-shoot, mouse also works
    let arrowAiming = false;
    let ax = 0, ay = 0;
    if (isKeyDown('arrowup')) { ay -= 1; arrowAiming = true; }
    if (isKeyDown('arrowdown')) { ay += 1; arrowAiming = true; }
    if (isKeyDown('arrowleft')) { ax -= 1; arrowAiming = true; }
    if (isKeyDown('arrowright')) { ax += 1; arrowAiming = true; }

    if (player.aimbot) {
        // Auto-aim at nearest enemy
        const enemies = getEnemies();
        let nearest = null;
        let nearestDist = Infinity;
        for (const e of enemies) {
            if (!e.active) continue;
            const d = distanceSq(player.x, player.y, e.x, e.y);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = e;
            }
        }
        if (nearest) {
            player.angle = angleToTarget(player.x, player.y, nearest.x, nearest.y);
        }
    } else if (arrowAiming) {
        player.angle = Math.atan2(ay, ax);
    } else {
        const mouse = getMousePos();
        const worldMouse = screenToWorld(mouse.x, mouse.y);
        player.angle = angleToTarget(player.x, player.y, worldMouse.x, worldMouse.y);
    }

    // Invincibility
    if (player.invincibleTimer > 0) {
        player.invincibleTimer -= dt;
    }

    // Shooting
    player.fireCooldown -= dt;
    if ((isShooting() || arrowAiming) && player.fireCooldown <= 0) {
        const weapon = getWeapon(player.weapon);
        if (weapon) {
            player.fireCooldown = 1 / weapon.fireRate;
            const dmg = player.doubleDamage ? weapon.damage * 2 : weapon.damage;

            for (let i = 0; i < weapon.bullets; i++) {
                const spreadRad = (weapon.spread * Math.PI / 180);
                const offset = weapon.bullets > 1
                    ? -spreadRad / 2 + (spreadRad / (weapon.bullets - 1)) * i
                    : 0;
                const finalAngle = player.angle + offset + randomRange(-0.02, 0.02);

                spawnProjectile(
                    player.x + Math.cos(player.angle) * 20,
                    player.y + Math.sin(player.angle) * 20,
                    Math.cos(finalAngle) * weapon.bulletSpeed,
                    Math.sin(finalAngle) * weapon.bulletSpeed,
                    dmg,
                    'player',
                    weapon.color,
                    weapon.bulletSize,
                    weapon.piercing,
                    weapon.explosive,
                    weapon.explosionRadius || 0
                );
            }

            // Muzzle flash
            spawnExplosion(
                player.x + Math.cos(player.angle) * 22,
                player.y + Math.sin(player.angle) * 22,
                weapon.color, 3, 50, 2, 0.15
            );
        }
    }
}

export function renderPlayer(ctx) {
    const gctx = getCtx();
    const blinking = player.invincibleTimer > 0 && Math.floor(player.invincibleTimer * 10) % 2 === 0;

    if (blinking && !player.invincible) return;

    let bodyColor = '#4af';
    let glowColor = null;

    switch (player.skin) {
        case 'ghost':
            gctx.globalAlpha = 0.5;
            bodyColor = '#aaf';
            break;
        case 'neon':
            bodyColor = '#0f0';
            glowColor = '#0f0';
            break;
        case 'chrome':
            bodyColor = '#ccc';
            glowColor = '#fff';
            break;
    }

    if (glowColor) {
        gctx.shadowBlur = 15;
        gctx.shadowColor = glowColor;
    }

    // Body
    drawCircle(player.x, player.y, player.radius, bodyColor);

    // Gun barrel
    const barrelLen = 24;
    drawLine(
        player.x, player.y,
        player.x + Math.cos(player.angle) * barrelLen,
        player.y + Math.sin(player.angle) * barrelLen,
        '#fff', 3
    );

    // Eye
    drawCircle(
        player.x + Math.cos(player.angle) * 6,
        player.y + Math.sin(player.angle) * 6,
        3, '#fff'
    );

    gctx.shadowBlur = 0;
    gctx.globalAlpha = 1;

    // Invincibility shield
    if (player.invincible) {
        gctx.globalAlpha = 0.3;
        drawCircle(player.x, player.y, player.radius + 8, '#ff0', false);
        gctx.globalAlpha = 1;
    }
}

export function damagePlayer(amount) {
    if (player.invincible) return;
    if (player.invincibleTimer > 0) return;

    const actualDmg = amount * (1 - player.damageReduction);
    player.hp -= actualDmg;
    player.invincibleTimer = 0.5;

    if (player.hp < 0) player.hp = 0;
}
