import type { DemoResponse } from "../types";

export interface AggregatedPlayer {
    name: string;
    steamid: string;
    matches: number;
    roundsPlayed: number;

    // Total Counts
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
    totalDamage: number;
    totalHeadshots: number;
    totalFirstKills: number;
    totalFirstDeaths: number;
    totalClutcheswon: number;
    totalAwpKills: number;
    totalFlashes: number; // Flash assists or thrown (using flash_assists here)

    // Calculated Averages / Rates
    rating: number;      // Weighted Avg
    rating3: number;     // Weighted Avg
    adr: number;         // Weighted Avg
    kast: number;        // Weighted Avg
    impact: number;      // Weighted Avg
    kd: number;          // Total K / Total D
    hsPct: number;       // Avg

    // Specific Roles
    entrySuccess: number; // FK / (FK+FD) %
    awpKillsPerRound: number;
    clutchPoints: number; // Weighted clutch score
}

// Helper to normalize steamID (sometimes string, sometimes number depending on parser ver)
const normalizeId = (id: string | number) => String(id);

export const aggregateGlobalStats = (matches: DemoResponse[], aliases: Record<string, string> = {}, merges: Record<string, string> = {}): AggregatedPlayer[] => {
    const playerMap: Record<string, AggregatedPlayer> = {};

    matches.forEach(match => {
        match.players.forEach(p => {
            // Logic for Merging
            let finalId = normalizeId(p.steamid || p.name);
            if (merges[finalId]) {
                finalId = merges[finalId];
            }

            // Logic for Aliases
            const displayName = aliases[finalId] || aliases[p.steamid] || p.name;

            if (!playerMap[finalId]) {
                playerMap[finalId] = {
                    name: displayName,
                    steamid: finalId,
                    matches: 0,
                    roundsPlayed: 0,
                    totalKills: 0,
                    totalDeaths: 0,
                    totalAssists: 0,
                    totalDamage: 0,
                    totalHeadshots: 0,
                    totalFirstKills: 0,
                    totalFirstDeaths: 0,
                    totalClutcheswon: 0,
                    totalAwpKills: 0,
                    totalFlashes: 0,
                    rating: 0,
                    rating3: 0,
                    adr: 0,
                    kast: 0,
                    impact: 0,
                    kd: 0,
                    hsPct: 0,
                    entrySuccess: 0,
                    awpKillsPerRound: 0,
                    clutchPoints: 0
                };
            }

            const agg = playerMap[finalId];

            // If name changed to something more recent/custom, update it (optional, but good if alias changed)
            if (aliases[finalId]) agg.name = aliases[finalId];

            // WEIGHTED ACCUMULATION
            const r = match.rounds_count || 1;

            agg.matches++;
            agg.roundsPlayed += r;
            agg.totalKills += p.kills;
            agg.totalDeaths += p.deaths;
            agg.totalAssists += p.assists;
            agg.totalDamage += (p.adr * r); // Revert to total damage approx
            agg.totalHeadshots += p.hs;
            agg.totalFirstKills += p.fk;
            agg.totalFirstDeaths += p.fd;
            agg.totalFlashes += p.flash_assists;

            // Rating accumulation (weighted by rounds)
            agg.rating += p.rating * r;
            agg.rating3 += (p.rating_3 || p.rating) * r;
            agg.adr += p.adr * r; // Double accumulation essentially, but we divide later
            agg.kast += p.kast * r;
            agg.impact += p.impact * r;
            agg.hsPct += p.hs_percent * r;

            // Clutches
            const cPoints = (p.clutches_1v1 * 1) + (p.clutches_1v2 * 2) + (p.clutches_1v3 * 4) + (p.clutches_1v4 * 6) + (p.clutches_1v5 * 10);
            agg.clutchPoints += cPoints;
            agg.totalClutcheswon += (p.clutches_1v1 + p.clutches_1v2 + p.clutches_1v3 + p.clutches_1v4 + p.clutches_1v5);

            // AWP
            const awp = p.weapons.find(w => w.name.toLowerCase().includes('awp'));
            if (awp) agg.totalAwpKills += awp.kills;
        });
    });

    // FINAL CALCULATION
    return Object.values(playerMap).map(agg => {
        if (agg.roundsPlayed === 0) return agg;

        agg.rating = agg.rating / agg.roundsPlayed;
        agg.rating3 = agg.rating3 / agg.roundsPlayed;
        // agg.adr is mostly accumulated as (ADR * Rounds), so dividing by Rounds gives Avg ADR. 
        // Logic above: totalDamage += p.adr * r. Wait, better to use totalDamage accumulator if we want precise.
        // But p.adr is derived. Let's trust the weighted sum.
        agg.adr = agg.adr / agg.roundsPlayed;

        // Correct ADR calculation using logic: TotalDamage / RoundsPlayed
        // agg.totalDamage was approx calculated. Let's use that.
        // Actually, let's just use weighted average of ADR which is effectively TotalDamage / TotalRounds if dataset is consistent.

        agg.kast = agg.kast / agg.roundsPlayed;
        agg.impact = agg.impact / agg.roundsPlayed;
        agg.hsPct = agg.hsPct / agg.roundsPlayed;

        agg.kd = agg.totalDeaths > 0 ? agg.totalKills / agg.totalDeaths : agg.totalKills;

        const openAttempts = agg.totalFirstKills + agg.totalFirstDeaths;
        agg.entrySuccess = openAttempts > 0 ? (agg.totalFirstKills / openAttempts) * 100 : 0;

        agg.awpKillsPerRound = agg.totalAwpKills / agg.roundsPlayed;

        return agg;
    });
};

export const getTopPlayers = (players: AggregatedPlayer[], metric: keyof AggregatedPlayer, limit = 5, minRounds = 50): AggregatedPlayer[] => {
    return players
        .filter(p => p.roundsPlayed >= minRounds)
        .sort((a, b) => (b[metric] as number) - (a[metric] as number))
        .slice(0, limit);
};
