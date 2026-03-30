import { isKeyDown, getMousePos, isShooting, isAimAssist } from './input.js';
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
    softAimbot: false, // built-in aim assist, no homing
    tank: 'default',
    // Buddy drone
    buddyAngle: 0,
    buddyBombTimer: 0,
    // Charger charge
    charging: false,
    chargeTime: 0,
    maxChargeTime: 2,
    // Orbit Master
    orbs: 1,
    orbAngle: 0,
    orbAttackTimer: 0,
    nextOrbCost: 500,
    orbsBought: 0,
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
    player.softAimbot = false;
    player.tank = 'default';
    player.buddyAngle = 0;
    player.buddyBombTimer = 0;
    player.charging = false;
    player.chargeTime = 0;
    player.maxChargeTime = 2;
    player.orbs = 1;
    player.orbAngle = 0;
    player.orbAttackTimer = 0;
    player.nextOrbCost = 500;
    player.orbsBought = 0;
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

    const playerAimbot = isAimAssist() || (player.aimbot && player.tank !== 'default');
    if (playerAimbot) {
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

    // Tank-specific: buddy drone (Scout/default)
    if (player.tank === 'default') {
        player.buddyAngle += dt * 2.5;
        player.buddyBombTimer -= dt;
        if (player.buddyBombTimer <= 0) {
            player.buddyBombTimer = 1.2;
            const buddyX = player.x + Math.cos(player.buddyAngle) * 40;
            const buddyY = player.y + Math.sin(player.buddyAngle) * 40;
            // Find nearest enemy to bomb
            const enemies = getEnemies();
            let nearest = null;
            let nearestDist = Infinity;
            for (const en of enemies) {
                if (!en.active) continue;
                const d = distanceSq(buddyX, buddyY, en.x, en.y);
                if (d < nearestDist) { nearestDist = d; nearest = en; }
            }
            if (nearest) {
                const bombAngle = angleToTarget(buddyX, buddyY, nearest.x, nearest.y);
                spawnProjectile(buddyX, buddyY,
                    Math.cos(bombAngle) * 300, Math.sin(bombAngle) * 300,
                    20, 'player', '#4af', 4, false, true, 50, true
                );
                spawnExplosion(buddyX, buddyY, '#4af', 4, 50, 2, 0.15);
            }
        }
    }

    // Tank-specific: Orbit Master
    if (player.tank === 'orbit') {
        player.orbAngle += dt * 2;
        player.orbAttackTimer -= dt;

        // Each orb attacks independently
        if (player.orbAttackTimer <= 0) {
            player.orbAttackTimer = 0.8;
            const enemies = getEnemies();
            for (let i = 0; i < player.orbs; i++) {
                const orbA = player.orbAngle + (Math.PI * 2 / player.orbs) * i;
                const orbDist = 45;
                const ox = player.x + Math.cos(orbA) * orbDist;
                const oy = player.y + Math.sin(orbA) * orbDist;

                // Find nearest enemy to this orb
                let nearest = null;
                let nearestDist = Infinity;
                for (const en of enemies) {
                    if (!en.active) continue;
                    const d = distanceSq(ox, oy, en.x, en.y);
                    if (d < nearestDist) { nearestDist = d; nearest = en; }
                }
                if (nearest) {
                    const shotAngle = angleToTarget(ox, oy, nearest.x, nearest.y);
                    spawnProjectile(ox, oy,
                        Math.cos(shotAngle) * 400, Math.sin(shotAngle) * 400,
                        15, 'player', '#e4f', 3, false, false, 0, true
                    );
                    spawnExplosion(ox, oy, '#e4f', 3, 40, 2, 0.1);
                }
            }
        }
    }

    // Tank-specific modifiers
    let fireRateMult = 1;
    let damageMult = 1;
    if (player.tank === 'heavy') {
        fireRateMult = 3;    // 3x fire rate
        damageMult = 0.3;    // 30% damage
    } else if (player.tank === 'gold') {
        fireRateMult = 0.3;  // slow fire rate
        damageMult = 4;      // 4x damage
    }

    // Tank-specific: Charger charge-up (Inferno)
    const wantShoot = isShooting() || arrowAiming || playerAimbot;
    if (player.tank === 'flame') {
        if (wantShoot) {
            player.charging = true;
            player.chargeTime = Math.min(player.chargeTime + dt, player.maxChargeTime);
        } else if (player.charging && player.chargeTime > 0) {
            // Release charged shot
            player.charging = false;
            const weapon = getWeapon(player.weapon);
            if (weapon) {
                const chargeFrac = player.chargeTime / player.maxChargeTime;
                const dmg = (player.doubleDamage ? weapon.damage * 2 : weapon.damage) * (1 + chargeFrac * 10);
                const size = weapon.bulletSize + chargeFrac * 8;
                spawnProjectile(
                    player.x + Math.cos(player.angle) * 20,
                    player.y + Math.sin(player.angle) * 20,
                    Math.cos(player.angle) * weapon.bulletSpeed * (0.8 + chargeFrac),
                    Math.sin(player.angle) * weapon.bulletSpeed * (0.8 + chargeFrac),
                    dmg, 'player', '#f44', size,
                    chargeFrac > 0.8, chargeFrac > 0.5, 80,
                    player.aimbot
                );
                spawnExplosion(
                    player.x + Math.cos(player.angle) * 22,
                    player.y + Math.sin(player.angle) * 22,
                    '#f80', 5 + Math.floor(chargeFrac * 10), 100, 3, 0.3
                );
            }
            player.chargeTime = 0;
        }
    } else {
        // Normal shooting for all other tanks
        player.fireCooldown -= dt;
        if (wantShoot && player.fireCooldown <= 0) {
            const weapon = getWeapon(player.weapon);
            if (weapon) {
                player.fireCooldown = 1 / (weapon.fireRate * fireRateMult);
                const dmg = (player.doubleDamage ? weapon.damage * 2 : weapon.damage) * damageMult;

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
                        weapon.explosionRadius || 0,
                        player.aimbot
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
}

const TANKS = {
    default: { body: '#4af', barrel: '#fff', accent: '#28f', name: 'Scout', desc: 'Buddy drone bombs enemies' },
    heavy:   { body: '#4a4', barrel: '#8f8', accent: '#282', name: 'Shooter', desc: 'Fast fire, weak damage' },
    flame:   { body: '#f80', barrel: '#f44', accent: '#a40', name: 'Charger', desc: 'Hold to charge, massive hit' },
    stealth: { body: '#444', barrel: '#888', accent: '#222', name: 'Stealth', desc: 'Standard balanced tank' },
    gold:    { body: '#fd0', barrel: '#fff', accent: '#a80', name: 'Tank', desc: 'Slow fire, huge damage' },
    ice:     { body: '#8ef', barrel: '#fff', accent: '#4af', name: 'Phaser', desc: '50% phase through attacks' },
    orbit:   { body: '#e4f', barrel: '#fff', accent: '#a0c', name: 'Orbit Master', desc: 'Orbs orbit you. Buy more with score (max 4)' },
};

export function getTankDefs() {
    return TANKS;
}

export function renderPlayer(ctx) {
    const gctx = getCtx();
    const blinking = player.invincibleTimer > 0 && Math.floor(player.invincibleTimer * 10) % 2 === 0;

    if (blinking && !player.invincible) return;

    const tankDef = TANKS[player.tank] || TANKS.default;
    let bodyColor = tankDef.body;
    let barrelColor = tankDef.barrel;
    let accentColor = tankDef.accent;
    let glowColor = null;

    // Skins override colors
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

    const r = player.radius;
    const a = player.angle;

    switch (player.tank) {
        case 'heavy':
            // Chunky square-ish tank
            gctx.save();
            gctx.translate(player.x, player.y);
            gctx.rotate(a);
            gctx.fillStyle = bodyColor;
            gctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
            gctx.fillStyle = accentColor;
            gctx.fillRect(-r * 0.6, -r * 0.5, r * 1.2, r);
            // Double barrel
            gctx.fillStyle = barrelColor;
            gctx.fillRect(r * 0.5, -4, r * 1.2, 3);
            gctx.fillRect(r * 0.5, 1, r * 1.2, 3);
            gctx.restore();
            break;

        case 'flame':
            // Round with wide barrel
            drawCircle(player.x, player.y, r, bodyColor);
            drawCircle(player.x, player.y, r * 0.6, accentColor);
            gctx.save();
            gctx.translate(player.x, player.y);
            gctx.rotate(a);
            gctx.fillStyle = barrelColor;
            gctx.fillRect(r * 0.3, -5, r * 1.4, 10);
            gctx.restore();
            break;

        case 'stealth':
            // Diamond shape
            gctx.save();
            gctx.translate(player.x, player.y);
            gctx.rotate(a);
            gctx.beginPath();
            gctx.moveTo(r * 1.2, 0);
            gctx.lineTo(0, -r * 0.8);
            gctx.lineTo(-r, 0);
            gctx.lineTo(0, r * 0.8);
            gctx.closePath();
            gctx.fillStyle = bodyColor;
            gctx.fill();
            gctx.fillStyle = barrelColor;
            gctx.fillRect(r * 0.5, -1.5, r, 3);
            gctx.restore();
            break;

        case 'gold':
            // Fancy circle with ring
            drawCircle(player.x, player.y, r, bodyColor);
            drawCircle(player.x, player.y, r + 2, '#fa0', false);
            drawCircle(player.x, player.y, r * 0.5, accentColor);
            drawLine(
                player.x, player.y,
                player.x + Math.cos(a) * (r + 10),
                player.y + Math.sin(a) * (r + 10),
                barrelColor, 4
            );
            break;

        case 'ice':
            // Hexagon-ish
            gctx.save();
            gctx.translate(player.x, player.y);
            gctx.rotate(a);
            gctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const ha = (Math.PI * 2 / 6) * i;
                const hx = Math.cos(ha) * r;
                const hy = Math.sin(ha) * r;
                if (i === 0) gctx.moveTo(hx, hy);
                else gctx.lineTo(hx, hy);
            }
            gctx.closePath();
            gctx.fillStyle = bodyColor;
            gctx.fill();
            gctx.strokeStyle = '#fff';
            gctx.lineWidth = 1;
            gctx.stroke();
            gctx.fillStyle = barrelColor;
            gctx.fillRect(r * 0.4, -2, r * 1.2, 4);
            gctx.restore();
            break;

        case 'orbit':
            // Orbit Master body
            drawCircle(player.x, player.y, r, '#e4f');
            drawCircle(player.x, player.y, r * 0.5, '#a0c');
            drawLine(
                player.x, player.y,
                player.x + Math.cos(a) * (r + 8),
                player.y + Math.sin(a) * (r + 8),
                barrelColor, 3
            );
            break;

        default:
            // Default circle tank
            drawCircle(player.x, player.y, r, bodyColor);
            drawLine(
                player.x, player.y,
                player.x + Math.cos(a) * (r + 8),
                player.y + Math.sin(a) * (r + 8),
                barrelColor, 3
            );
            drawCircle(
                player.x + Math.cos(a) * 6,
                player.y + Math.sin(a) * 6,
                3, '#fff'
            );
            break;
    }

    // Direction arrow on top
    const arrowDist = r + 14;
    const arrowTipX = player.x + Math.cos(a) * arrowDist;
    const arrowTipY = player.y + Math.sin(a) * arrowDist;
    const arrowL1X = player.x + Math.cos(a + 2.7) * (r + 6);
    const arrowL1Y = player.y + Math.sin(a + 2.7) * (r + 6);
    const arrowL2X = player.x + Math.cos(a - 2.7) * (r + 6);
    const arrowL2Y = player.y + Math.sin(a - 2.7) * (r + 6);
    gctx.beginPath();
    gctx.moveTo(arrowTipX, arrowTipY);
    gctx.lineTo(arrowL1X, arrowL1Y);
    gctx.lineTo(arrowL2X, arrowL2Y);
    gctx.closePath();
    gctx.fillStyle = tankDef.barrel;
    gctx.globalAlpha = 0.6;
    gctx.fill();
    gctx.globalAlpha = 1;

    gctx.shadowBlur = 0;
    gctx.globalAlpha = 1;

    // Invincibility shield
    if (player.invincible) {
        gctx.globalAlpha = 0.3;
        drawCircle(player.x, player.y, player.radius + 8, '#ff0', false);
        gctx.globalAlpha = 1;
    }

    // Buddy drone (Scout)
    if (player.tank === 'default') {
        const bx = player.x + Math.cos(player.buddyAngle) * 40;
        const by = player.y + Math.sin(player.buddyAngle) * 40;
        drawCircle(bx, by, 6, '#4af');
        drawCircle(bx, by, 3, '#fff');
        // Little propeller
        const propAngle = Date.now() / 50;
        drawLine(
            bx + Math.cos(propAngle) * 5, by + Math.sin(propAngle) * 5,
            bx - Math.cos(propAngle) * 5, by - Math.sin(propAngle) * 5,
            '#8cf', 1
        );
    }

    // Charge bar (Charger/Inferno)
    if (player.tank === 'flame' && player.charging && player.chargeTime > 0) {
        const chargeFrac = player.chargeTime / player.maxChargeTime;
        const barW = 40;
        const barH = 5;
        const barX = player.x - barW / 2;
        const barY = player.y + player.radius + 12;
        gctx.fillStyle = '#333';
        gctx.fillRect(barX, barY, barW, barH);
        const chargeColor = chargeFrac > 0.8 ? '#f00' : chargeFrac > 0.5 ? '#f80' : '#ff0';
        gctx.fillStyle = chargeColor;
        gctx.fillRect(barX, barY, barW * chargeFrac, barH);
        gctx.strokeStyle = '#fff';
        gctx.lineWidth = 1;
        gctx.strokeRect(barX, barY, barW, barH);
    }

    // Phaser aura (Ice)
    if (player.tank === 'ice') {
        const phaseAlpha = 0.15 + Math.sin(Date.now() / 300) * 0.1;
        gctx.globalAlpha = phaseAlpha;
        drawCircle(player.x, player.y, player.radius + 12, '#8ef');
        gctx.globalAlpha = 1;
    }

    // Orbit Master orbs
    if (player.tank === 'orbit') {
        const orbDist = 45;
        for (let i = 0; i < player.orbs; i++) {
            const orbA = player.orbAngle + (Math.PI * 2 / player.orbs) * i;
            const ox = player.x + Math.cos(orbA) * orbDist;
            const oy = player.y + Math.sin(orbA) * orbDist;

            // Orb glow
            gctx.shadowBlur = 12;
            gctx.shadowColor = '#e4f';
            drawCircle(ox, oy, 7, '#e4f');
            drawCircle(ox, oy, 4, '#fff');
            gctx.shadowBlur = 0;

            // Orbit trail
            gctx.globalAlpha = 0.15;
            drawCircle(player.x, player.y, orbDist, '#e4f', false);
            gctx.globalAlpha = 1;
        }

        // Show next orb cost if under max
        if (player.orbs < 4) {
            drawText(`Next orb: ${player.nextOrbCost} pts`, player.x, player.y + player.radius + 25, '#e4f', 9, 'center');
        } else {
            drawText('MAX ORBS', player.x, player.y + player.radius + 25, '#ff0', 9, 'center');
        }
    }
}

export function buyOrb(score) {
    if (player.tank !== 'orbit') return { success: false, cost: 0 };
    if (player.orbs >= 4) return { success: false, cost: 0 };
    if (score < player.nextOrbCost) return { success: false, cost: 0 };

    const cost = player.nextOrbCost;
    player.orbs++;
    player.orbsBought++;
    player.nextOrbCost = Math.floor(500 * Math.pow(3, player.orbsBought));
    return { success: true, cost };
}

export function damagePlayer(amount) {
    if (player.invincible) return;
    if (player.invincibleTimer > 0) return;

    // Phaser tank: 50% chance to phase through
    if (player.tank === 'ice' && Math.random() < 0.5) {
        spawnExplosion(player.x, player.y, '#8ef', 6, 60, 2, 0.2);
        return;
    }

    const actualDmg = amount * (1 - player.damageReduction);
    player.hp -= actualDmg;
    player.invincibleTimer = 0.5;

    if (player.hp < 0) player.hp = 0;
}
