import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { themeColors, getMapGradient, formatMatchDate, getRatingColor } from '../utils';
import type { DemoResponse, PlayerStat } from '../types';
import { MatchEditModal } from '../components/MatchEditModal';
import { useAppStore } from '../store';

export const MatchesView: React.FC = () => {
    const { matches, aliases, merges, isAdmin, ratingVer, setMatches } = useAppStore();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'map' | 'score', dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
    const [editingMatch, setEditingMatch] = useState<DemoResponse | null>(null);
    const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedMatches);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedMatches(next);
    };

    const onSelectBody = (id: string) => navigate(`/matches/${id}`);

    const onDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!isAdmin) return;
        if (confirm('Удалить матч?')) {
            try {
                await deleteDoc(doc(db, 'matches', id));
                setMatches(matches.filter(m => m.id !== id));
            } catch (err) {
                console.error("Error deleting match:", err);
                alert("Ошибка при удалении");
            }
        }
    };

    const onEdit = (match: DemoResponse) => {
        setEditingMatch(match);
    };

    // 🔥 Calculate historical ratings
    const historicalRatings = useMemo(() => {
        const ratings: Record<string, Record<string, string>> = {};
        const playerStats: Record<string, { ratingSum: number, maps: number }> = {};

        // Sort matches by date ascending to calculate history
        const sorted = [...matches].sort((a, b) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime());

        sorted.forEach(m => {
            ratings[m.id] = {};

            // Snapshot current ratings for this match
            m.players.forEach(p => {
                let pid = String(p.steamid || p.name);
                if (merges[pid]) pid = merges[pid]; // Resolve merge

                if (playerStats[pid] && playerStats[pid].maps > 0) {
                    ratings[m.id][pid] = (playerStats[pid].ratingSum / playerStats[pid].maps).toFixed(2);
                } else {
                    ratings[m.id][pid] = "-";
                }
            });

            // Update stats AFTER the match
            m.players.forEach(p => {
                let pid = String(p.steamid || p.name);
                if (merges[pid]) pid = merges[pid]; // Resolve merge

                if (!playerStats[pid]) playerStats[pid] = { ratingSum: 0, maps: 0 };

                const r = ratingVer === '3.0' ? (p.rating_3 || p.rating) : p.rating;
                playerStats[pid].ratingSum += r;
                playerStats[pid].maps++;
            });
        });

        return ratings;
    }, [matches, merges, ratingVer]);

    const handleSort = (key: 'date' | 'map' | 'score') => {
        setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
    };

    const filteredMatches = matches.filter(m =>
        m.map.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.upload_date.includes(searchTerm)
    );

    const sortedMatches = [...filteredMatches].sort((a, b) => {
        let res = 0;
        if (sortConfig.key === 'date') res = new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime();
        if (sortConfig.key === 'map') res = a.map.localeCompare(b.map);
        if (sortConfig.key === 'score') res = (b.final_score_t + b.final_score_ct) - (a.final_score_t + a.final_score_ct);
        return sortConfig.dir === 'asc' ? -res : res;
    });

    const getHistRating = (matchId: string, pid: string): string => {
        let resolvedId = pid;
        if (merges[resolvedId]) resolvedId = merges[resolvedId];

        if (historicalRatings[matchId] && historicalRatings[matchId][resolvedId]) {
            return historicalRatings[matchId][resolvedId];
        }
        return "-";
    };

    const getTeamAvg = (matchId: string, team: PlayerStat[]) => {
        let sum = 0;
        let count = 0;
        team.forEach(p => {
            const r = getHistRating(matchId, p.steamid || p.name);
            if (r !== "-") {
                sum += parseFloat(r);
                count++;
            }
        });
        return count > 0 ? (sum / count).toFixed(2) : "-";
    };

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 5px 0' }}>История Матчей</h2>
                    <p style={{ margin: 0, color: themeColors.textMuted, fontSize: '14px' }}>Отображается исторический рейтинг (на момент начала матча)</p>
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Поиск..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            background: themeColors.bg,
                            border: `1px solid ${themeColors.border}`,
                            color: themeColors.text,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            outline: 'none',
                            fontSize: '12px',
                            width: '150px'
                        }}
                    />

                    <div style={{ display: 'flex', gap: '8px', background: themeColors.bg, padding: '4px', borderRadius: '8px', border: `1px solid ${themeColors.border}` }}>
                        {(['map', 'score', 'date'] as const).map(k => (
                            <button
                                key={k}
                                onClick={() => handleSort(k)}
                                style={{
                                    background: sortConfig.key === k ? themeColors.accent : 'transparent',
                                    border: 'none',
                                    color: sortConfig.key === k ? '#fff' : themeColors.textMuted,
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    transition: '0.2s'
                                }}
                            >
                                {k}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="stats-grid stagger-container" style={{ gridTemplateColumns: '1fr', gap: '20px' }}>
                {sortedMatches.map((m, index: number) => {
                    const teamCT = m.players.filter((p: PlayerStat) => p.team === 'CT');
                    const teamT = m.players.filter((p: PlayerStat) => p.team === 'T');
                    const isExpanded = expandedMatches.has(m.id);

                    const avgCT = getTeamAvg(m.id, teamCT);
                    const avgT = getTeamAvg(m.id, teamT);
                    const dateStr = formatMatchDate(m.filename, m.upload_date).split('|')[0];

                    if (!isExpanded) {
                        return (
                            <div key={m.id} onClick={(e) => toggleExpand(m.id, e)} className={`glass btn-hover match-card-strip stagger-item stagger-${Math.min((index % 10) + 1, 10)}`} style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 24px',
                                gap: '30px',
                                borderRadius: '16px',
                                transition: 'var(--transition-quick)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: '4px', height: '100%', position: 'absolute', left: 0, top: 0,
                                    background: getMapGradient(m.map)
                                }} />

                                {/* Map */}
                                <div style={{ width: '120px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        background: getMapGradient(m.map), display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <span style={{ fontSize: '10px', fontWeight: '900', color: '#fff' }}>{m.map.substring(3, 5).toUpperCase()}</span>
                                    </div>
                                    <span style={{ fontWeight: '800', fontSize: '14px', whiteSpace: 'nowrap' }}>{m.map.replace('de_', '').toUpperCase()}</span>
                                </div>

                                {/* AVG */}
                                <div style={{ flex: 1, display: 'flex', gap: '20px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: '800', color: themeColors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>CT SQUAD</span>
                                        <span style={{ fontSize: '14px', fontWeight: '900', color: themeColors.ct }}>{avgCT} <span style={{ fontSize: '10px', opacity: 0.5, color: '#fff' }}>AVG</span></span>
                                    </div>
                                    <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '9px', fontWeight: '800', color: themeColors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>T SQUAD</span>
                                        <span style={{ fontSize: '14px', fontWeight: '900', color: themeColors.t }}>{avgT} <span style={{ fontSize: '10px', opacity: 0.5, color: '#fff' }}>AVG</span></span>
                                    </div>
                                </div>

                                {/* Score */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                                    <span style={{ fontSize: '18px', fontWeight: '900', color: themeColors.ct }}>{m.final_score_ct}</span>
                                    <span style={{ opacity: 0.2, fontWeight: '900' }}>:</span>
                                    <span style={{ fontSize: '18px', fontWeight: '900', color: themeColors.t }}>{m.final_score_t}</span>
                                </div>

                                {/* Date */}
                                <div style={{ width: '100px', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#fff', opacity: 0.9 }}>{dateStr}</span>
                                    <span style={{ fontSize: '9px', fontWeight: '700', color: themeColors.textMuted, textTransform: 'uppercase' }}>DATE</span>
                                </div>

                                {/* Expand Icon (Chevrons etc removed for minimalism as per user style) */}
                                <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                                    <div style={{ width: '6px', height: '6px', borderRight: '2px solid #fff', borderBottom: '2px solid #fff', transform: 'rotate(45deg)' }} />
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={m.id} className={`glass match-card expanded stagger-item stagger-${Math.min((index % 10) + 1, 10)}`} style={{
                            display: 'flex',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                            transition: 'var(--transition-smooth)',
                            position: 'relative',
                            border: `1px solid ${themeColors.accent}30`,
                            overflow: 'hidden'
                        }}>
                            {/* Collapse Trigger at the top */}
                            <div onClick={(e) => toggleExpand(m.id, e)} style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: '40px',
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 20px',
                                cursor: 'pointer', zIndex: 10, background: 'linear-gradient(to bottom, rgba(255,255,255,0.03), transparent)'
                            }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: themeColors.accent, letterSpacing: '1px' }}>COLLAPSE</span>
                            </div>

                            {/* ЛЕВАЯ ЧАСТЬ: КАРТА И ДАТА */}
                            <div className="match-card-header" onClick={() => onSelectBody(m.id)} style={{
                                width: '160px',
                                background: 'rgba(255,255,255,0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '24px',
                                borderRight: `1px solid ${themeColors.border}`,
                                cursor: 'pointer'
                            }}>
                                <div style={{
                                    width: '70px',
                                    height: '70px',
                                    borderRadius: '18px',
                                    background: getMapGradient(m.map),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '15px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1 }}>
                                        {m.map.substring(3, 5).toUpperCase()}
                                    </span>
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: '900', fontSize: '15px', color: '#fff' }}>
                                            {m.map.replace('de_', '').toUpperCase()}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '11px', color: themeColors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {dateStr}
                                    </span>
                                </div>
                            </div>

                            {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ: СОСТАВЫ И СЧЕТ */}
                            <div onClick={() => onSelectBody(m.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '10px', cursor: 'pointer', paddingTop: '45px' }}>

                                {/* ТИМ CT */}
                                <div style={{ flex: 1, padding: '15px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: `1px solid rgba(255,255,255,0.05)`, paddingBottom: '8px' }}>
                                        <span style={{ color: themeColors.ct, fontWeight: '900', fontSize: '11px', letterSpacing: '1px' }}>CT SQUAD</span>
                                        <span style={{ color: themeColors.textMuted, fontSize: '10px', fontWeight: '800' }}>AVG: <span style={{ color: '#fff' }}>{avgCT}</span></span>
                                    </div>
                                    <div style={{ display: 'grid', gap: '6px' }}>
                                        {teamCT.map((p: PlayerStat) => {
                                            const r = getHistRating(m.id, p.steamid || p.name);
                                            const displayName = (aliases && p.steamid && aliases[p.steamid]) ? aliases[p.steamid] : p.name;
                                            return (
                                                <div key={p.steamid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                                    <span style={{ color: '#fff', fontWeight: '500', opacity: 0.8 }}>{displayName}</span>
                                                    <span style={{ fontWeight: '800', color: r === "-" ? themeColors.textMuted : getRatingColor(parseFloat(r)) }}>{r}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* СЧЕТ */}
                                <div style={{ width: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', height: '100%', borderRadius: '12px' }}>
                                    <span style={{ fontSize: '32px', fontWeight: '900', color: themeColors.ct }}>{m.final_score_ct}</span>
                                    <div style={{ height: '2px', width: '20px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                                    <span style={{ fontSize: '32px', fontWeight: '900', color: themeColors.t }}>{m.final_score_t}</span>
                                </div>

                                {/* ТИМ T */}
                                <div style={{ flex: 1, padding: '15px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: `1px solid rgba(255,255,255,0.05)`, paddingBottom: '8px' }}>
                                        <span style={{ color: themeColors.t, fontWeight: '900', fontSize: '11px', letterSpacing: '1px' }}>T SQUAD</span>
                                        <span style={{ color: themeColors.textMuted, fontSize: '10px', fontWeight: '800' }}>AVG: <span style={{ color: '#fff' }}>{avgT}</span></span>
                                    </div>
                                    <div style={{ display: 'grid', gap: '6px' }}>
                                        {teamT.map((p: PlayerStat) => {
                                            const r = getHistRating(m.id, p.steamid || p.name);
                                            const displayName = (aliases && p.steamid && aliases[p.steamid]) ? aliases[p.steamid] : p.name;
                                            return (
                                                <div key={p.steamid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                                    <span style={{ color: '#fff', fontWeight: '500', opacity: 0.8 }}>{displayName}</span>
                                                    <span style={{ fontWeight: '800', color: r === "-" ? themeColors.textMuted : getRatingColor(parseFloat(r)) }}>{r}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* АДМИН ПАНЕЛЬ */}
                            {isAdmin && (
                                <div className="admin-actions-col" onClick={(e) => e.stopPropagation()} style={{
                                    width: '70px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '15px',
                                    background: 'rgba(0,0,0,0.3)',
                                    borderLeft: `1px solid ${themeColors.border}`,
                                    paddingTop: '30px'
                                }}>
                                    <div onClick={() => onEdit(m)} className="btn-hover" style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>EDIT</div>
                                    <div onClick={(e) => onDelete(e, m.id)} className="btn-hover" style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>DEL</div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {editingMatch && (
                <MatchEditModal
                    match={editingMatch}
                    onClose={() => setEditingMatch(null)}
                    onSave={async (updated) => {
                        try {
                            await updateDoc(doc(db, 'matches', updated.id), {
                                map: updated.map,
                                final_score_ct: updated.final_score_ct,
                                final_score_t: updated.final_score_t,
                                upload_date: updated.upload_date
                            });

                            const newMatches = matches.map(m => m.id === updated.id ? updated : m);
                            setMatches(newMatches);
                            setEditingMatch(null);
                        } catch (e) {
                            console.error("Error updating match:", e);
                            alert("Ошибка сохранения");
                        }
                    }}
                />
            )}
        </div>
    );
};

