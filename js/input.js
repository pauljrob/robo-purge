const keys = new Map();
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let canvas = null;
let autoShoot = false;
let lastShiftTime = 0;
let aimAssist = false;

export function initInput(canvasEl) {
    canvas = canvasEl;

    window.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
        keys.set(e.key.toLowerCase(), true);

        // Q - toggle aim assist
        if (e.key === 'q' || e.key === 'Q') {
            aimAssist = !aimAssist;
        }

        // Double-tap shift to toggle auto shoot
        if (e.key === 'Shift') {
            const now = Date.now();
            if (now - lastShiftTime < 400) {
                autoShoot = !autoShoot;
                lastShiftTime = 0;
            } else {
                lastShiftTime = now;
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        keys.set(e.key.toLowerCase(), false);
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) mouseDown = true;
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouseDown = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function isKeyDown(key) {
    return keys.get(key) || false;
}

export function getMousePos() {
    return { x: mouseX, y: mouseY };
}

export function isShooting() {
    return autoShoot || mouseDown || keys.get(' ') || false;
}

export function isAutoShoot() {
    return autoShoot;
}

export function resetAutoShoot() {
    autoShoot = false;
}

export function isAimAssist() {
    return aimAssist;
}
