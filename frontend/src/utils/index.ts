// src/utils/index.ts

// --- THEME CONSTANTS ---
export const themeColors = {
    bg: '#0b0c10',
    accent: '#0ea5e9',
    text: '#ececec',
    textMuted: '#8b9bb4',
    t: '#eab308',
    ct: '#3b82f6',
    win: '#10b981',
    loss: '#ef4444',
    border: 'rgba(255, 255, 255, 0.08)'
};

import { API_URL } from '../config';

export const LOCAL_PARSER_URL = API_URL;


// --- HELPERS ---
export const getRatingColor = (rating: number) => {
    if (rating >= 1.30) return '#d946ef';
    if (rating >= 1.20) return '#10b981';
    if (rating >= 1.05) return '#a3e635';
    if (rating >= 0.90) return '#fbbf24';
    return '#ef4444';
};

export const getMapGradient = (mapName: string) => {
    const m = mapName.toLowerCase();
    if (m.includes('mirage')) return 'linear-gradient(135deg, #d97706 0%, #78350f 100%)';
    if (m.includes('inferno')) return 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)';
    if (m.includes('nuke')) return 'linear-gradient(135deg, #0ea5e9 0%, #1e3a8a 100%)';
    if (m.includes('overpass')) return 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)';
    if (m.includes('vertigo')) return 'linear-gradient(135deg, #64748b 0%, #334155 100%)';
    if (m.includes('ancient')) return 'linear-gradient(135deg, #22c55e 0%, #14532d 100%)';
    if (m.includes('anubis')) return 'linear-gradient(135deg, #eab308 0%, #854d0e 100%)';
    if (m.includes('dust')) return 'linear-gradient(135deg, #fcd34d 0%, #b45309 100%)';
    return 'linear-gradient(135deg, #3f3f46 0%, #18181b 100%)';
};

export const formatWeapon = (w: string) => {
    if (!w) return '-';
    const clean = w.replace('weapon_', '').toUpperCase();
    if (clean.includes('KNIFE')) return '🔪';
    if (clean === 'HEGRENADE') return 'HE';
    if (clean === 'INFERNO') return '🔥';
    if (clean === 'AK47') return 'AK-47';
    if (clean === 'AWP') return 'AWP';
    if (clean === 'C4_PLANTED') return 'C4';
    return clean;
};

export const formatMatchDate = (filename: string, isoDate: string) => {
    let d = new Date(isoDate);
    if (!isoDate || isNaN(d.getTime())) {
        const match = filename?.match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
        if (match) {
            const [, y, m, day, h, min] = match;
            d = new Date(parseInt(y), parseInt(m) - 1, parseInt(day), parseInt(h), parseInt(min));
        } else {
            return 'Unknown | -';
        }
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} | ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const getRoundIcon = (type: string) => {
    switch (type) {
        case 'bomb': return '💥';
        case 'defuse': return '✂️';
        case 'time': return '⏱️';
        default: return '💀';
    }
};

export const isRainbowName = (name: string | null | undefined) => {
    if (!name) return false;
    return name.toLowerCase() === 'hohlomet3000';
};

export const isPoopName = (name: string | null | undefined) => {
    if (!name) return false;
    return name.toLowerCase() === 'cheattopchik';
};

export const normalizeSide = (side: string | number | null | undefined): string => {
    if (side === undefined || side === null) return '';
    const s = String(side).toUpperCase();
    if (s === '2' || s === 'T' || s === 'TERRORIST') return 'T';
    if (s === '3' || s === 'CT' || s === 'CTERRORIST') return 'CT';
    return s;
};

export const formatTime = (seconds: number) => {
    if (seconds === undefined || seconds === null) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};
