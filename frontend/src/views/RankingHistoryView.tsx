import React, { useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useAppStore } from '../store';
import { themeColors } from '../utils';
import type { PlayerStat } from '../types';

const PLAYER_COLORS = [
    '#fbbf24', '#3b82f6', '#ef4444', '#10b981', '#a78bfa',
    '#f472b6', '#34d399', '#60a5fa', '#f87171', '#fb923c',
    '#d946ef', '#8b5cf6', '#06b6d4', '#f59e0b', '#4ade80'
];

interface PlayerCardProps {
    p: { id: string; name: string; count: number; lastRank?: number };
    isVisible: boolean;
    playerColor: string | null;
    onClick: () => void;
}

const PlayerCard = React.memo(({ p, isVisible, playerColor, onClick, onMouseEnter, onMouseLeave, isHovered, isDimmed }: PlayerCardProps & { onMouseEnter: () => void; onMouseLeave: () => void; isHovered: boolean; isDimmed: boolean }) => {
    return (
        <div
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 15px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.1s',
                background: isVisible ? (isHovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)') : 'transparent',
                border: `1px solid ${isVisible ? (playerColor || themeColors.border) : 'transparent'}`,
                opacity: isDimmed ? 0.3 : (isVisible ? 1 : 0.6),
                transform: isHovered ? 'scale(1.05)' : (isVisible ? 'scale(1.02)' : 'scale(1)'),
                zIndex: isHovered ? 10 : 1
            }}
            className="row-hover"
        >
            <div style={{
                minWidth: '12px',
                height: '12px',
                borderRadius: '50%',
                background: playerColor || '#333',
                boxShadow: isVisible ? `0 0 10px ${playerColor}88` : 'none',
                border: isVisible ? 'none' : '2px solid rgba(255,255,255,0.2)'
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '13px', fontWeight: isVisible ? '900' : 'bold', color: isVisible ? '#fff' : themeColors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.lastRank ? `#${p.lastRank} ` : ''}{p.name}
                </span>
                <span style={{ fontSize: '10px', color: themeColors.textMuted }}>{p.count} матчей</span>
            </div>
            {isVisible && (
                <div style={{ color: themeColors.accent, fontSize: '12px' }}>✓</div>
            )}
        </div>
    );
});

const CustomLabel = (props: any) => {
    const { x, y, stroke, name, index, data } = props;
    // index is the current point index, data is the array of points for this line
    if (!data || index !== data.length - 1) return null;

    return (
        <text
            x={x + 12}
            y={y}
            fill={stroke}
            fontSize={12}
            fontWeight="bold"
            dominantBaseline="middle"
            style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.8))' }}
        >
            {name}
        </text>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        // Sort payload by rank (value)
        const sortedPayload = [...payload].sort((a, b) => Number(a.value) - Number(b.value));

        return (
            <div className="glass" style={{
                backgroundColor: 'rgba(22, 24, 29, 0.95)',
                borderColor: themeColors.border,
                borderRadius: '16px',
                border: `1px solid ${themeColors.border}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                padding: '15px',
                backdropFilter: 'blur(10px)',
                minWidth: '180px',
                zIndex: 1000
            }}>
                <div style={{
                    marginBottom: '10px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    fontWeight: '900',
                    color: themeColors.accent,
                    fontSize: '14px'
                }}>
                    Матч #{label}
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '10px' }}>
                    {sortedPayload.map((entry: any, index: number) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.stroke }} />
                                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.name}
                                </span>
                            </div>
                            <span style={{ color: themeColors.accent, fontWeight: '900', fontSize: '14px' }}>#{entry.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

interface PlayerHistoryMetadata {
    ratings: number[];
    count: number;
    id: string;
    lastSeenName: string;
}

interface RankingPoint {
    matchIndex: number;
    date: string;
    matchLabel: string;
    [key: string]: number | string;
}

interface HistoryData {
    dataPoints: RankingPoint[];
    topPlayerIds: string[];
    playerDetails: Record<string, PlayerHistoryMetadata>;
}

export const RankingHistoryView: React.FC = () => {
    const { matches, aliases, merges, ratingVer } = useAppStore();
    const [minGames, setMinGames] = useState(1);
    const [visiblePlayerIds, setVisiblePlayerIds] = useState<Set<string>>(new Set());
    const [initialized, setInitialized] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

    const historyData = useMemo<HistoryData | null>(() => {
        if (!matches.length) return null;

        const sortedMatches = [...matches].sort((a, b) =>
            new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime()
        );

        const playerStats: Record<string, PlayerHistoryMetadata> = {};
        const dataPoints: RankingPoint[] = [];

        sortedMatches.forEach((m, idx) => {
            m.players.forEach((p: PlayerStat) => {
                let pid = p.steamid || p.name;
                if (merges && merges[pid]) pid = merges[pid];
                if (!playerStats[pid]) {
                    playerStats[pid] = { ratings: [], count: 0, id: pid, lastSeenName: p.name };
                }
                const rating = ratingVer === '3.0' ? (p.rating_3 || p.rating) : p.rating;
                playerStats[pid].count++;
                playerStats[pid].lastSeenName = aliases[pid] || p.name;
                playerStats[pid].ratings.push(rating);
            });

            const currentRankings = Object.entries(playerStats)
                .map(([id, stats]) => {
                    const avgRating = stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length;
                    return { id, name: stats.lastSeenName, avgRating, count: stats.count };
                })
                .filter(p => p.count >= minGames)
                .sort((a, b) => b.avgRating - a.avgRating);

            const point: RankingPoint = {
                matchIndex: idx + 1,
                date: new Date(m.upload_date).toLocaleDateString(),
                matchLabel: `${idx + 1}: ${m.map}`
            };

            currentRankings.forEach((p, rankIdx) => {
                point[p.id] = rankIdx + 1;
                point[`${p.id}_name`] = p.name;
            });
            dataPoints.push(point);
        });

        const allAvailablePlayerIds = Object.keys(playerStats).filter(pid => playerStats[pid].count >= minGames);

        // Initial setup: select ALL players by default
        if (!initialized && dataPoints.length > 0) {
            setVisiblePlayerIds(new Set(allAvailablePlayerIds));
            setInitialized(true);
        }

        // Sampling for performance if too many points
        let sampledPoints = dataPoints;
        if (dataPoints.length > 200) {
            const step = Math.ceil(dataPoints.length / 200);
            sampledPoints = dataPoints.filter((_, i) => i % step === 0 || i === dataPoints.length - 1);
        }

        return { dataPoints: sampledPoints, topPlayerIds: allAvailablePlayerIds, playerDetails: playerStats };
    }, [matches, aliases, merges, ratingVer, minGames, initialized]);

    const allPlayersInList = useMemo(() => {
        if (!historyData) return [];
        return historyData.topPlayerIds.map(pid => ({
            id: pid,
            name: historyData.playerDetails[pid].lastSeenName,
            count: historyData.playerDetails[pid].count,
            lastRank: historyData.dataPoints[historyData.dataPoints.length - 1][pid] as number
        })).sort((a, b) => (a.lastRank || 999) - (b.lastRank || 999));
    }, [historyData]);

    const filteredPlayers = useMemo(() => {
        if (!searchQuery) return allPlayersInList;
        return allPlayersInList.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allPlayersInList, searchQuery]);

    const renderedPlayers = useMemo(() => {
        if (!historyData) return [];
        // Map visible players to colors based on their index in the overall list 
        // OR just based on their visible index to keep colors distinct among current set
        return Array.from(visiblePlayerIds).map((pid, idx) => ({
            id: pid,
            name: historyData.playerDetails[pid]?.lastSeenName || pid,
            color: PLAYER_COLORS[idx % PLAYER_COLORS.length]
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [historyData, visiblePlayerIds]);

    const togglePlayer = React.useCallback((id: string) => {
        setVisiblePlayerIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = React.useCallback(() => {
        const allFilteredIds = new Set(filteredPlayers.map(p => p.id));
        setVisiblePlayerIds(prev => {
            const next = new Set(prev);
            allFilteredIds.forEach(id => next.add(id));
            return next;
        });
    }, [filteredPlayers]);

    const deselectAll = React.useCallback(() => {
        setVisiblePlayerIds(new Set());
    }, []);

    if (!historyData) return <div style={{ padding: '40px', textAlign: 'center' }}>Загрузка данных...</div>;

    const getPlayerColor = (pid: string) => {
        const index = renderedPlayers.findIndex(p => p.id === pid);
        return index !== -1 ? renderedPlayers[index].color : null;
    };

    return (
        <div className="fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '800px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px' }}>Топ за всё время</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '10px', border: `1px solid ${themeColors.border}` }}>
                        <span style={{ fontSize: '11px', color: themeColors.textMuted, fontWeight: 'bold', textTransform: 'uppercase' }}>Мин. игр:</span>
                        <select value={minGames} onChange={(e) => { setMinGames(Number(e.target.value)); setInitialized(false); }} style={{ background: 'transparent', border: 'none', color: themeColors.accent, fontWeight: '900', outline: 'none', cursor: 'pointer', fontSize: '13px' }}>
                            <option value={1}>1</option>
                            <option value={3}>3</option>
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                        </select>
                    </div>
                </div>

                <div style={{ position: 'relative', width: '300px' }}>
                    <input
                        type="text"
                        placeholder="Поиск игрока..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${themeColors.border}`, borderRadius: '10px', padding: '10px 15px', color: '#fff', outline: 'none', fontSize: '14px' }}
                    />
                </div>
            </div>

            {/* Main Chart Section */}
            <div className="glass" style={{ height: '500px', padding: '30px', borderRadius: '24px', border: `1px solid ${themeColors.border}`, position: 'relative', background: 'rgba(20, 22, 28, 0.4)', flexShrink: 0 }}>
                {historyData.dataPoints.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeColors.textMuted }}>
                        Нет данных для отображения. Сыграйте хотя бы один матч!
                    </div>
                ) : visiblePlayerIds.size === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeColors.textMuted, fontSize: '16px' }}>
                        Выберите игроков ниже, чтобы построить график
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData.dataPoints} margin={{ top: 10, right: 120, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="matchIndex"
                                stroke={themeColors.textMuted}
                                tick={{ fill: themeColors.textMuted, fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                reversed
                                domain={['dataMin - 1', 'dataMax + 1']}
                                stroke={themeColors.textMuted}
                                tick={{ fill: themeColors.textMuted, fontSize: 11, fontWeight: 'bold' }}
                                axisLine={false}
                                tickLine={false}
                                width={35}
                                tickFormatter={(val) => `#${val}`}
                            />
                            <Tooltip
                                cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '5 5' }}
                                content={<CustomTooltip />}
                                isAnimationActive={false}
                            />
                            {renderedPlayers.map((p) => {
                                const isMany = visiblePlayerIds.size > 8;
                                const isHovered = hoveredPlayerId === p.id;
                                const isAnyHovered = !!hoveredPlayerId;
                                return (
                                    <Line
                                        key={p.id}
                                        type="monotone"
                                        dataKey={p.id}
                                        name={p.name}
                                        stroke={p.color}
                                        strokeWidth={isHovered ? 5 : (isMany ? 2 : 3)}
                                        strokeOpacity={isAnyHovered && !isHovered ? 0.2 : 1}
                                        dot={false}
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                        connectNulls={true}
                                        animationDuration={isMany ? 0 : 300}
                                        isAnimationActive={!isMany}
                                        label={<CustomLabel name={p.name} />}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Bottom Player Selection Section */}
            <div className="glass" style={{ minHeight: '300px', borderRadius: '24px', border: `1px solid ${themeColors.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: `1px solid ${themeColors.border}`, background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: themeColors.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Выбрано: <span style={{ color: themeColors.accent }}>{visiblePlayerIds.size}</span> / Всего: {allPlayersInList.length}
                    </div>
                    <button
                        onClick={selectAll}
                        style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${themeColors.border}`, color: themeColors.accent, padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', transition: '0.2s', marginRight: '8px', fontWeight: 'bold' }}
                        className="btn-hover"
                    >
                        Выбрать всех
                    </button>
                    <button
                        onClick={deselectAll}
                        style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${themeColors.border}`, color: '#fff', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', transition: '0.2s' }}
                        className="btn-hover"
                    >
                        Сбросить всё
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                        {filteredPlayers.map(p => {
                            const isVisible = visiblePlayerIds.has(p.id);
                            return (
                                <PlayerCard
                                    key={p.id}
                                    p={p}
                                    isVisible={isVisible}
                                    playerColor={getPlayerColor(p.id)}
                                    onClick={() => togglePlayer(p.id)}
                                    onMouseEnter={() => isVisible && setHoveredPlayerId(p.id)}
                                    onMouseLeave={() => setHoveredPlayerId(null)}
                                    isHovered={hoveredPlayerId === p.id}
                                    isDimmed={!!hoveredPlayerId && hoveredPlayerId !== p.id}
                                />
                            );
                        })}
                    </div>
                    {filteredPlayers.length === 0 && (
                        <div style={{ textAlign: 'center', color: themeColors.textMuted, padding: '20px' }}>Никого не найдено...</div>
                    )}
                </div>
            </div>

            <div style={{ color: themeColors.textMuted, fontSize: '11px', textAlign: 'center', opacity: 0.6 }}>
                * Линия графика отображает накопленный средний рейтинг игрока в хронологическом порядке матчей.
            </div>
        </div>
    );
};
