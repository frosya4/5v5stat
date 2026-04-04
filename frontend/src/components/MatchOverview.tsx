import React, { useMemo } from 'react';
import { themeColors } from '../utils';
import type { EnrichedPlayer, RoundHistory } from '../types';

interface Props {
    players: EnrichedPlayer[];
    roundsHistory: RoundHistory[];
    roundsCount: number;
    finalScoreCT: number;
    finalScoreT: number;
}

// --- HELPER COMPONENTS ---
const ProgressBar = ({ value, max = 100, color = '#3b82f6' }: { value: number, max?: number, color?: string }) => {
    const width = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease', boxShadow: `0 0 10px ${color}40` }}></div>
        </div>
    );
};

const StatCard = ({ title, icon, score, description, children }: { title: string, icon: string, score?: number, description?: string, children: React.ReactNode }) => (
    <div style={{ background: '#13151b', border: '1px solid #2a2d3a', borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: themeColors.accent }}>{icon === '🔥' ? '🔥' : ''}</div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', color: '#fff', letterSpacing: '1px' }}>{title}</div>
                    {description && <div style={{ fontSize: '10px', color: themeColors.textMuted, marginTop: '2px', lineHeight: '1.2' }}>{description}</div>}
                </div>
            </div>
            {score !== undefined && (
                <div style={{ fontSize: '20px', fontWeight: '900', color: score >= 80 ? themeColors.win : (score >= 50 ? '#fbbf24' : '#fff'), whiteSpace: 'nowrap' }}>
                    {score}
                    <span style={{ fontSize: '10px', color: themeColors.textMuted, fontWeight: 'normal', marginLeft: '2px' }}>/100</span>
                </div>
            )}
        </div>
        <div style={{ flex: 1 }}>
            {children}
        </div>
    </div>
);

const StatRow = ({ label, value, unit = '', maxForBar = 0, highlight = false, color }: { label: string, value: string | number, unit?: string, maxForBar?: number, highlight?: boolean, color?: string }) => {
    const numValue = parseFloat(String(value));
    return (
        <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: themeColors.textMuted, fontWeight: '500' }}>{label}</span>
                <span style={{ fontSize: '15px', fontWeight: highlight ? '800' : '600', color: highlight ? (color || '#fff') : '#e0e0e0', letterSpacing: '0.5px' }}>{value}{unit}</span>
            </div>
            {maxForBar > 0 && <ProgressBar value={numValue} max={maxForBar} color={color} />}
        </div>
    );
};

export const MatchOverview: React.FC<Props> = ({ players, roundsCount, finalScoreCT, finalScoreT }) => {

    // --- METRICS CALCULATION ---

    // 1. INTENSITY (Напряженность)
    // Based on score difference and closeness of rounds
    const intensityScore = useMemo(() => {
        const scoreDiff = Math.abs(finalScoreCT - finalScoreT);
        let baseScore = 100 - (scoreDiff * 4); // 0 diff = 100, 13-0 (13 diff) = 48
        if (baseScore < 0) baseScore = 0;

        // Bonus for clutches (tense moments)
        const totalClutches = players.reduce((sum, p) => sum + (p.clutches_1v1 || 0) + (p.clutches_1v2 || 0) + (p.clutches_1v3 || 0), 0);
        const clutchBonus = Math.min(20, totalClutches * 2);

        // Bonus for overtime
        const otBonus = roundsCount > 24 ? 10 : 0;

        return Math.min(100, Math.round(baseScore + clutchBonus + otBonus));
    }, [finalScoreCT, finalScoreT, players, roundsCount]);

    // 2. SKILL LEVEL (Скилл)
    // Based on HS%, ADR, Multikills
    const skillScore = useMemo(() => {
        const avgHS = players.reduce((sum, p) => sum + (p.hs_percent || 0), 0) / Math.max(1, players.length);
        const avgADR = players.reduce((sum, p) => sum + p.adr, 0) / Math.max(1, players.length);
        const totalMultikills = players.reduce((sum, p) => sum + (p.k3 || 0) + (p.k4 || 0) + (p.k5 || 0), 0);

        const hsScore = Math.min(40, avgHS * 0.8);
        const adrScore = Math.min(40, avgADR * 0.5);
        const multiBonus = Math.min(20, totalMultikills * 2);

        return Math.min(100, Math.round(hsScore + adrScore + multiBonus));
    }, [players]);

    // 3. UTILITY (Гранаты)
    const utilScore = useMemo(() => {
        const totalUtilDmg = players.reduce((sum, p) => sum + (p.util_dmg || 0), 0);
        const totalFlashAssists = players.reduce((sum, p) => sum + (p.flash_assists || 0), 0);

        const dmgScore = Math.min(70, (totalUtilDmg / roundsCount) * 2); // 35 avg team util dmg per round = 70 pts
        const flashScore = Math.min(30, totalFlashAssists * 4);

        return Math.min(100, Math.round(dmgScore + flashScore));
    }, [players, roundsCount]);

    // 4. TACTICS (Тактика)
    // Trade kills %, Entries
    const tacticsScore = useMemo(() => {
        const totalKills = players.reduce((sum, p) => sum + p.kills, 0);
        const totalTrades = players.reduce((sum, p) => sum + (p.trade_kills || 0), 0);
        const tradePct = totalKills > 0 ? (totalTrades / totalKills) : 0;

        // Trade %: 20% is decent
        const tradeScore = Math.min(60, tradePct * 300); // 0.2 * 300 = 60

        // Plants/Defuses
        const objectives = players.reduce((sum, p) => sum + (p.plants || 0) + (p.defuses || 0), 0);
        const objScore = Math.min(40, (objectives / roundsCount) * 100);

        return Math.min(100, Math.round(tradeScore + objScore));
    }, [players, roundsCount]);

    return (
        <div className="fade-in" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>

                {/* INTENSITY */}
                <StatCard title="Напряженность" icon="🔥" score={intensityScore} description="Близость счета и клатчи">
                    <StatRow label="Разница в счете" value={Math.abs(finalScoreCT - finalScoreT)} color={intensityScore > 70 ? themeColors.accent : '#fff'} />
                    <StatRow label="Раундов всего" value={roundsCount} maxForBar={30} />
                </StatCard>

                {/* SKILL */}
                <StatCard title="Скилл" icon="" score={skillScore} description="Стрельба и мульти-киллы">
                    <StatRow label="Средний HS%" value={(players.reduce((s, p) => s + (p.hs_percent || 0), 0) / players.length).toFixed(1)} unit="%" maxForBar={60} color="#fbbf24" highlight />
                    <StatRow label="Ср. ADR" value={(players.reduce((s, p) => s + p.adr, 0) / players.length).toFixed(1)} maxForBar={100} />
                </StatCard>

                {/* TACTICS */}
                <StatCard title="Тактика" icon="" score={tacticsScore} description="Размены и бомба">
                    <StatRow label="Trade Kills %" value={players.reduce((sum, p) => sum + p.kills, 0) > 0 ? ((players.reduce((sum, p) => sum + (p.trade_kills || 0), 0) / players.reduce((sum, p) => sum + p.kills, 0)) * 100).toFixed(1) : "0"} unit="%" maxForBar={30} color="#a78bfa" highlight />
                    <StatRow label="Bomb Plants/Defuses" value={players.reduce((s, p) => s + (p.plants || 0) + (p.defuses || 0), 0)} maxForBar={roundsCount} />
                </StatCard>

                {/* UTILITY */}
                <StatCard title="Гранаты" icon="" score={utilScore} description="Урон и флешки">
                    <StatRow label="Общий Util Dmg" value={players.reduce((s, p) => s + (p.util_dmg || 0), 0)} maxForBar={2000} color="#f87171" highlight />
                    <StatRow label="Flash Assists" value={players.reduce((s, p) => s + (p.flash_assists || 0), 0)} maxForBar={10} />
                </StatCard>

            </div>
        </div>
    );
};
