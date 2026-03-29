const keys = new Map();
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let canvas = null;

export function initInput(canvasEl) {
    canvas = canvasEl;

    window.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
        keys.set(e.key.toLowerCase(), true);
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
    return mouseDown || keys.get(' ') || false;
}
