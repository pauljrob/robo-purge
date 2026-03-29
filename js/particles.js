import { drawCircle } from './renderer.js';
import { randomRange } from './utils.js';

const MAX_PARTICLES = 200;
const pool = [];

for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0,
        maxLife: 1,
        color: '#fff',
        size: 3,
    });
}

export function spawnParticle(x, y, vx, vy, color, size, maxLife) {
    for (const p of pool) {
        if (!p.active) {
            p.active = true;
            p.x = x;
            p.y = y;
            p.vx = vx;
            p.vy = vy;
            p.color = color;
            p.size = size;
            p.life = 0;
            p.maxLife = maxLife;
            return p;
        }
    }
    return null;
}

export function spawnExplosion(x, y, color, count, speed = 200, size = 3, life = 0.5) {
    for (let i = 0; i < count; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const spd = randomRange(speed * 0.3, speed);
        spawnParticle(
            x, y,
            Math.cos(angle) * spd,
            Math.sin(angle) * spd,
            color,
            randomRange(size * 0.5, size),
            randomRange(life * 0.5, life)
        );
    }
}

export function updateParticles(dt) {
    for (const p of pool) {
        if (!p.active) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life += dt;
        if (p.life >= p.maxLife) {
            p.active = false;
        }
    }
}

export function renderParticles(ctx) {
    for (const p of pool) {
        if (!p.active) continue;
        const alpha = 1 - (p.life / p.maxLife);
        const size = p.size * alpha;
        const color = p.color;

        ctx.globalAlpha = alpha;
        drawCircle(p.x, p.y, Math.max(0.5, size), color);
    }
    ctx.globalAlpha = 1;
}

export function clearParticles() {
    for (const p of pool) {
        p.active = false;
    }
}
