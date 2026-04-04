// Мета-данные о парсере (версия, детализация)
export interface MatchMeta {
    version: number;
    is_detailed: boolean;
    parser: string;
}

// Событие убийства (Kill Feed)
export interface KillEvent {
    time: string;
    killer: string;
    killer_team: string;
    victim: string;
    victim_team: string;
    weapon: string;
    hs: boolean;
    is_trade: boolean;

    // 🔥 V3: Style Points (Новые флаги)
    is_wallbang?: boolean;
    is_through_smoke?: boolean;
    is_noscope?: boolean;
    is_blind?: boolean; // Убийца был ослеплен
    is_bomb?: boolean;  // Событие бомбы (плант/дефьюз)

    // V3: SteamIDs
    killer_steamid?: string;
    victim_steamid?: string;
    attacker_steamid?: string;
    assister_steamid?: string;

    // Expanded fields for feed logic
    attacker_team?: string;
    attacker_name?: string;
    attacker?: string;
    assister?: string;
    assister_name?: string;
    victim_name?: string;
    team?: string;
    headshot?: boolean;

    // 🔥 V3: Координаты (для Heatmap)
    kx?: number; ky?: number; kz?: number; // Killer Pos
    vx?: number; vy?: number; vz?: number; // Victim Pos
}

// Статистика дуэлей
export interface DuelStat {
    enemy: string;
    kills: number;
    deaths: number;
    diff: number;
}

// Статистика оружия
export interface WeaponStat {
    name: string;
    kills: number;
    hs: number;
    hs_percent: number;
}

export interface SideStat {
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    fk: number;
    fd: number;
    rounds: number;
    rating: number;
    rating_3: number;
    adr: number;
    impact: number;
    kast: number;
}

// Статистика игрока
export interface PlayerStat {
    name: string;
    originalName?: string;
    steamid: string;
    team: string;

    t_stats?: SideStat;
    ct_stats?: SideStat;

    // Базовые
    kills: number;
    deaths: number;
    assists: number;
    flash_assists: number;
    trade_kills: number;
    hs: number;
    hs_percent: number;
    kd: number;
    adr: number;
    kast: number;
    impact: number;
    rating: number;   // Rating 2.0
    rating_3: number; // Rating 3.0 (Beta)

    // Дополнительные
    fk: number; // First Kills
    fd: number; // First Deaths

    blind_time?: number;            // Сколько времени был ослеплен сам
    enemies_flashed_time?: number;  // 🔥 V3: Сколько времени слепил врагов
    enemies_flashed_count?: number; // 🔥 V3: Кол-во ослепленных врагов

    util_dmg: number;
    util_dmg_per_round: number;
    money_spent: number;
    fav_weapon: string;

    // Клатчи
    clutches_1v1: number;
    clutches_1v2: number;
    clutches_1v3: number;
    clutches_1v4: number;
    clutches_1v5: number;

    // 🔥 V3: Хитгруппы (Попадания)
    hits_head?: number;
    hits_chest?: number;
    hits_stomach?: number;
    hits_arms?: number;
    hits_legs?: number;

    // 🔥 V3: Бомба
    plants?: number;
    defuses?: number;

    // 🛠️ LEGACY FIELDS (Поля для совместимости со старым кодом)
    // Добавлены как optional (?), чтобы убрать ошибки TS
    k1?: number;
    k2?: number;
    k3?: number;
    k4?: number;
    k5?: number;
    rounds_with_kills?: number;

    // New fields found in usage
    damage?: number;
    weighted_kills?: number;
    awp_multikills?: number;
    flashes_thrown?: number;
    trade_deaths?: number;
    round_swing_count?: number;
    rounds_with_multikills?: number;

    // Parser 3.0: KAST breakdown (round counts per component)
    kast_kill?: number;
    kast_assist?: number;
    kast_survived?: number;
    kast_traded?: number;

    // Parser 3.0: Per-round rates and opening duels
    kpr?: number;
    dpr?: number;
    opening_kills?: number;
    opening_deaths?: number;
    opening_pct?: number;

    // Массивы
    weapons: WeaponStat[];
    duels: DuelStat[];
}

// История раунда
export interface RoundHistory {
    round_num: number;
    winner_side: string; // "CT" | "T"
    winner_team?: string;
    win_type: string;    // "bomb", "defuse", "elimination", "time"

    // Счет (Парсер отдает score_a / score_b)
    score_a: number;     // CT Score
    score_b: number;     // T Score

    // 🔥 V3: Экономика
    buy_type_t?: string;  // "Eco", "Force", "Full"
    buy_type_ct?: string;

    kill_feed?: KillEvent[];
    grenades?: GrenadeEvent[];
    reason?: number;
}

export interface GrenadeEvent {
    thrower: string;
    thrower_team: string; // "CT" | "T"
    type: 'smoke' | 'flash' | 'he' | 'fire' | 'decoy';
    x: number;
    y: number;
    z: number;
    time: string;
}

// Ответ от API (Матч целиком)
export interface DemoResponse {
    id: string;
    filename: string;
    upload_date: string;
    map: string;

    rounds_count: number;
    final_score_t: number;
    final_score_ct: number;

    players: PlayerStat[];
    rounds_history: RoundHistory[];

    // 🔥 V3: Мета-данные
    meta?: MatchMeta;
}

export interface EnrichedPlayer extends PlayerStat {
    rating_3_calc: number;
    impact_3_calc: number;
    kill_weight_calc: number;
    clutch_score_total: number;
}

// Краткая сводка матча (для списка в App.tsx)
export interface MatchSummary {
    id: string;
    filename: string;
    map: string;
    score_t: number;
    score_ct: number;
    date: string;
    meta?: MatchMeta;
}

export interface PlayerHistoryStat {
    date: number;
    rating: number;
    kills: number;
    deaths: number;
    assists: number;
    hs: number;
    damage: number;
    rounds: number;
    entry_wins: number;
    entry_attempts: number;
    util_dmg: number;
    kast: number;
    impact: number;
    trade_kills: number;
    awp_kills: number;
    flash_assists: number;
    enemies_flashed_count: number;
}

export interface PlayerAggregated {
    id: string;
    name: string;
    maps: number;
    rating: string;
    kd: string;
    adr: number;
    avg_impact: string;
    avg_kast: string;
    assist_per_round: string;
    saved_per_round: string;
    awp_per_round: string;
    kpr: string;
    hs_percent: number;
    entry_success: number;
    ud_per_round: string;
    avg_flash: string;
    avg_enemies_flashed: string;
    kills: number;
    deaths: number;
    assists: number;
}