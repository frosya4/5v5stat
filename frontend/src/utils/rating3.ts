// src/utils/rating3.ts

export interface RatingStats {
    rounds: number;
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    // Специфичные поля для 3.0
    weighted_kills?: number; // Если не посчитано, будет равно kills
    opening_kills: number;
    multikills: number;      // 3k+
    awp_multikills: number;  // 3k+ with AWP
    clutch_score: number;    // 1v1=1, 1v2=2 и т.д.
    kast?: number;           // Real KAST from parser if available
}

// 1. Категории оружия
export const getWeaponCategory = (weaponName: string): string => {
    if (!weaponName) return 'unknown';
    const w = weaponName.toLowerCase().replace('weapon_', '');

    if (['awp', 'g3sg1', 'scar20'].includes(w)) return 'sniper';
    if (['ak47', 'm4a1', 'm4a4', 'm4a1_silencer', 'sg556', 'aug', 'galilar', 'famas'].includes(w)) return 'rifle';
    if (['mac10', 'mp9', 'ump45', 'bizon', 'p90', 'mp7', 'mp5sd', 'mag7', 'nova', 'sawedoff', 'xm1014', 'm249', 'negev', 'ssg08'].includes(w)) return 'farm';
    if (['glock', 'hkp2000', 'usp_silencer', 'p250', 'fiveseven', 'tec9', 'cz75a', 'elite', 'revolver', 'deagle'].includes(w)) return 'pistol';
    if (['hegrenade', 'inferno', 'molotov', 'incgrenade'].includes(w)) return 'util';
    if (['knife', 'taser', 'knife_t'].includes(w)) return 'knife';

    return 'rifle';
};

// 2. Матрица весов (Weighted Kills)
export const getKillMultiplier = (killerWep: string, victimWep: string): number => {
    const kCat = getWeaponCategory(killerWep);
    const vCat = getWeaponCategory(victimWep);

    const matrix: Record<string, Record<string, number>> = {
        sniper: { sniper: 1.0, rifle: 0.8, farm: 0.6, pistol: 0.7, util: 0.5, knife: 0.5, unknown: 0.8 },
        rifle: { sniper: 1.15, rifle: 1.0, farm: 0.85, pistol: 0.7, util: 0.7, knife: 0.7, unknown: 1.0 },
        farm: { sniper: 1.3, rifle: 1.1, farm: 1.0, pistol: 0.8, util: 0.8, knife: 0.8, unknown: 1.0 },
        pistol: { sniper: 1.5, rifle: 1.3, farm: 1.1, pistol: 1.0, util: 1.0, knife: 1.0, unknown: 1.1 },
        knife: { sniper: 2.0, rifle: 2.0, farm: 2.0, pistol: 1.5, util: 1.5, knife: 1.0, unknown: 2.0 },
        util: { sniper: 1.0, rifle: 1.0, farm: 1.0, pistol: 0.8, util: 1.0, knife: 1.0, unknown: 1.0 }
    };

    return matrix[kCat]?.[vCat] ?? 1.0;
};

// 3. Основная формула
export const calculateRating3 = (stats: RatingStats) => {
    const rounds = stats.rounds || 1;

    // --- Basic Stats ---
    const weightedKills = stats.weighted_kills || stats.kills;
    const wkpr = weightedKills / rounds;
    const dpr = stats.deaths / rounds;
    const apr = stats.assists / rounds;
    const adr = stats.damage / rounds;

    // --- Impact Calculation ---
    const okpr = stats.opening_kills / rounds;
    const mkpr = stats.multikills / rounds;
    const awp_mkpr = stats.awp_multikills / rounds;
    const clutch_points_per_round = stats.clutch_score / rounds;

    // Impact Formula
    // Base Impact
    let impact = (2.13 * wkpr) + (0.42 * apr) - 0.41;

    // Bonuses
    impact += (okpr * 1.5);           // Entry frags
    impact += (mkpr * 0.8);           // Regular multikills
    impact += (awp_mkpr * 0.5);       // AWP Multikill Bonus (Reduced from 1.2)
    impact += (clutch_points_per_round * 1.5); // Clutch Bonus (Reduced from 3.0)

    // --- Survival & KAST ---
    const survival_rating = (rounds - stats.deaths) / rounds;

    // Используем реальный KAST, если передан, иначе аппроксимация
    let kast_val = 0;
    if (stats.kast !== undefined) {
        kast_val = stats.kast / 100.0; // Обычно KAST идет 0-100
    } else {
        kast_val = 0.70 + (survival_rating * 0.1) + (apr * 0.1); // Fallback
    }

    // --- Final Rating ---
    const rating = (
        (0.0073 * (kast_val * 100)) +
        (0.3591 * wkpr) +
        (-0.5329 * dpr) +
        (0.2372 * impact) +
        (0.0032 * adr) +
        0.1587
    );

    return {
        rating: Math.max(0.1, rating).toFixed(2),
        impact: Math.max(0.0, impact).toFixed(2),
        avg_kill_weight: (stats.kills > 0 ? (weightedKills / stats.kills) : 0).toFixed(2)
    };
};