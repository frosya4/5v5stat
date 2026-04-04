import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeColors, getRatingColor, isRainbowName, isPoopName } from '../utils';
import type { PlayerAggregated, PlayerHistoryStat } from '../types';
import { useAppStore } from '../store';

const Th = ({ k, label, title, sortKey, setSortKey, setSortDir, sortDir }: { k: string, label: string, title?: string, sortKey: string, setSortKey: (k: string) => void, setSortDir: React.Dispatch<React.SetStateAction<"asc" | "desc">>, sortDir: "asc" | "desc" }) => (
    <th onClick={() => { setSortKey(k); setSortDir(sortKey === k && sortDir === 'desc' ? 'asc' : 'desc'); }} title={title} style={{ padding: '16px', cursor: 'pointer', userSelect: 'none', color: sortKey === k ? themeColors.accent : themeColors.textMuted, whiteSpace: 'nowrap' }}>{label} {sortKey === k && (sortDir === 'asc' ? '↑' : '↓')}</th>
);

interface ColumnDef {
    id: string;
    label: string;
    title?: string;
    align?: 'center' | 'left' | 'right';
}

const ALL_COLUMNS: ColumnDef[] = [
    { id: 'maps', label: 'Карты', align: 'center' },
    { id: 'rating', label: 'Рейтинг', align: 'center' },
    { id: 'kd', label: 'K/D', align: 'center' },
    { id: 'adr', label: 'ADR', align: 'center' },
    { id: 'avg_impact', label: 'Импакт', align: 'center' },
    { id: 'avg_kast', label: 'KAST%', align: 'center' },
    { id: 'avg_enemies_flashed', label: 'ЭФ/Р', title: 'Ослеплено врагов за раунд', align: 'center' },
    { id: 'avg_flash', label: 'Фл/Р', title: 'Флеш-ассисты за раунд', align: 'center' },
    { id: 'assist_per_round', label: 'Асс/Р', title: 'Ассисты за раунд', align: 'center' },
    { id: 'saved_per_round', label: 'Разм/Р', title: 'Размены за раунд', align: 'center' },
    { id: 'awp_per_round', label: 'AWP/Р', align: 'center' },
    { id: 'kpr', label: 'KPR', align: 'center' },
    { id: 'hs_percent', label: 'HS%', align: 'center' },
    { id: 'entry_success', label: 'Энтри%', align: 'center' },
    { id: 'ud_per_round', label: 'Урон гран.', align: 'center' },
];

const DEFAULT_COLUMNS = ['maps', 'rating', 'kd', 'adr', 'avg_impact', 'hs_percent'];

export const GlobalPlayersView: React.FC = () => {
    const { matches, aliases, merges, ratingVer, triggerPoop } = useAppStore();
    const navigate = useNavigate();
    const onPlayerClick = (id: string) => navigate(`/player/${id}`);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortKey, setSortKey] = useState<string>("rating");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [gamesLimit, setGamesLimit] = useState<number | 'all'>('all');

    // Новое состояние для колонок
    const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
    const [showSettings, setShowSettings] = useState(false);

    const toggleColumn = (id: string) => {
        setVisibleColumns(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const playerList = useMemo(() => {
        const playersHistory: Record<string, { name: string, lastDate: number, stats: PlayerHistoryStat[] }> = {};

        matches.forEach((m) => {
            const mDate = new Date(m.upload_date).getTime();
            m.players.forEach((p) => {
                let pid = p.steamid || p.name;
                if (merges && merges[pid]) pid = merges[pid];

                if (!playersHistory[pid]) playersHistory[pid] = { name: p.name, lastDate: 0, stats: [] };
                if (mDate > playersHistory[pid].lastDate) {
                    playersHistory[pid].name = p.name;
                    playersHistory[pid].lastDate = mDate;
                }

                let awpKillsInMatch = 0;
                if (p.weapons) {
                    p.weapons.forEach(w => { if (w.name.toLowerCase().includes('awp')) awpKillsInMatch += w.kills; });
                }

                playersHistory[pid].stats.push({
                    date: mDate, kills: p.kills, deaths: p.deaths, assists: p.assists, hs: p.hs, damage: p.adr * m.rounds_count,
                    rounds: m.rounds_count, entry_wins: p.fk, entry_attempts: (p.fk + p.fd), util_dmg: p.util_dmg,
                    rating: ratingVer === '3.0' ? (p.rating_3 || p.rating) : p.rating,
                    kast: p.kast, impact: p.impact, trade_kills: p.trade_kills, awp_kills: awpKillsInMatch,
                    flash_assists: p.flash_assists || 0,
                    enemies_flashed_count: p.enemies_flashed_count || 0
                });
            });
        });

        return Object.entries(playersHistory).map(([id, data]) => {
            const sortedMatches = data.stats.sort((a, b) => b.date - a.date);
            const matchesToCalc = gamesLimit === 'all' ? sortedMatches : sortedMatches.slice(0, gamesLimit);

            let totalMaps = 0, rounds = 0, k = 0, d = 0, a = 0, hs = 0, dmg = 0, ew = 0, ea = 0, ud = 0, rSum = 0;
            let kastSum = 0, impactSum = 0, tradeKills = 0, totalAwpKills = 0, totalFlashAssists = 0, totalEnemiesFlashed = 0;
            let roundsWithFlashData = 0;

            matchesToCalc.forEach(s => {
                totalMaps++; rounds += s.rounds; k += s.kills; d += s.deaths; a += s.assists; hs += s.hs; dmg += s.damage;
                ew += s.entry_wins; ea += s.entry_attempts; ud += s.util_dmg; rSum += s.rating;
                kastSum += s.kast; impactSum += s.impact; tradeKills += s.trade_kills; totalAwpKills += s.awp_kills;
                totalFlashAssists += s.flash_assists;

                if (s.enemies_flashed_count !== undefined && s.enemies_flashed_count !== null) {
                    totalEnemiesFlashed += s.enemies_flashed_count;
                    roundsWithFlashData += s.rounds;
                }
            });

            const kpr = rounds > 0 ? k / rounds : 0;
            const avgRating = totalMaps > 0 ? rSum / totalMaps : 0;
            const displayName = (aliases && aliases[id]) ? aliases[id] : data.name;

            return {
                id, name: displayName, maps: totalMaps, kills: k, deaths: d, assists: a,
                adr: rounds > 0 ? Math.round(dmg / rounds) : 0, kd: d > 0 ? (k / d).toFixed(2) : k.toFixed(2),
                hs_percent: k > 0 ? Math.round((hs / k) * 100) : 0, rating: avgRating.toFixed(2), kpr: kpr.toFixed(2),
                entry_success: ea > 0 ? Math.round((ew / ea) * 100) : 0, ud_per_round: rounds > 0 ? (ud / rounds).toFixed(1) : '0',
                avg_kast: totalMaps > 0 ? (kastSum / totalMaps).toFixed(1) : '0', avg_impact: totalMaps > 0 ? (impactSum / totalMaps).toFixed(2) : '0',
                saved_per_round: rounds > 0 ? (tradeKills / rounds).toFixed(2) : '0', awp_per_round: rounds > 0 ? (totalAwpKills / rounds).toFixed(2) : '0',
                assist_per_round: rounds > 0 ? (a / rounds).toFixed(2) : '0',
                avg_flash: rounds > 0 ? (totalFlashAssists / rounds).toFixed(2) : '0',
                avg_enemies_flashed: roundsWithFlashData > 0 ? (totalEnemiesFlashed / roundsWithFlashData).toFixed(2) : '0.00'
            };
        });
    }, [matches, aliases, ratingVer, gamesLimit, merges]);

    const sorted = useMemo(() => {
        const ranked = [...playerList].sort((a, b) => {
            const key = sortKey as keyof PlayerAggregated;
            let valA: string | number = a[key] ?? 0;
            let valB: string | number = b[key] ?? 0;
            if (typeof valA === 'string' && !isNaN(parseFloat(valA))) valA = parseFloat(valA);
            if (typeof valB === 'string' && !isNaN(parseFloat(valB))) valB = parseFloat(valB);
            if (valA === valB) return 0;
            return sortDir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        }).map((p, idx) => ({ ...p, absoluteRank: idx + 1 }));

        return ranked.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [playerList, searchTerm, sortKey, sortDir]);

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>Таблица Лидеров</h2>

                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn-hover glass"
                            style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}
                            onClick={() => setShowSettings(!showSettings)}
                        >
                            <span style={{ fontSize: '18px' }}>⚙️</span> Настройки
                        </button>

                        {showSettings && (
                            <div className="glass fade-in" style={{ position: 'absolute', top: '45px', left: 0, zIndex: 100, padding: '15px', borderRadius: '12px', minWidth: '220px', background: 'rgba(15, 16, 20, 0.98)', border: `1px solid ${themeColors.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                <div style={{ fontSize: '11px', color: themeColors.textMuted, fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Видимые колонки</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {ALL_COLUMNS.map(col => (
                                        <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: visibleColumns.includes(col.id) ? '#fff' : themeColors.textMuted }}>
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns.includes(col.id)}
                                                onChange={() => toggleColumn(col.id)}
                                                style={{ accentColor: themeColors.accent }}
                                            />
                                            {col.label}
                                        </label>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setVisibleColumns(DEFAULT_COLUMNS)}
                                    style={{ marginTop: '15px', width: '100%', background: 'transparent', border: `1px solid ${themeColors.border}`, color: themeColors.textMuted, fontSize: '11px', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    Сбросить
                                </button>
                            </div>
                        )}
                        {showSettings && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowSettings(false)} />}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: themeColors.bg, padding: '5px 10px', borderRadius: '8px', border: `1px solid ${themeColors.border}` }}>
                        <span style={{ fontSize: '12px', color: themeColors.textMuted, fontWeight: 'bold' }}>ИГРЫ:</span>
                        <select value={gamesLimit} onChange={(e) => setGamesLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={{ background: themeColors.bg, border: 'none', color: '#fff', fontWeight: 'bold', outline: 'none', cursor: 'pointer', minWidth: '100px' }}>
                            <option style={{ background: '#1c1e26' }} value={3}>Последние 3</option>
                            <option style={{ background: '#1c1e26' }} value={5}>Последние 5</option>
                            <option style={{ background: '#1c1e26' }} value={10}>Последние 10</option>
                            <option style={{ background: '#1c1e26' }} value={20}>Последние 20</option>
                            <option style={{ background: '#1c1e26' }} value="all">Все время</option>
                        </select>
                    </div>
                    <input type="text" placeholder="Поиск игрока..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ background: themeColors.bg, border: `1px solid ${themeColors.border}`, color: themeColors.text, padding: '10px 16px', borderRadius: '8px', outline: 'none', width: '200px' }} />
                </div>
            </div>

            <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${themeColors.border}` }}>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.3)', color: themeColors.textMuted, fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>
                                <th style={{ padding: '16px', width: '50px' }}>#</th>
                                <Th k="name" label="Игрок" sortKey={sortKey} setSortKey={setSortKey} setSortDir={setSortDir} sortDir={sortDir} />
                                {ALL_COLUMNS.filter(c => visibleColumns.includes(c.id)).map(col => (
                                    <Th
                                        key={col.id}
                                        k={col.id}
                                        label={col.id === 'rating' ? `Рейтинг ${ratingVer}` : col.label}
                                        title={col.title}
                                        sortKey={sortKey}
                                        setSortKey={setSortKey}
                                        setSortDir={setSortDir}
                                        sortDir={sortDir}
                                    />
                                ))}
                            </tr>
                        </thead>
                        <tbody className="stagger-container">
                            {sorted.map((p, index: number) => {
                                const rank = (p as any).absoluteRank;
                                let rankDisplay: React.ReactNode = <span style={{ color: themeColors.textMuted, fontSize: '11px' }}>#{rank}</span>;
                                if (rank === 1) rankDisplay = <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>1</span>;
                                if (rank === 2) rankDisplay = <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>2</span>;
                                if (rank === 3) rankDisplay = <span style={{ color: '#b45309', fontWeight: 'bold' }}>3</span>;

                                return (
                                    <tr key={p.id} className={`row-hover stagger-item stagger-${Math.min((index % 10) + 1, 10)}`} style={{ borderBottom: `1px solid ${themeColors.border}`, height: '50px' }}>
                                        <td style={{ textAlign: 'center' }}>{rankDisplay}</td>
                                        <td
                                            onClick={() => {
                                                if (isPoopName(p.name)) triggerPoop();
                                                onPlayerClick(p.id);
                                            }}
                                            className={`link-hover ${isRainbowName(p.name) ? 'rainbow-text' : ''}`}
                                            style={{ padding: '14px', fontWeight: 'bold', textAlign: 'left', fontSize: '14px', color: isRainbowName(p.name) ? undefined : '#fff', whiteSpace: 'nowrap' }}
                                        >
                                            {p.name}
                                        </td>

                                        {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => {
                                            const val = (p as any)[col.id];
                                            const isLowSample = gamesLimit !== 'all' && p.maps < gamesLimit;
                                            const align = col.align || 'center';

                                            if (col.id === 'maps') {
                                                return <td key={col.id} style={{ padding: '14px', textAlign: align }}><span style={{ color: isLowSample ? themeColors.textMuted : '#fff', fontWeight: isLowSample ? 'normal' : 'bold' }}>{val}</span></td>;
                                            }
                                            if (col.id === 'rating') {
                                                const rNum = parseFloat(val);
                                                return <td key={col.id} style={{ padding: '14px', textAlign: align }}><div style={{ background: getRatingColor(rNum) + '20', color: getRatingColor(rNum), padding: '4px 8px', borderRadius: '6px', fontWeight: '800', display: 'inline-block', minWidth: '50px', border: `1px solid ${getRatingColor(rNum)}40` }}>{val}</div></td>;
                                            }
                                            if (col.id === 'kd') {
                                                return <td key={col.id} style={{ padding: '14px', textAlign: align, color: parseFloat(val) >= 1 ? themeColors.win : themeColors.loss, fontWeight: '600' }}>{val}</td>;
                                            }
                                            if (col.id === 'adr' || col.id === 'avg_impact') {
                                                const isImpact = col.id === 'avg_impact';
                                                return <td key={col.id} style={{ padding: '14px', textAlign: align, fontWeight: '600', color: (isImpact && parseFloat(val) >= 1) ? themeColors.win : undefined }}>{val}</td>;
                                            }

                                            // Percentage stats
                                            if (['avg_kast', 'hs_percent', 'entry_success'].includes(col.id)) {
                                                return <td key={col.id} style={{ padding: '14px', textAlign: align, color: col.id === 'avg_kast' ? '#fff' : themeColors.textMuted }}>{val}%</td>;
                                            }

                                            // Default styling for others (Ast/R, Trd/R, AWP/R, KPR, EF/R, etc)
                                            let finalColor = themeColors.textMuted;
                                            if (col.id === 'awp_per_round' && parseFloat(val) > 0.1) finalColor = themeColors.accent;

                                            return <td key={col.id} style={{ padding: '14px', textAlign: align, color: finalColor }}>{val}</td>;
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
