let ctx = null;
let cameraX = 0;
let cameraY = 0;
let canvasWidth = 800;
let canvasHeight = 600;
let shakeX = 0;
let shakeY = 0;
let shakeIntensity = 0;

export function initRenderer(context, w, h) {
    ctx = context;
    canvasWidth = w;
    canvasHeight = h;
}

export function getCtx() {
    return ctx;
}

export function setCamera(x, y) {
    cameraX = x - canvasWidth / 2;
    cameraY = y - canvasHeight / 2;
}

export function getCameraOffset() {
    return { x: cameraX + shakeX, y: cameraY + shakeY };
}

export function beginCamera() {
    ctx.save();
    ctx.translate(-cameraX - shakeX, -cameraY - shakeY);
}

export function endCamera() {
    ctx.restore();
}

export function screenToWorld(sx, sy) {
    return { x: sx + cameraX + shakeX, y: sy + cameraY + shakeY };
}

export function clear() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

export function triggerShake(intensity) {
    shakeIntensity = intensity;
}

export function updateShake() {
    if (shakeIntensity > 0) {
        shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
        shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
        shakeIntensity *= 0.85;
        if (shakeIntensity < 0.5) {
            shakeIntensity = 0;
            shakeX = 0;
            shakeY = 0;
        }
    }
}

export function drawCircle(x, y, radius, color, filled = true) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (filled) {
        ctx.fillStyle = color;
        ctx.fill();
    } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

export function drawRect(x, y, w, h, color, filled = true) {
    if (filled) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
    }
}

export function drawText(text, x, y, color = '#fff', size = 16, align = 'left') {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}

export function drawLine(x1, y1, x2, y2, color, width = 2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}

export { canvasWidth, canvasHeight };
