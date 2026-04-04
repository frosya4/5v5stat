import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { themeColors, getRatingColor, formatMatchDate, normalizeSide, isRainbowName, isPoopName } from '../utils';
import { useAppStore } from '../store';
import { MAP_COORDINATES } from '../utils/maps';
import type { RoundHistory, EnrichedPlayer, KillEvent } from '../types';
import { AdvancedStats } from '../components/AdvancedStats';
import { RoundsTable } from '../components/RoundsTable';
import { DuelMatrix } from '../components/DuelMatrix';
import { calculateRating3 } from '../utils/rating3';
import { AIAnalyst } from '../components/AIAnalyst';
import { MapVisualizer } from '../components/MapVisualizer';
import { MatchOverview } from '../components/MatchOverview';
import { Parser3Stats } from '../components/Parser3Stats';
import { getWeaponIcon } from '../utils/weaponIcons';

// --- HELPERS ---


const DetailRow = ({ label, value, sub }: { label: string, value: string | number, sub?: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
        <span style={{ color: themeColors.textMuted }}>{label}</span>
        <div style={{ textAlign: 'right' }}>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{value}</span>
            {sub && <span style={{ fontSize: '11px', color: themeColors.textMuted, marginLeft: '6px' }}>{sub}</span>}
        </div>
    </div>
);

const TeamTable = ({ teamName, players, color, isAdmin, selectedMatch, detailPlayerId, setDetailPlayerId, aliases, triggerPoop, onDeletePlayer, navigate }: { teamName: string, players: EnrichedPlayer[], color: string, isAdmin: boolean, selectedMatch: any, detailPlayerId: string, setDetailPlayerId: (id: string) => void, aliases: Record<string, string>, triggerPoop: () => void, onDeletePlayer: (id: string) => void, navigate: (path: string) => void }) => (
    <div className="glass" style={{ borderRadius: '12px', overflow: 'hidden', border: `1px solid ${color}40`, marginBottom: '20px' }}>
        <div style={{ padding: '12px', background: `linear-gradient(90deg, ${color}20 0%, rgba(0,0,0,0) 100%)`, borderBottom: `1px solid ${color}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '900', fontSize: '16px', color: color, letterSpacing: '1px' }}>{teamName}</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{teamName === 'CT' ? (selectedMatch?.final_score_ct || 0) : (selectedMatch?.final_score_t || 0)}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '550px' }}>
                <thead>
                    <tr style={{ color: themeColors.textMuted, fontSize: '10px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Player</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>K</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>D</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>+/-</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>ADR</th>
                        <th style={{ padding: '10px', textAlign: 'center', color: '#fbbf24' }}>IMP</th>
                        <th style={{ padding: '10px', textAlign: 'center', color: '#9ca3af' }} title="Kill Weight">K/W</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>RTG 3.0</th>
                        {isAdmin && <th style={{ padding: '10px', textAlign: 'right' }}>Act</th>}
                    </tr>
                </thead>
                <tbody>
                    {players.map((p: EnrichedPlayer) => {
                        const pid = p.steamid || p.name;
                        const rating = p.rating_3_calc;
                        const impact = p.impact_3_calc;
                        const kw = p.kill_weight_calc;

                        return (
                            <tr key={pid} className="row-hover" onClick={() => setDetailPlayerId(pid)} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: pid === detailPlayerId ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                                <td style={{ padding: '10px', fontWeight: 'bold', color: isRainbowName(aliases[pid] || p.name) ? undefined : '#fff' }}>
                                    <span
                                        onClick={(e) => {
                                            const currentName = aliases[pid] || p.name;
                                            if (isPoopName(currentName)) {
                                                e.stopPropagation();
                                                triggerPoop();
                                            }
                                            navigate(`/player/${pid}`);
                                        }}
                                        className={isRainbowName(aliases[pid] || p.name) ? 'rainbow-text' : ''}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {aliases[pid] || p.name}
                                    </span>
                                    {p.hits_head !== undefined && <div style={{ fontSize: '9px', color: themeColors.textMuted, marginTop: '2px' }}>HS: {p.hits_head}</div>}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600' }}>{p.kills}</td>
                                <td style={{ padding: '10px', textAlign: 'center', color: themeColors.loss }}>{p.deaths}</td>
                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: (p.kills - p.deaths) >= 0 ? themeColors.win : themeColors.loss }}>{(p.kills - p.deaths) > 0 ? `+${p.kills - p.deaths}` : (p.kills - p.deaths)}</td>
                                <td style={{ padding: '10px', textAlign: 'center' }}>{p.adr.toFixed(0)}</td>
                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: impact >= 1.2 ? '#fbbf24' : '#fff' }}>{impact.toFixed(2)}</td>
                                <td style={{ padding: '10px', textAlign: 'center', color: kw >= 1.05 ? '#4ade80' : (kw <= 0.95 ? '#f87171' : themeColors.textMuted) }}>{kw}x</td>
                                <td style={{ padding: '10px', textAlign: 'right' }}><span style={{ color: getRatingColor(rating), fontWeight: '800', fontSize: '14px' }}>{rating.toFixed(2)}</span></td>
                                {isAdmin && (
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        <button onClick={(e) => { e.stopPropagation(); onDeletePlayer(pid); }} style={{ border: 'none', background: 'transparent', color: themeColors.loss, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

const GameEvent = ({ event, aliases, navigate }: { event: any, aliases: Record<string, string>, navigate: (p: string) => void }) => {
    const kName = event.killer || event.attacker_name || event.attacker || "World";
    const vName = event.victim || event.victim_name || "Unknown";
    const kSide = normalizeSide(event.killer_team || event.attacker_team);
    const vSide = normalizeSide(event.victim_team || event.team);
    const weapon = event.weapon ? event.weapon.replace('weapon_', '').toUpperCase() : '';
    const icon = getWeaponIcon(event.weapon || '');

    const isPlant = event.weapon === 'c4_planted' || event.is_bomb_planted;

    if (isPlant) {
        return (
            <div className="log-item" style={{ border: '1px solid #fbbf24', background: 'rgba(251, 191, 36, 0.1)', marginBottom: '8px' }}>
                <span className="log-player-t" style={{ fontWeight: 'bold' }}>{aliases[kName] || kName}</span>
                <span style={{ margin: '0 8px', color: '#fff', fontSize: '11px', opacity: 0.8 }}>💣 заложил бомбу</span>
            </div>
        );
    }

    return (
        <div className={`log-item ${kSide === 'CT' ? 'log-team-ct' : (kSide === 'T' ? 'log-team-t' : '')}`}>
            <span
                className={`log-player-${kSide === 'CT' ? 'ct' : 't'}`}
                style={{ cursor: 'pointer', minWidth: '100px', textAlign: 'right' }}
                onClick={() => navigate(`/player/${aliases[kName] || kName}`)}
            >
                {aliases[kName] || kName}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', minWidth: '80px', justifyContent: 'center' }}>
                {icon ? (
                    <img src={icon} className="icon-white" style={{ height: '16px', maxWidth: '40px', objectFit: 'contain' }} alt={weapon} />
                ) : (
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '900' }}>{weapon}</span>
                )}
                {event.headshot && <span style={{ fontSize: '14px' }}>🎯</span>}
            </div>

            <span
                className={`log-player-${vSide === 'CT' ? 'ct' : 't'}`}
                style={{ cursor: 'pointer', minWidth: '100px', textAlign: 'left' }}
                onClick={() => navigate(`/player/${aliases[vName] || vName}`)}
            >
                {aliases[vName] || vName}
            </span>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const MatchAnalysisView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { matches, aliases, isAdmin, setMatches, triggerPoop } = useAppStore();

    // Find Match
    const selectedMatch = matches.find(m => m.id === id);

    // Tabs logic
    const [activeTab, setActiveTab] = useState<'overview' | 'scoreboard' | 'advanced' | 'parser3' | 'ai'>('overview');
    const [activeSubTab, setActiveSubTab] = useState<'log' | 'players' | 'rounds' | 'duels' | 'grenades' | 'heatmaps'>('log');
    const [detailPlayerId, setDetailPlayerId] = useState<string>('');
    const [grenadeFilter, setGrenadeFilter] = useState<'all' | 'smoke' | 'flash' | 'he' | 'fire'>('all');
    const [heatmapMode, setHeatmapMode] = useState<'kills' | 'deaths'>('kills');
    const [heatmapPlayerId, setHeatmapPlayerId] = useState<string>('all');
    const [heatmapSide, setHeatmapSide] = useState<'all' | 'CT' | 'T'>('all');
    const [heatmapWeapon, setHeatmapWeapon] = useState<'all' | 'rifle' | 'sniper' | 'pistol' | 'smg' | 'heavy'>('all');

    const [showAdminActions, setShowAdminActions] = useState(false);

    // Initialize detailPlayerId when match loads
    useEffect(() => {
        if (selectedMatch && !detailPlayerId) {
            setDetailPlayerId(selectedMatch.players[0]?.steamid || selectedMatch.players[0]?.name || '');
        }
    }, [selectedMatch, detailPlayerId]);

    // HANDLERS
    const onBack = () => navigate(-1);

    const onDeleteRound = async (roundNum: number) => {
        if (!isAdmin || !selectedMatch) return;
        if (!window.confirm(`Удалить раунд ${roundNum}?`)) return;

        try {
            const newHistory = selectedMatch.rounds_history.filter(r => r.round_num !== roundNum);
            await updateDoc(doc(db, 'matches', selectedMatch.id), { rounds_history: newHistory });

            // Update store
            setMatches(matches.map(m => m.id === selectedMatch.id ? { ...m, rounds_history: newHistory } : m));
        } catch (err) {
            console.error(err);
        }
    };

    const onDeletePlayer = async (playerId: string) => {
        if (!isAdmin || !selectedMatch) return;
        if (!window.confirm("Удалить игрока из матча?")) return;

        try {
            const newPlayers = selectedMatch.players.filter(p => (p.steamid || p.name) !== playerId);
            await updateDoc(doc(db, 'matches', selectedMatch.id), { players: newPlayers });

            // Update store
            setMatches(matches.map(m => m.id === selectedMatch.id ? { ...m, players: newPlayers } : m));
        } catch (err) {
            console.error(err);
        }
    };

    // 1. РАСЧЕТ RATING 3.0 ДЛЯ ВСЕХ ИГРОКОВ
    const enrichedPlayers = useMemo(() => {
        if (!selectedMatch) return [];
        return selectedMatch.players.map(p => {
            const clutchScore =
                (p.clutches_1v1 || 0) * 1 +
                (p.clutches_1v2 || 0) * 2 +
                (p.clutches_1v3 || 0) * 4 +
                (p.clutches_1v4 || 0) * 6 +
                (p.clutches_1v5 || 0) * 10;

            const multikills = (p.k3 || 0) + (p.k4 || 0) + (p.k5 || 0);

            const r3 = calculateRating3({
                rounds: selectedMatch.rounds_count,
                kills: p.kills,
                deaths: p.deaths,
                assists: p.assists,
                damage: p.damage || (p.adr * selectedMatch.rounds_count),
                weighted_kills: p.weighted_kills || p.kills,
                opening_kills: p.fk,
                multikills: multikills,
                awp_multikills: p.awp_multikills || 0,
                clutch_score: clutchScore,
                kast: p.kast
            });

            return {
                ...p,
                rating_3_calc: Number(r3.rating),
                impact_3_calc: Number(r3.impact),
                kill_weight_calc: Number(r3.avg_kill_weight),
                clutch_score_total: clutchScore
            };
        });
    }, [selectedMatch]);

    // 2. Разделение на команды
    const { teamCT, teamT } = useMemo(() => {
        if (!selectedMatch) return { teamCT: [], teamT: [], rounds: [] };
        const ct: EnrichedPlayer[] = [];
        const t: EnrichedPlayer[] = [];
        enrichedPlayers.forEach(p => {
            const side = normalizeSide(p.team);
            if (side === 'CT') ct.push(p); else if (side === 'T') t.push(p); else { if (ct.length < 5) ct.push(p); else t.push(p); }
        });
        return { teamCT: ct, teamT: t };
    }, [enrichedPlayers, selectedMatch]);

    // 3. Детальная статистика
    const detailStats = useMemo(() => {
        const p = enrichedPlayers.find((pl: EnrichedPlayer) => pl.steamid === detailPlayerId || pl.name === detailPlayerId);
        if (!p || !selectedMatch) return null;

        let swingCount = 0;
        let k1 = p.k1 || 0, k2 = p.k2 || 0, k3 = p.k3 || 0, k4 = p.k4 || 0, k5 = p.k5 || 0;

        const needsCalculation = (k1 + k2 + k3 + k4 + k5) === 0 && p.kills > 0;

        if (selectedMatch.rounds_history) {
            // Sides Stats Manual Calculation
            let ctK = 0, tK = 0, ctD = 0, tD = 0, ctR = 0, tR = 0;

            selectedMatch.rounds_history.forEach((round: RoundHistory) => {
                let killsInRound = 0;
                let playerSideInRound = '';
                let died = false;

                if (round.kill_feed) {
                    round.kill_feed.forEach((event: KillEvent) => {
                        const killer = event.killer || event.attacker_name || event.attacker;
                        const victim = event.victim || event.victim_name;

                        if ((killer === p.name || killer === p.steamid)) {
                            if (event.victim && killer !== event.victim) killsInRound++;
                            const rawSide = event.killer_team || event.attacker_team || event.team;
                            if (rawSide) playerSideInRound = normalizeSide(rawSide);
                        }
                        if (victim === p.name || victim === p.steamid) {
                            died = true;
                            if (!playerSideInRound) playerSideInRound = normalizeSide(event.victim_team || event.team);
                        }
                    });
                }

                if (!playerSideInRound) {
                    const startSide = normalizeSide(p.team);
                    if (round.round_num <= 12) playerSideInRound = startSide;
                    else playerSideInRound = startSide === 'CT' ? 'T' : 'CT';
                }

                if (playerSideInRound === 'CT') {
                    ctK += killsInRound; ctD += died ? 1 : 0; ctR++;
                } else if (playerSideInRound === 'T') {
                    tK += killsInRound; tD += died ? 1 : 0; tR++;
                }

                if (needsCalculation) {
                    if (killsInRound === 1) k1++; if (killsInRound === 2) k2++; if (killsInRound === 3) k3++; if (killsInRound === 4) k4++; if (killsInRound >= 5) k5++;
                }
                if (killsInRound >= 2) {
                    const winner = normalizeSide(round.winner_side || round.winner_team);
                    if (playerSideInRound && winner && playerSideInRound === winner) swingCount++;
                }
            });

            const ctRating = ctR > 0 ? (ctK / ctR) * 1.5 : 0;
            const tRating = tR > 0 ? (tK / tR) * 1.5 : 0;

            const baseSide = { assists: 0, damage: 0, fk: 0, fd: 0, adr: p.adr, impact: 1.0, kast: 75 };

            return {
                ...p,
                originalName: p.name,
                name: aliases[detailPlayerId] || p.name,
                rating: p.rating_3_calc,
                kd: p.deaths > 0 ? parseFloat((p.kills / p.deaths).toFixed(2)) : p.kills,
                k1, k2, k3, k4, k5, round_swing_count: swingCount,
                rounds_with_kills: (k1 + k2 + k3 + k4 + k5) || p.kills, rounds_with_multikills: (k2 + k3 + k4 + k5),
                kill_weight_calc: p.kill_weight_calc,
                impact_3_calc: p.impact_3_calc,
                ct_stats: p.ct_stats || { ...baseSide, rating: ctRating, rating_3: ctRating, kills: ctK, deaths: ctD, rounds: ctR },
                t_stats: p.t_stats || { ...baseSide, rating: tRating, rating_3: tRating, kills: tK, deaths: tD, rounds: tR }
            };
        }
        return null;
    }, [enrichedPlayers, detailPlayerId, aliases, selectedMatch]);

    // Aggregated Kill Feed for Style Points
    const fullKillFeed = useMemo(() => {
        return (selectedMatch && selectedMatch.rounds_history) ? selectedMatch.rounds_history.flatMap(r => r.kill_feed || []) : [];
    }, [selectedMatch]);

    // 🔥 MAP DATA POINTS
    const grenadePoints = useMemo(() => {
        if (!selectedMatch || !selectedMatch.rounds_history) return [];
        return selectedMatch.rounds_history.flatMap(r => r.grenades || [])
            .filter(g => grenadeFilter === 'all' || g.type === grenadeFilter)
            .map(g => ({
                x: g.x, y: g.y, z: g.z ?? 0, type: g.type,
                color: g.type === 'smoke' ? '#a3a3a3' : (g.type === 'flash' ? '#facc15' : (g.type === 'fire' ? '#f97316' : '#ef4444'))
            }));
    }, [selectedMatch, grenadeFilter]);

    const heatmapPoints = useMemo(() => {
        if (!selectedMatch) return [];
        let filteredFeed = fullKillFeed;

        // Filter by Side
        if (heatmapSide !== 'all') {
            filteredFeed = filteredFeed.filter(k => {
                const killerSide = normalizeSide(k.killer_team || k.attacker_team);
                const victimSide = normalizeSide(k.victim_team || k.team);
                if (heatmapMode === 'kills') return killerSide === heatmapSide;
                if (heatmapMode === 'deaths') return victimSide === heatmapSide;
                return true;
            });
        }

        // Filter by Weapon
        if (heatmapWeapon !== 'all') {
            filteredFeed = filteredFeed.filter(k => {
                if (!k.weapon) return false;
                const w = k.weapon.toLowerCase();
                if (heatmapWeapon === 'sniper') return w.includes('awp') || w.includes('ssg') || w.includes('scar') || w.includes('g3sg1');
                if (heatmapWeapon === 'rifle') return w.includes('ak47') || w.includes('m4a1') || w.includes('galil') || w.includes('famas') || w.includes('sg556') || w.includes('aug');
                if (heatmapWeapon === 'pistol') return w.includes('glock') || w.includes('usp') || w.includes('p250') || w.includes('deagle') || w.includes('cz75') || w.includes('tect9') || w.includes('berettas') || w.includes('revolver');
                if (heatmapWeapon === 'smg') return w.includes('mac10') || w.includes('mp9') || w.includes('mp7') || w.includes('ump') || w.includes('p90') || w.includes('bizon');
                if (heatmapWeapon === 'heavy') return w.includes('nova') || w.includes('xm1014') || w.includes('sawedoff') || w.includes('mag7') || w.includes('negev') || w.includes('m249');
                return true;
            });
        }

        // Filter by player if selected
        if (heatmapPlayerId !== 'all') {
            const p = selectedMatch.players.find(pl => (pl.steamid === heatmapPlayerId || pl.name === heatmapPlayerId));
            if (p) {
                filteredFeed = filteredFeed.filter(k => {
                    const killer = k.killer || k.attacker_name || k.attacker;
                    const victim = k.victim || k.victim_name;
                    const killerMatch = (killer === p.name || killer === p.steamid);
                    const victimMatch = (victim === p.name || victim === p.steamid);
                    if (heatmapMode === 'kills') return killerMatch && killer !== victim;
                    if (heatmapMode === 'deaths') return victimMatch;
                    return false;
                });
            }
        }

        const getPlayerColor = (identifier: string) => {
            const colors = [
                '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
                '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#6366f1'
            ];
            let hash = 0;
            for (let i = 0; i < identifier.length; i++) {
                hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
            }
            return colors[Math.abs(hash) % colors.length];
        };

        return filteredFeed.map(k => {
            const isKill = heatmapMode === 'kills';
            const playerId = isKill
                ? (k.killer || k.attacker_name || k.attacker)
                : (k.victim || k.victim_name);

            return {
                x: (isKill ? (k.kx ?? 0) : (k.vx ?? 0)) || 0,
                y: (isKill ? (k.ky ?? 0) : (k.vy ?? 0)) || 0,
                z: (isKill ? (k.kz ?? 0) : (k.vz ?? 0)) || 0,
                type: (isKill ? 'kill' as const : 'death' as const),
                color: heatmapPlayerId === 'all' ? getPlayerColor(playerId || 'unknown') : (isKill ? '#22c55e' : '#ef4444')
            };
        }).filter(p => p.x !== 0 && p.y !== 0);
    }, [fullKillFeed, heatmapMode, heatmapPlayerId, heatmapSide, heatmapWeapon, selectedMatch]);


    if (!selectedMatch) {
        return <div style={{ padding: '40px', textAlign: 'center', color: themeColors.textMuted }}>Матч не найден или загружается...</div>;
    }

    const normalizedMapName = selectedMatch.map.toLowerCase();
    const mapImageUrl = MAP_COORDINATES[normalizedMapName]?.imageUrl || `/5v5stat/maps/${normalizedMapName}.png`;
    const headerBackground = `linear-gradient(to right, rgba(15, 16, 20, 0.95) 0%, rgba(15, 16, 20, 0.7) 100%), url(${mapImageUrl})`;

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            {/* HEADER */}
            <div style={{ margin: '20px', padding: '30px', borderRadius: '16px', background: headerBackground, backgroundSize: 'cover', backgroundPosition: 'center', border: `1px solid ${themeColors.border}`, position: 'sticky', top: '10px', zIndex: 100, marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '1 1 auto', minWidth: '200px' }}>
                        <button onClick={onBack} className="btn-hover" style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid rgba(255,255,255,0.2)`, color: '#fff', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}>← Назад</button>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h2 style={{ fontSize: '32px', fontWeight: '900', margin: 0, textTransform: 'uppercase', textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>{selectedMatch.map.replace(/de_/i, '')}</h2>
                            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>{formatMatchDate(selectedMatch.filename, selectedMatch.upload_date)}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.6)', padding: '5px', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, overflowX: 'auto', maxWidth: '100%' }}>
                        {isAdmin && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(10px)', transition: 'var(--transition-quick)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '10px', color: '#fca5a5', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Режим админа</span>
                                    <span style={{ fontSize: '9px', color: 'rgba(252, 165, 165, 0.6)', fontWeight: 'bold' }}>{showAdminActions ? 'ВКЛ' : 'ВЫКЛ'}</span>
                                </div>
                                <div
                                    onClick={() => setShowAdminActions(!showAdminActions)}
                                    style={{ width: '40px', height: '22px', background: showAdminActions ? '#ef4444' : 'rgba(255,255,255,0.1)', borderRadius: '11px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', border: '1px solid rgba(255,255,255,0.1)' }}
                                >
                                    <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: showAdminActions ? '21px' : '2px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 5px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#000' }}>
                                        {showAdminActions ? '✔' : '✖'}
                                    </div>
                                </div>
                            </div>
                        )}
                        {['overview', 'scoreboard', 'advanced', 'parser3', 'ai'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab as typeof activeTab)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === tab ? themeColors.accent : 'transparent', color: activeTab === tab ? '#000' : '#ccc', fontWeight: 'bold', cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap', transition: 'var(--transition-quick)' }}>
                                {tab === 'overview' ? 'Обзор' : tab === 'scoreboard' ? 'Счет' : tab === 'advanced' ? 'Детали' : tab === 'parser3' ? 'Парсер 3.0' : 'ИИ Анализ'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div style={{ padding: '0 20px 40px 20px' }}>
                {activeTab === 'overview' && (
                    <MatchOverview
                        players={enrichedPlayers}
                        roundsHistory={selectedMatch.rounds_history}
                        roundsCount={selectedMatch.rounds_count}
                        finalScoreCT={selectedMatch.final_score_ct}
                        finalScoreT={selectedMatch.final_score_t}
                    />
                )}

                {activeTab === 'scoreboard' && (
                    <div className="fade-in">
                        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginTop: '10px' }}>
                            <TeamTable teamName="CT" players={teamCT} color={themeColors.ct} isAdmin={isAdmin && showAdminActions} selectedMatch={selectedMatch} detailPlayerId={detailPlayerId} setDetailPlayerId={setDetailPlayerId} aliases={aliases} triggerPoop={triggerPoop} onDeletePlayer={onDeletePlayer} navigate={navigate} />
                            <TeamTable teamName="T" players={teamT} color={themeColors.t} isAdmin={isAdmin && showAdminActions} selectedMatch={selectedMatch} detailPlayerId={detailPlayerId} setDetailPlayerId={setDetailPlayerId} aliases={aliases} triggerPoop={triggerPoop} onDeletePlayer={onDeletePlayer} navigate={navigate} />
                        </div>
                    </div>
                )}

                {activeTab === 'advanced' && (
                    <div className="fade-in">
                        {/* Sub-navigation */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {[
                                { key: 'log', label: 'Лог игры' },
                                { key: 'players', label: 'Игроки' },
                                { key: 'rounds', label: 'Раунды' },
                                { key: 'duels', label: 'Дуэли' },
                                { key: 'grenades', label: 'Гранаты' },
                                { key: 'heatmaps', label: 'Карта' }
                            ].map(sub => (
                                <button
                                    key={sub.key}
                                    onClick={() => setActiveSubTab(sub.key as any)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: activeSubTab === sub.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                                        color: activeSubTab === sub.key ? themeColors.accent : '#94a3b8',
                                        fontSize: '12px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}
                                >
                                    {sub.label}
                                </button>
                            ))}
                        </div>

                        {activeSubTab === 'log' && (
                            <div className="glass fade-in" style={{ padding: '30px', borderRadius: '16px', border: `1px solid ${themeColors.border}` }}>
                                <h3 style={{ margin: '0 0 25px 0', fontSize: '18px', fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Match Feed
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {selectedMatch.rounds_history?.map((round: RoundHistory) => (
                                        <div key={round.round_num} style={{ marginBottom: '20px', paddingLeft: '20px', borderLeft: '2px solid rgba(255,255,255,0.05)' }}>
                                            <div className="log-marker">Round {round.round_num} Started</div>
                                            {round.kill_feed?.map((event: any, idx: number) => (
                                                <GameEvent key={idx} event={event} aliases={aliases} navigate={navigate} />
                                            ))}
                                            <div className="log-marker" style={{ borderLeft: `4px solid ${normalizeSide(round.winner_side) === 'CT' ? themeColors.ct : themeColors.t}`, background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '4px' }}>
                                                Round {round.round_num} Over — Winner: <span style={{ color: normalizeSide(round.winner_side) === 'CT' ? '#60a5fa' : '#fbbf24', fontWeight: 'bold' }}>{normalizeSide(round.winner_side)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeSubTab === 'players' && detailStats && (
                            <div className="fade-in">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', background: themeColors.bg, padding: '15px', borderRadius: '12px', border: `1px solid ${themeColors.border}`, flexWrap: 'wrap', gap: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <select value={detailPlayerId} onChange={(e) => setDetailPlayerId(e.target.value)} style={{ background: '#1c1e26', color: '#fff', border: `1px solid ${themeColors.border}`, padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', outline: 'none' }}>
                                            {[...teamCT, ...teamT].map((p: EnrichedPlayer) => { const pid = p.steamid || p.name; return <option key={pid} value={pid}>{aliases[pid] || p.name}</option> })}
                                        </select>
                                        <div><div style={{ fontSize: '12px', color: themeColors.textMuted }}>K / D / A</div><div style={{ fontWeight: 'bold' }}>{detailStats.kills} / {detailStats.deaths} / {detailStats.assists}</div></div>
                                        <div><div style={{ fontSize: '12px', color: themeColors.textMuted }}>ADR</div><div style={{ fontWeight: 'bold' }}>{detailStats.adr.toFixed(1)}</div></div>
                                    </div>
                                    <div style={{ fontSize: '24px', fontWeight: '900', color: getRatingColor(detailStats.rating) }}>{detailStats.rating.toFixed(2)}</div>
                                </div>

                                <AdvancedStats player={detailStats} rounds={selectedMatch.rounds_count} killFeed={fullKillFeed} roundsHistory={selectedMatch.rounds_history} />

                                <div className="glass" style={{ padding: '20px', borderRadius: '16px', marginTop: '20px', border: `1px solid ${themeColors.border}` }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px', color: '#fff' }}>Performance 3.0</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', color: themeColors.accent, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Combat & Quality</div>
                                            <DetailRow label="Kills" value={detailStats.kills} />
                                            <DetailRow label="Kill Weight" value={`${detailStats.kill_weight_calc}x`} sub="Qual" />
                                            <DetailRow label="ADR" value={detailStats.adr.toFixed(1)} />
                                            <DetailRow label="Impact 3.0" value={detailStats.impact_3_calc.toFixed(2)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', color: themeColors.accent, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Opening & Util</div>
                                            <DetailRow label="First Kills" value={detailStats.fk} />
                                            <DetailRow label="First Deaths" value={detailStats.fd} />
                                            <DetailRow label="Util Dmg" value={detailStats.util_dmg} />
                                            <DetailRow label="Flash Ast" value={detailStats.flash_assists} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', color: themeColors.accent, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Multikills</div>
                                            <DetailRow label="3 Kills" value={detailStats.k3 || 0} />
                                            <DetailRow label="4 Kills" value={detailStats.k4 || 0} />
                                            <DetailRow label="Ace (5k)" value={detailStats.k5 || 0} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', color: themeColors.accent, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px' }}>Clutches</div>
                                            <DetailRow label="1v1" value={detailStats.clutches_1v1 || 0} />
                                            <DetailRow label="1v2" value={detailStats.clutches_1v2 || 0} />
                                            <DetailRow label="1v3" value={detailStats.clutches_1v3 || 0} />
                                            <DetailRow label="1v4" value={detailStats.clutches_1v4 || 0} />
                                            <DetailRow label="1v5" value={detailStats.clutches_1v5 || 0} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSubTab === 'rounds' && (
                            <div className="glass fade-in" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${themeColors.border}`, overflowX: 'auto' }}>
                                <RoundsTable rounds={selectedMatch.rounds_history} onDeleteRound={(isAdmin && showAdminActions) ? onDeleteRound : undefined} />
                            </div>
                        )}

                        {activeSubTab === 'duels' && (
                            <div className="glass fade-in" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${themeColors.border}`, overflowX: 'auto' }}>
                                <DuelMatrix players={selectedMatch.players} aliases={aliases} />
                            </div>
                        )}

                        {activeSubTab === 'grenades' && (
                            <div className="fade-in glass" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${themeColors.border}` }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
                                    {['all', 'smoke', 'flash', 'he', 'fire'].map(t => (
                                        <button key={t} onClick={() => setGrenadeFilter(t as typeof grenadeFilter)} style={{ padding: '8px 16px', borderRadius: '8px', background: grenadeFilter === t ? themeColors.accent : 'rgba(255,255,255,0.1)', color: grenadeFilter === t ? '#000' : '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', transition: 'all 0.2s' }}>
                                            {t === 'all' ? 'Все' : t === 'smoke' ? 'Смок' : t === 'flash' ? 'Флеш' : t === 'he' ? 'ХЕ' : 'Огонь'}
                                        </button>
                                    ))}
                                </div>
                                <MapVisualizer mapName={selectedMatch.map} points={grenadePoints} mode="scatter" />
                            </div>
                        )}

                        {activeSubTab === 'heatmaps' && (
                            <div className="fade-in glass" style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${themeColors.border}` }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <select
                                        value={heatmapPlayerId}
                                        onChange={(e) => setHeatmapPlayerId(e.target.value)}
                                        style={{ padding: '8px', borderRadius: '8px', background: '#1c1e26', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', outline: 'none' }}
                                    >
                                        <option value="all" style={{ background: '#1c1e26', color: '#fff' }}>Все игроки</option>
                                        {selectedMatch.players.map(p => (
                                            <option key={p.steamid || p.name} value={p.steamid || p.name} style={{ background: '#1c1e26', color: '#fff' }}>{aliases[p.steamid || p.name] || p.name}</option>
                                        ))}
                                    </select>
                                    <button onClick={() => setHeatmapMode('kills')} style={{ padding: '8px 16px', borderRadius: '8px', background: heatmapMode === 'kills' ? '#22c55e' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>УБИЙСТВА</button>
                                    <button onClick={() => setHeatmapMode('deaths')} style={{ padding: '8px 16px', borderRadius: '8px', background: heatmapMode === 'deaths' ? '#ef4444' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>СМЕРТИ</button>
                                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 5px' }}></div>
                                    <select
                                        value={heatmapSide}
                                        onChange={(e) => setHeatmapSide(e.target.value as typeof heatmapSide)}
                                        style={{ padding: '8px', borderRadius: '8px', background: '#1c1e26', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', outline: 'none' }}
                                    >
                                        <option value="all">Стороны (Все)</option>
                                        <option value="CT">CT</option>
                                        <option value="T">T</option>
                                    </select>
                                    <select
                                        value={heatmapWeapon}
                                        onChange={(e) => setHeatmapWeapon(e.target.value as typeof heatmapWeapon)}
                                        style={{ padding: '8px', borderRadius: '8px', background: '#1c1e26', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', outline: 'none' }}
                                    >
                                        <option value="all">Оружие (Все)</option>
                                        <option value="rifle">ВИНТОВКИ</option>
                                        <option value="sniper">СНАЙПЕРСКИЕ</option>
                                        <option value="pistol">ПИСТОЛЕТЫ</option>
                                        <option value="smg">ПП</option>
                                        <option value="heavy">ТЯЖЕЛОЕ</option>
                                    </select>
                                </div>
                                <MapVisualizer mapName={selectedMatch.map} points={heatmapPoints} mode="scatter" />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'parser3' && (
                    <div className="fade-in">
                        <Parser3Stats match={selectedMatch} />
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="fade-in">
                        <AIAnalyst match={selectedMatch} aliases={aliases} />
                    </div>
                )}
            </div>
        </div>
    );
};
