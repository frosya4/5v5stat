import React from 'react';
import { themeColors } from '../utils';
import type { PlayerStat, KillEvent, RoundHistory } from '../types';

interface Props {
    player: PlayerStat;
    rounds: number;
    killFeed?: KillEvent[];
    roundsHistory?: RoundHistory[];
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
                <div style={{ fontSize: '24px' }}>{icon}</div>
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

const SideBar = ({ label, val, color }: { label: string, val: number, color: string }) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
            <span style={{ color: color }}>{label}</span>
            <span>{val.toFixed(2)}</span>
        </div>
        <div style={{ height: '8px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (val / 2.0) * 100)}%`, background: color }}></div>
        </div>
    </div>
);

export const AdvancedStats: React.FC<Props> = ({ player, rounds, killFeed = [], roundsHistory = [] }) => {

    // --- 1. РАСЧЕТЫ СТАТИСТИКИ ---

    // STYLE POINTS (Calculated from Feed)
    const pName = (player.originalName || player.name || "").toLowerCase();
    const pSteamId = (player.steamid || "").toLowerCase();

    const playerKillsEvents = killFeed.filter(k => {
        const kKiller = (k.killer || "").toLowerCase();
        const kSteamId = (k.killer_steamid || k.attacker_steamid || "").toLowerCase();

        const isMatch = (pName && kKiller === pName) || (pSteamId && kSteamId === pSteamId);
        return isMatch && !k.is_bomb;
    });

    // Counters
    const wallbangs = playerKillsEvents.filter(k => k.is_wallbang).length;
    const noscopes = playerKillsEvents.filter(k => k.is_noscope).length;
    const smokeKills = playerKillsEvents.filter(k => k.is_through_smoke).length;
    const blindKills = playerKillsEvents.filter(k => k.is_blind).length;

    // Rating for Style (Arbitrary fun metric)
    const styleScore = Math.min(100, (wallbangs * 5) + (noscopes * 8) + (smokeKills * 6) + (blindKills * 10));

    // AWP
    const awpStats = player.weapons?.find(w => w.name.toLowerCase().includes('awp'));
    const awpKills = awpStats ? awpStats.kills : 0;
    const awpKpr = rounds > 0 ? (awpKills / rounds).toFixed(2) : "0.00";

    // Entry / Opening
    const attempts = player.fk + player.fd;
    const openSuccess = attempts > 0 ? ((player.fk / attempts) * 100).toFixed(1) : "0.0";
    const openAttemptsPct = rounds > 0 ? ((attempts / rounds) * 100).toFixed(1) : "0.0";

    // Utility
    const utilDmgPerRound = rounds > 0 ? (player.util_dmg / rounds).toFixed(1) : "0.0";

    // Trading
    const tradeKillsPerRound = rounds > 0 ? (player.trade_kills / rounds).toFixed(2) : "0.00";
    const tradeShare = player.kills > 0 ? ((player.trade_kills / player.kills) * 100).toFixed(1) : "0.0";

    // Clutching
    const c1 = player.clutches_1v1 || 0;
    const c2 = player.clutches_1v2 || 0;
    const c3 = player.clutches_1v3 || 0;
    const c4 = player.clutches_1v4 || 0;
    const c5 = player.clutches_1v5 || 0;
    const totalClutches = c1 + c2 + c3 + c4 + c5;
    const clutchPoints = c1 * 1 + c2 * 2 + c3 * 4 + c4 * 6 + c5 * 10;
    const clutchPointsPerRound = rounds > 0 ? (clutchPoints / rounds).toFixed(2) : "0.00";
    const clutchScore = Math.min(100, Math.round((clutchPoints / Math.max(1, rounds)) * 2000));

    // Firepower
    const kpr = rounds > 0 ? (player.kills / rounds).toFixed(2) : "0.00";

    // 🔥 ПОЛУЧАЕМ SWING ИЗ ПРОПСОВ
    const swingCount = player.round_swing_count || 0;
    const swingPct = rounds > 0 ? ((swingCount / rounds) * 100).toFixed(1) : "0.0";

    const firepowerScore = Math.min(100, Math.round((player.rating / 1.6) * 100));

    // ECONOMY ANALYSIS
    const calculateEcoStats = (side: 'T' | 'CT') => {
        if (!roundsHistory) return { ecoWin: 0, ecoTotal: 0, forceWin: 0, forceTotal: 0 };
        let ecoTotal = 0, ecoWin = 0, forceTotal = 0, forceWin = 0;

        roundsHistory.forEach(r => {
            const buyType = side === 'T' ? r.buy_type_t : r.buy_type_ct;
            const winner = r.winner_side || r.winner_team; // 'CT' or 'T'
            // Normalize winner string
            const winSide = (winner === '2' || winner === 'T' || winner === 'TERRORIST') ? 'T' : 'CT';

            const bType = buyType ? buyType.toLowerCase() : '';

            if (bType.includes('eco')) {
                ecoTotal++;
                if (winSide === side) ecoWin++;
            }
            if (bType.includes('force')) {
                forceTotal++;
                if (winSide === side) forceWin++;
            }
        });
        return { ecoWin, ecoTotal, forceWin, forceTotal };
    };

    const tEco = calculateEcoStats('T');
    const ctEco = calculateEcoStats('CT');
    const ecoScore = Math.min(100, Math.round(((tEco.forceWin + ctEco.forceWin + tEco.ecoWin + ctEco.ecoWin) / Math.max(1, tEco.forceTotal + ctEco.forceTotal + tEco.ecoTotal + ctEco.ecoTotal)) * 200));

    // Calculate Average Side Rating for Score
    const ctRating = player.ct_stats?.rating_3 || player.ct_stats?.rating || 0;
    const tRating = player.t_stats?.rating_3 || player.t_stats?.rating || 0;
    let validSides = 0;
    if (ctRating > 0) validSides++;
    if (tRating > 0) validSides++;
    const avgSideRating = validSides > 0 ? (ctRating + tRating) / validSides : 0;
    const sidePerformanceScore = Math.min(100, Math.round(avgSideRating * 60));

    return (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: '40px' }}>

            {/* HERO STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>

                {/* FIREPOWER - ОГНЕВАЯ МОЩЬ */}
                <StatCard title="Огневая мощь" icon="🔥" score={firepowerScore} description="Главный показатель эффективности стрельбы и импакта">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <StatRow label="Рейтинг 2.0" value={player.rating.toFixed(2)} maxForBar={2.0} color={themeColors.accent} highlight />
                            <StatRow label="Убийств / Раунд" value={kpr} maxForBar={1.5} />
                            <StatRow label="Урон / Раунд (ADR)" value={player.adr.toFixed(1)} maxForBar={120} />
                        </div>
                        <div>
                            <StatRow label="Импакт" value={player.impact.toFixed(2)} maxForBar={2.0} color="#fbbf24" highlight />
                            <StatRow label="Swing %" value={swingPct} unit="%" maxForBar={30} color="#10b981" />
                            <StatRow label="KAST" value={player.kast.toFixed(1)} unit="%" maxForBar={100} />
                        </div>
                    </div>
                </StatCard>

                {/* SIDE PERFORMANCE - СТОРОНЫ */}
                <StatCard title="Стороны" icon="⚖️" score={sidePerformanceScore} description="Эффективность за Т (Атаку) и CT (Защиту)">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', height: '100%' }}>
                        {player.ct_stats && <SideBar label="Рейтинг CT" val={player.ct_stats.rating_3 || player.ct_stats.rating} color={themeColors.ct} />}
                        {player.t_stats && <SideBar label="Рейтинг T" val={player.t_stats.rating_3 || player.t_stats.rating} color={themeColors.t} />}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: 'auto' }}>
                            {player.ct_stats && (
                                <div style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '10px', color: themeColors.ct, marginBottom: '2px' }}>CT ADR</div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{player.ct_stats.adr.toFixed(1)}</div>
                                </div>
                            )}
                            {player.t_stats && (
                                <div style={{ textAlign: 'center', background: 'rgba(234, 179, 8, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '10px', color: themeColors.t, marginBottom: '2px' }}>T ADR</div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{player.t_stats.adr.toFixed(1)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </StatCard>
            </div>

            {/* SECONDARY STATS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

                {/* ENTERING - ЭНТРИ */}
                <StatCard title="Энтри" icon="🚪" score={Math.round(parseFloat(openSuccess))} description="Первые дуэли в раунде">
                    <StatRow label="Успешность" value={openSuccess} unit="%" maxForBar={100} highlight color="#f87171" />
                    <StatRow label="Попыток" value={attempts} unit={` (${openAttemptsPct}%)`} maxForBar={rounds} />
                    <StatRow label="Первых убийств" value={player.fk} maxForBar={rounds * 0.2} />
                </StatCard>

                {/* CLUTCHING - КЛАТЧИ */}
                <StatCard title="Клатчи" icon="🧊" score={clutchScore} description="Ситуации 1 против X">
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: themeColors.accent }}>{totalClutches}</div>
                            <div style={{ fontSize: '9px', color: themeColors.textMuted, textTransform: 'uppercase' }}>Всего побед</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '20px', fontWeight: '800' }}>{clutchPointsPerRound}</div>
                            <div style={{ fontSize: '9px', color: themeColors.textMuted, textTransform: 'uppercase' }}>Очки / Раунд</div>
                        </div>
                    </div>
                    <StatRow label="Победы 1v2+" value={c2 + c3 + c4 + c5} highlight={(c2 + c3 + c4 + c5) > 0} color={themeColors.accent} />
                </StatCard>

                {/* TRADING - РАЗМЕН */}
                <StatCard title="Размен" icon="🔁" score={Math.min(100, Math.round(parseFloat(tradeShare) * 1.5))} description="Эффективность в командной работе">
                    <StatRow label="Доля размена" value={tradeShare} unit="%" maxForBar={30} highlight color="#a78bfa" />
                    <StatRow label="Разменов / Раунд" value={tradeKillsPerRound} maxForBar={0.3} />
                </StatCard>


                {/* UTILITY - ГРАНАТЫ */}
                <StatCard title="Гранаты" icon="💣" score={Math.min(100, Math.round(parseFloat(utilDmgPerRound) * 15))} description="Использ. утилиты">
                    <StatRow label="Урон / Раунд" value={utilDmgPerRound} maxForBar={10} highlight color="#fbbf24" />
                    <StatRow label="Флеш-ассисты" value={player.flash_assists} />
                </StatCard>

                {/* SNIPING - СНАЙПИНГ */}
                <StatCard title="Снайпинг" icon="🎯" score={Math.min(100, Math.round(parseFloat(awpKpr) * 200))} description="Игра с AWP">
                    <StatRow label="AWP Убийств" value={awpKills} highlight color="#34d399" />
                    <StatRow label="AWP KPR" value={awpKpr} maxForBar={0.8} />
                </StatCard>

                {/* STYLE - СТИЛЬ */}
                <StatCard title="Стиль" icon="🎨" score={styleScore} description="Красивые моменты">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f59e0b' }}>{wallbangs}</div>
                            <div style={{ fontSize: '9px', color: '#888' }}>ПРОСТРЕЛЫ</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ec4899' }}>{noscopes}</div>
                            <div style={{ fontSize: '9px', color: '#888' }}>БЕЗ ПРИЦЕЛА</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#6366f1' }}>{smokeKills}</div>
                            <div style={{ fontSize: '9px', color: '#888' }}>ДЫМ</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#a855f7' }}>{blindKills}</div>
                            <div style={{ fontSize: '9px', color: '#888' }}>В СЛЕПУЮ</div>
                        </div>
                    </div>

                </StatCard>

                {/* ECONOMY - ЭКОНОМИКА */}
                <StatCard title="Экономика" icon="💸" score={ecoScore} description="Эффективность Force/Eco">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: themeColors.t, fontWeight: 'bold', marginBottom: '4px' }}>T АТАКА</div>
                            <StatRow label="Эко Победы" value={tEco.ecoTotal > 0 ? ((tEco.ecoWin / tEco.ecoTotal) * 100).toFixed(0) : '0'} unit="%" highlight color={themeColors.t} />
                            <StatRow label="Форс Победы" value={tEco.forceTotal > 0 ? ((tEco.forceWin / tEco.forceTotal) * 100).toFixed(0) : '0'} unit="%" maxForBar={100} />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', color: themeColors.ct, fontWeight: 'bold', marginBottom: '4px' }}>CT ЗАЩИТА</div>
                            <StatRow label="Эко Победы" value={ctEco.ecoTotal > 0 ? ((ctEco.ecoWin / ctEco.ecoTotal) * 100).toFixed(0) : '0'} unit="%" highlight color={themeColors.ct} />
                            <StatRow label="Форс Победы" value={ctEco.forceTotal > 0 ? ((ctEco.forceWin / ctEco.forceTotal) * 100).toFixed(0) : '0'} unit="%" maxForBar={100} />
                        </div>
                    </div>
                </StatCard>

            </div >
        </div >
    );
};