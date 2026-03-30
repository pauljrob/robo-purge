import { drawCircle, getCtx } from './renderer.js';
import { normalize, distanceSq } from './utils.js';

const MAX_PROJECTILES = 300;
const pool = [];

for (let i = 0; i < MAX_PROJECTILES; i++) {
    pool.push({
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        damage: 0,
        owner: 'player',
        color: '#ff0',
        size: 3,
        life: 0,
        maxLife: 2,
        piercing: false,
        explosive: false,
        explosionRadius: 0,
        homing: false,
    });
}

export function spawnProjectile(x, y, vx, vy, damage, owner, color, size, piercing = false, explosive = false, explosionRadius = 0, homing = false) {
    for (const p of pool) {
        if (!p.active) {
            p.active = true;
            p.x = x;
            p.y = y;
            p.vx = vx;
            p.vy = vy;
            p.damage = damage;
            p.owner = owner;
            p.color = color;
            p.size = size;
            p.life = 0;
            p.maxLife = 2;
            p.piercing = piercing;
            p.explosive = explosive;
            p.explosionRadius = explosionRadius;
            p.homing = homing;
            return p;
        }
    }
    return null;
}

export function updateProjectiles(dt, arenaW, arenaH, enemies) {
    for (const p of pool) {
        if (!p.active) continue;

        // Homing: steer toward nearest enemy
        if (p.homing && p.owner === 'player' && enemies) {
            let nearest = null;
            let nearestDist = Infinity;
            for (const e of enemies) {
                if (!e.active) continue;
                const d = distanceSq(p.x, p.y, e.x, e.y);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = e;
                }
            }
            if (nearest) {
                const dir = normalize(nearest.x - p.x, nearest.y - p.y);
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                const turnRate = 8;
                p.vx += dir.x * turnRate * speed * dt;
                p.vy += dir.y * turnRate * speed * dt;
                // Keep speed constant
                const newDir = normalize(p.vx, p.vy);
                p.vx = newDir.x * speed;
                p.vy = newDir.y * speed;
            }
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life += dt;

        if (p.life > p.maxLife || p.x < -50 || p.x > arenaW + 50 || p.y < -50 || p.y > arenaH + 50) {
            p.active = false;
        }
    }
}

export function renderProjectiles(ctx) {
    for (const p of pool) {
        if (!p.active) continue;

        // Glow effect
        const gctx = getCtx();
        gctx.shadowBlur = 8;
        gctx.shadowColor = p.color;
        drawCircle(p.x, p.y, p.size, p.color);
        gctx.shadowBlur = 0;
    }
}

export function getProjectiles() {
    return pool;
}

export function clearProjectiles() {
    for (const p of pool) {
        p.active = false;
    }
}
