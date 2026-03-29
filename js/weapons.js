export const WEAPONS = {
    pistol: {
        id: 'pistol',
        name: 'Pistol',
        fireRate: 4,
        damage: 10,
        bulletSpeed: 500,
        bullets: 1,
        spread: 0,
        color: '#ff0',
        bulletSize: 3,
        piercing: false,
        explosive: false,
        locked: false,
    },
    machinegun: {
        id: 'machinegun',
        name: 'Machine Gun',
        fireRate: 10,
        damage: 6,
        bulletSpeed: 600,
        bullets: 1,
        spread: 5,
        color: '#f80',
        bulletSize: 2,
        piercing: false,
        explosive: false,
        locked: true,
    },
    shotgun: {
        id: 'shotgun',
        name: 'Shotgun',
        fireRate: 2,
        damage: 8,
        bulletSpeed: 450,
        bullets: 5,
        spread: 30,
        color: '#f44',
        bulletSize: 3,
        piercing: false,
        explosive: false,
        locked: true,
    },
    railgun: {
        id: 'railgun',
        name: 'Railgun',
        fireRate: 0.8,
        damage: 50,
        bulletSpeed: 1200,
        bullets: 1,
        spread: 0,
        color: '#0ff',
        bulletSize: 4,
        piercing: true,
        explosive: false,
        locked: true,
    },
    plasma: {
        id: 'plasma',
        name: 'Plasma Cannon',
        fireRate: 1.5,
        damage: 30,
        bulletSpeed: 350,
        bullets: 1,
        spread: 0,
        color: '#f0f',
        bulletSize: 6,
        piercing: false,
        explosive: true,
        explosionRadius: 60,
        locked: true,
    },
    laser: {
        id: 'laser',
        name: 'Laser',
        fireRate: 30,
        damage: 3,
        bulletSpeed: 900,
        bullets: 1,
        spread: 1,
        color: '#0f0',
        bulletSize: 2,
        piercing: false,
        explosive: false,
        locked: true,
    },
};

const weaponOrder = ['pistol', 'machinegun', 'shotgun', 'railgun', 'plasma', 'laser'];

export function getWeapon(id) {
    return WEAPONS[id];
}

export function getWeaponByIndex(index) {
    const id = weaponOrder[index];
    return id ? WEAPONS[id] : null;
}

export function getWeaponOrder() {
    return weaponOrder;
}
