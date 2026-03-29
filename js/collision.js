export function circleVsCircle(x1, y1, r1, x2, y2, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const combinedR = r1 + r2;
    return (dx * dx + dy * dy) < (combinedR * combinedR);
}
