import { drawCircle, drawLine, getCtx } from './renderer.js';
import { normalize, distance, randomRange, angleToTarget } from './utils.js';
import { spawnProjectile } from './projectiles.js';
import { spawnExplosion } from './particles.js';

const MAX_ENEMIES = 100;
const pool = [];

for (let i = 0; i < MAX_ENEMIES; i++) {
    pool.push({
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        hp: 0, maxHp: 0,
        type: 'drone',
        speed: 0,
        radius: 12,
        color: '#888',
        points: 10,
        aiState: 'seek',
        aiTimer: 0,
        shootTimer: 0,
        flashTimer: 0,
        dashAngle: 0,
    });
}

const ENEMY_DEFS = {
    drone: {
        hp: 20, speed: 120, radius: 12, color: '#888', points: 10,
    },
    shooter: {
        hp: 40, speed: 60, radius: 14, color: '#f44', points: 25,
    },
    charger: {
        hp: 30, speed: 100, radius: 13, color: '#ff0', points: 20,
    },
    tank: {
        hp: 120, speed: 40, radius: 20, color: '#4a4', points: 50,
    },
    phaser: {
        hp: 25, speed: 100, radius: 11, color: '#a4f', points: 35,
    },
};

export function spawnEnemy(type, x, y, hpMultiplier = 1) {
    const def = ENEMY_DEFS[type];
    if (!def) return null;
    for (const e of pool) {
        if (!e.active) {
            e.active = true;
            e.x = x;
            e.y = y;
            e.vx = 0;
            e.vy = 0;
            e.type = type;
            e.hp = def.hp * hpMultiplier;
            e.maxHp = def.hp * hpMultiplier;
            e.speed = def.speed;
            e.radius = def.radius;
            e.color = def.color;
            e.points = def.points;
            e.aiState = type === 'charger' ? 'idle' : 'seek';
            e.aiTimer = 0;
            e.shootTimer = randomRange(0.5, 1.5);
            e.flashTimer = 0;
            e.dashAngle = 0;
            return e;
        }
    }
    return null;
}

export function updateEnemies(dt, playerX, playerY, speedMultiplier = 1) {
    for (const e of pool) {
        if (!e.active) continue;

        e.flashTimer = Math.max(0, e.flashTimer - dt);
        e.aiTimer += dt;
        e.shootTimer -= dt;

        const dist = distance(e.x, e.y, playerX, playerY);
        const dir = normalize(playerX - e.x, playerY - e.y);
        const spd = e.speed * speedMultiplier;

        switch (e.type) {
            case 'drone':
                e.vx = dir.x * spd;
                e.vy = dir.y * spd;
                break;

            case 'shooter':
                if (dist > 300) {
                    e.vx = dir.x * spd;
                    e.vy = dir.y * spd;
                } else if (dist < 200) {
                    e.vx = -dir.x * spd * 0.5;
                    e.vy = -dir.y * spd * 0.5;
                } else {
                    // Strafe
                    e.vx = -dir.y * spd * 0.7;
                    e.vy = dir.x * spd * 0.7;
                }
                if (e.shootTimer <= 0) {
                    e.shootTimer = 1.5;
                    const angle = angleToTarget(e.x, e.y, playerX, playerY);
                    const spread = randomRange(-0.1, 0.1);
                    spawnProjectile(
                        e.x, e.y,
                        Math.cos(angle + spread) * 300,
                        Math.sin(angle + spread) * 300,
                        8, 'enemy', '#f66', 3
                    );
                }
                break;

            case 'charger':
                switch (e.aiState) {
                    case 'idle':
                        e.vx = 0;
                        e.vy = 0;
                        if (e.aiTimer > 1.5) {
                            e.aiState = 'telegraph';
                            e.aiTimer = 0;
                            e.dashAngle = angleToTarget(e.x, e.y, playerX, playerY);
                        }
                        break;
                    case 'telegraph':
                        e.vx = 0;
                        e.vy = 0;
                        if (e.aiTimer > 0.5) {
                            e.aiState = 'dash';
                            e.aiTimer = 0;
                        }
                        break;
                    case 'dash':
                        e.vx = Math.cos(e.dashAngle) * spd * 3;
                        e.vy = Math.sin(e.dashAngle) * spd * 3;
                        if (e.aiTimer > 0.6) {
                            e.aiState = 'cooldown';
                            e.aiTimer = 0;
                        }
                        break;
                    case 'cooldown':
                        e.vx *= 0.9;
                        e.vy *= 0.9;
                        if (e.aiTimer > 0.5) {
                            e.aiState = 'idle';
                            e.aiTimer = 0;
                        }
                        break;
                }
                break;

            case 'tank':
                e.vx = dir.x * spd;
                e.vy = dir.y * spd;
                if (e.shootTimer <= 0) {
                    e.shootTimer = 2;
                    const angle = angleToTarget(e.x, e.y, playerX, playerY);
                    for (let i = -1; i <= 1; i++) {
                        spawnProjectile(
                            e.x, e.y,
                            Math.cos(angle + i * 0.2) * 250,
                            Math.sin(angle + i * 0.2) * 250,
                            10, 'enemy', '#8f8', 4
                        );
                    }
                }
                break;

            case 'phaser':
                e.vx = dir.x * spd;
                e.vy = dir.y * spd;
                if (e.aiTimer > 3) {
                    e.aiTimer = 0;
                    // Teleport near player
                    const tAngle = randomRange(0, Math.PI * 2);
                    const tDist = randomRange(100, 200);
                    e.x = playerX + Math.cos(tAngle) * tDist;
                    e.y = playerY + Math.sin(tAngle) * tDist;
                    spawnExplosion(e.x, e.y, '#a4f', 8, 100, 2, 0.3);
                }
                break;
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;
    }
}

export function renderEnemies(ctx) {
    const gctx = getCtx();
    for (const e of pool) {
        if (!e.active) continue;

        const color = e.flashTimer > 0 ? '#fff' : e.color;

        switch (e.type) {
            case 'drone':
                drawCircle(e.x, e.y, e.radius, color);
                // Antenna
                drawLine(e.x - 4, e.y - e.radius, e.x - 6, e.y - e.radius - 6, color, 1);
                drawLine(e.x + 4, e.y - e.radius, e.x + 6, e.y - e.radius - 6, color, 1);
                break;

            case 'shooter':
                drawCircle(e.x, e.y, e.radius, color);
                // Gun barrel indicator
                gctx.fillStyle = '#a00';
                gctx.fillRect(e.x - 2, e.y - e.radius - 4, 4, 6);
                break;

            case 'charger':
                drawCircle(e.x, e.y, e.radius, color);
                if (e.aiState === 'telegraph') {
                    // Flash warning
                    drawCircle(e.x, e.y, e.radius + 4, '#ff0', false);
                }
                if (e.aiState === 'dash') {
                    drawCircle(e.x, e.y, e.radius + 2, '#fa0', false);
                }
                break;

            case 'tank':
                drawCircle(e.x, e.y, e.radius, color);
                drawCircle(e.x, e.y, e.radius - 4, '#252', true);
                // Thick border
                gctx.beginPath();
                gctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
                gctx.strokeStyle = '#6d6';
                gctx.lineWidth = 3;
                gctx.stroke();
                break;

            case 'phaser':
                gctx.globalAlpha = 0.7;
                drawCircle(e.x, e.y, e.radius, color);
                gctx.globalAlpha = 1;
                // Dashed outline
                gctx.setLineDash([3, 3]);
                drawCircle(e.x, e.y, e.radius + 3, '#c6f', false);
                gctx.setLineDash([]);
                break;
        }

        // HP bar
        if (e.hp < e.maxHp) {
            const barW = e.radius * 2;
            const barH = 3;
            const barX = e.x - barW / 2;
            const barY = e.y - e.radius - 8;
            gctx.fillStyle = '#300';
            gctx.fillRect(barX, barY, barW, barH);
            gctx.fillStyle = '#f00';
            gctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
        }
    }
}

export function getEnemies() {
    return pool;
}

export function getActiveEnemyCount() {
    let count = 0;
    for (const e of pool) {
        if (e.active) count++;
    }
    return count;
}

export function clearEnemies() {
    for (const e of pool) {
        e.active = false;
    }
}
