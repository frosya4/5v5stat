import React, { useState, useMemo } from 'react';
import { themeColors, getRatingColor } from '../utils';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';

interface PlayerPoolItem {
    id: string;
    name: string;
    recentRating: number;
    matchesPlayed: number;
    lastPlayed: number;
    isInactive: boolean;
}

export const TeamBuilderView: React.FC = () => {
    const { matches, aliases, merges } = useAppStore();
    const navigate = useNavigate();
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [teams, setTeams] = useState<{ teamA: PlayerPoolItem[], teamB: PlayerPoolItem[] } | null>(null);

    // Use a stable 'now' for the lifetime of the component to keep memo pure
    const [now] = useState(() => Date.now());

    // 1. Подготовка списка
    const playerPool = useMemo(() => {
        const tempPlayers: Record<string, { name: string, history: { date: number, rating: number }[] }> = {};

        matches.forEach(m => {
            const mDate = new Date(m.upload_date).getTime();
            m.players.forEach(p => {
                let pid = p.steamid || p.name;

                // 🔥 RESOLVE MERGE
                if (merges && merges[pid]) {
                    pid = merges[pid];
                }

                if (!tempPlayers[pid]) tempPlayers[pid] = { name: p.name, history: [] };
                if (aliases[pid]) tempPlayers[pid].name = aliases[pid]; else tempPlayers[pid].name = p.name;
                tempPlayers[pid].history.push({ date: mDate, rating: p.rating });
            });
        });

        const result: PlayerPoolItem[] = Object.entries(tempPlayers).map(([id, data]) => {
            const sortedHistory = data.history.sort((a, b) => b.date - a.date);
            const last5 = sortedHistory.slice(0, 5);
            const sum = last5.reduce((acc, curr) => acc + curr.rating, 0);
            const avg = last5.length > 0 ? sum / last5.length : 0;
            const lastPlayed = sortedHistory[0]?.date || 0;
            return {
                id, name: data.name, recentRating: parseFloat(avg.toFixed(2)),
                matchesPlayed: sortedHistory.length, lastPlayed,
                isInactive: (now - lastPlayed) > (30 * 24 * 60 * 60 * 1000)
            };
        });
        return result.sort((a, b) => b.lastPlayed - a.lastPlayed);
    }, [matches, aliases, merges, now]);

    // Хендлеры
    const togglePlayer = (id: string) => {
        if (selectedPlayers.includes(id)) setSelectedPlayers(prev => prev.filter(p => p !== id));
        else { if (selectedPlayers.length >= 10) return; setSelectedPlayers(prev => [...prev, id]); }
    };

    const generateTeams = () => {
        if (selectedPlayers.length < 2) return;
        const pool = selectedPlayers.map(id => playerPool.find(p => p.id === id)!).sort((a, b) => b.recentRating - a.recentRating);
        const teamA: PlayerPoolItem[] = []; const teamB: PlayerPoolItem[] = [];
        let sumA = 0; let sumB = 0;
        pool.forEach(player => {
            if (sumA <= sumB) { teamA.push(player); sumA += player.recentRating; }
            else { teamB.push(player); sumB += player.recentRating; }
        });
        setTeams({ teamA, teamB });
    };

    const movePlayer = (player: PlayerPoolItem, toTeam: 'A' | 'B') => {
        if (!teams) return;
        if (toTeam === 'A') {
            setTeams({ teamA: [...teams.teamA, player].sort((a, b) => b.recentRating - a.recentRating), teamB: teams.teamB.filter(p => p.id !== player.id).sort((a, b) => b.recentRating - a.recentRating) });
        } else {
            setTeams({ teamA: teams.teamA.filter(p => p.id !== player.id).sort((a, b) => b.recentRating - a.recentRating), teamB: [...teams.teamB, player].sort((a, b) => b.recentRating - a.recentRating) });
        }
    };

    const getTeamAvg = (team: PlayerPoolItem[]) => team.length === 0 ? 0 : team.reduce((acc, p) => acc + p.recentRating, 0) / team.length;
    const avgA = teams ? getTeamAvg(teams.teamA) : 0;
    const avgB = teams ? getTeamAvg(teams.teamB) : 0;
    const diff = Math.abs(avgA - avgB).toFixed(2);
    const isBalanced = parseFloat(diff) < 0.1;

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh' }}>
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 5px 0' }}>Team Builder</h2>
                <p style={{ margin: 0, fontSize: '13px', color: themeColors.textMuted }}>
                    Актуальная форма (Last 5 maps). Выбрано: <span style={{ color: selectedPlayers.length === 10 ? themeColors.win : '#fff', fontWeight: 'bold' }}>{selectedPlayers.length}/10</span>
                </p>
            </div>

            {/* 🔥 ГИБКИЙ КОНТЕЙНЕР (FLEX WRAP) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', flex: 1 }}>

                {/* ЛЕВАЯ КОЛОНКА (ПУЛ) */}
                <div className="glass" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${themeColors.border}`, minHeight: '400px', maxHeight: '80vh' }}>
                    <div style={{ padding: '12px', borderBottom: `1px solid ${themeColors.border}`, background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: themeColors.textMuted }}>ПУЛ ИГРОКОВ</span>
                        {selectedPlayers.length > 0 && <button onClick={() => setSelectedPlayers([])} style={{ background: 'transparent', border: 'none', color: themeColors.loss, cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>СБРОС</button>}
                    </div>

                    <div className="mobile-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                        {playerPool.map(player => {
                            const isSelected = selectedPlayers.includes(player.id);
                            return (
                                <div key={player.id} onClick={() => togglePlayer(player.id)} className="row-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', marginBottom: '4px', borderRadius: '6px', background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent', border: isSelected ? `1px solid ${themeColors.accent}` : '1px solid transparent', cursor: 'pointer', opacity: (!isSelected && player.isInactive) ? 0.5 : 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSelected ? themeColors.accent : (player.isInactive ? '#444' : '#666') }} />
                                        <span onClick={(e) => { e.stopPropagation(); navigate(`/player/${player.id}`); }} className="link-hover" style={{ fontWeight: isSelected ? '700' : '500', fontSize: '13px', color: isSelected ? '#fff' : '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.name}</span>
                                    </div>
                                    <div style={{ fontWeight: '700', fontSize: '12px', color: getRatingColor(player.recentRating), minWidth: '35px', textAlign: 'right' }}>{player.recentRating.toFixed(2)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА (БИЛДЕР) */}
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
                    {!teams ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px dashed ${themeColors.border}`, borderRadius: '16px', color: themeColors.textMuted, padding: '20px', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: '900', color: themeColors.accent, marginBottom: '20px', opacity: 0.3 }}>BUILD</div>
                            <div style={{ fontSize: '16px' }}>Выберите игроков<br />и нажмите кнопку ниже</div>
                        </div>
                    ) : (
                        <div className="fade-in" style={{ flex: 1, display: 'flex', gap: '10px', flexDirection: 'column' }}> {/* На мобильном команды друг под другом */}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <div className="glass" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${themeColors.ct}40` }}>
                                    <div style={{ padding: '15px', background: `linear-gradient(to bottom, ${themeColors.ct}20, transparent)`, borderBottom: `1px solid ${themeColors.border}`, textAlign: 'center' }}>
                                        <div style={{ fontWeight: '900', fontSize: '18px', color: themeColors.ct }}>TEAM A</div>
                                        <div style={{ fontSize: '11px', color: themeColors.textMuted }}>AVG: <span style={{ color: '#fff', fontWeight: 'bold' }}>{avgA.toFixed(2)}</span></div>
                                    </div>
                                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {teams.teamA.map(p => (
                                            <div key={p.id} className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: `1px solid rgba(255,255,255,0.05)` }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                    <span onClick={(e) => { e.stopPropagation(); navigate(`/player/${p.id}`); }} className="link-hover" style={{ fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                                    <span style={{ fontSize: '10px', color: getRatingColor(p.recentRating), fontWeight: 'bold' }}>{p.recentRating.toFixed(2)}</span>
                                                </div>
                                                <button onClick={() => movePlayer(p, 'B')} className="btn-hover" style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: themeColors.textMuted, cursor: 'pointer' }}>→</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="glass" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${themeColors.t}40` }}>
                                    <div style={{ padding: '15px', background: `linear-gradient(to bottom, ${themeColors.t}20, transparent)`, borderBottom: `1px solid ${themeColors.border}`, textAlign: 'center' }}>
                                        <div style={{ fontWeight: '900', fontSize: '18px', color: themeColors.t }}>TEAM B</div>
                                        <div style={{ fontSize: '11px', color: themeColors.textMuted }}>AVG: <span style={{ color: '#fff', fontWeight: 'bold' }}>{avgB.toFixed(2)}</span></div>
                                    </div>
                                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {teams.teamB.map(p => (
                                            <div key={p.id} className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: `1px solid rgba(255,255,255,0.05)` }}>
                                                <button onClick={() => movePlayer(p, 'A')} className="btn-hover" style={{ width: '24px', height: '24px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: themeColors.textMuted, cursor: 'pointer' }}>←</button>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', overflow: 'hidden' }}>
                                                    <span onClick={(e) => { e.stopPropagation(); navigate(`/player/${p.id}`); }} className="link-hover" style={{ fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                                    <span style={{ fontSize: '10px', color: getRatingColor(p.recentRating), fontWeight: 'bold' }}>{p.recentRating.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', marginTop: 'auto' }}>
                                <div style={{ fontSize: '10px', color: themeColors.textMuted, textTransform: 'uppercase' }}>Difference</div>
                                <div style={{ fontWeight: 'bold', fontSize: '16px', color: isBalanced ? themeColors.win : themeColors.loss }}>{diff}</div>
                            </div>
                        </div>
                    )}

                    <button onClick={generateTeams} disabled={selectedPlayers.length < 2} className="btn-hover" style={{ marginTop: '20px', width: '100%', padding: '16px', background: selectedPlayers.length >= 2 ? themeColors.accent : 'rgba(255,255,255,0.05)', color: selectedPlayers.length >= 2 ? '#fff' : themeColors.textMuted, border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '14px', letterSpacing: '1px', cursor: selectedPlayers.length >= 2 ? 'pointer' : 'not-allowed', textTransform: 'uppercase', boxShadow: selectedPlayers.length >= 2 ? `0 4px 15px ${themeColors.accent}40` : 'none', transition: 'all 0.2s' }}>
                        {teams ? 'Shuffle' : 'Create Teams'}
                    </button>
                </div>
            </div>


        </div>
    );
};