export function magnitude(x, y) {
    return Math.sqrt(x * x + y * y);
}

export function normalize(x, y) {
    const mag = magnitude(x, y);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: x / mag, y: y / mag };
}

export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}

export function angleToTarget(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

export function randomColor() {
    const colors = ['#f44', '#4f4', '#44f', '#ff4', '#f4f', '#4ff', '#fa4', '#f84'];
    return colors[randomInt(0, colors.length - 1)];
}
