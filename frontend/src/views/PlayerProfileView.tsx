import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { themeColors, getRatingColor, formatMatchDate, normalizeSide, isRainbowName, isPoopName } from '../utils'; // 🔥 getMapGradient удален
import { useAppStore, type User } from '../store';
import type { DemoResponse, PlayerStat, WeaponStat, RoundHistory, KillEvent } from '../types';
import { AdvancedStats } from '../components/AdvancedStats';

import { calculateRating3 } from '../utils/rating3';
import { aggregateGlobalStats } from '../utils/statsEngine';
import { weaponIcons } from '../utils/weaponIcons';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="glass" style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${themeColors.border}`, background: 'rgba(15, 16, 20, 0.95)' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: `1px solid ${themeColors.border}`, paddingBottom: '4px', fontSize: '13px', color: '#fff' }}>Матч #{label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px' }}>
                        <span style={{ color: themeColors.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: payload[0].color }}></span>
                            Место в топе
                        </span>
                        <span style={{ fontWeight: '900', color: '#fff' }}>#{data.rank}</span>
                    </div>
                    {data.rating !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px' }}>
                            <span style={{ color: themeColors.textMuted, marginLeft: '14px' }}>Рейтинг</span>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{data.rating?.toFixed(2)}</span>
                        </div>
                    )}
                    {data.kills !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px' }}>
                            <span style={{ color: themeColors.textMuted, marginLeft: '14px' }}>Киллы</span>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{data.kills}</span>
                        </div>
                    )}
                    {data.map && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px', marginTop: '4px', paddingTop: '4px', borderTop: `1px dashed ${themeColors.border}` }}>
                            <span style={{ color: themeColors.textMuted }}>Карта</span>
                            <span style={{ fontWeight: 'bold', color: '#fff', textTransform: 'capitalize' }}>{data.map.replace('de_', '')}</span>
                        </div>
                    )}
                    {data.date && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '13px' }}>
                            <span style={{ color: themeColors.textMuted }}>Дата</span>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{data.date.split('|')[0]}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

const CustomLabel = (props: any) => {
    const { x, y, stroke, value, index, data } = props;
    if (!data || index !== data.length - 1) return null;
    return (
        <text
            x={x + 12}
            y={y}
            fill={stroke}
            fontSize={14}
            fontWeight="bold"
            dominantBaseline="middle"
            style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}
        >
            #{value}
        </text>
    );
};




const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A020F0', '#FF4444'];

export const PlayerProfileView: React.FC = () => {
    const { matches, aliases, merges, ratingVer, triggerPoop, user, updateProfile } = useAppStore();
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();

    const id = params.id || '';
    const onBack = () => navigate(-1);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState({
        display_name: '',
        avatar: '',
        bio: '',
        social_vk: '',
        social_tg: '',
        social_twitch: '',
        background_url: ''
    });

    const [targetProfile, setTargetProfile] = useState<Partial<User> | null>(null);

    // Fetch the public profile for this user
    React.useEffect(() => {
        const fetchProfile = async () => {
            if (!id) return;
            try {
                const resp = await fetch(`http://localhost:8000/api/user/${id}`);
                if (resp.ok) {
                    const data = await resp.json();
                    setTargetProfile(data);
                } else {
                    setTargetProfile(null);
                }
            } catch (e) {
                console.error("Failed to fetch profile:", e);
                setTargetProfile(null);
            }
        };
        fetchProfile();
    }, [id]);

    // Check if this is the logged-in user's profile
    const isOwnProfile = useMemo(() => {
        if (!user) return false;
        const targetId = id.toLowerCase();
        const userSteamId = user.steamid?.toLowerCase();
        const userDisplayName = user.display_name?.toLowerCase();

        return userSteamId === targetId ||
            userDisplayName === targetId ||
            (targetProfile?.steamid && targetProfile.steamid === user.steamid) ||
            (merges && user.steamid && (merges[user.steamid] || "").toLowerCase() === targetId);
    }, [user, id, merges, targetProfile]);

    const handleOpenEdit = () => {
        if (user) {
            setEditData({
                display_name: user.display_name || '',
                avatar: user.avatar || '',
                bio: user.bio || '',
                social_vk: user.social_vk || '',
                social_tg: user.social_tg || '',
                social_twitch: user.social_twitch || '',
                background_url: user.background_url || ''
            });
            setIsEditModalOpen(true);
        }
    };

    const handleSaveProfile = async () => {
        const success = await updateProfile(editData);
        if (success) {
            setIsEditModalOpen(false);
            // Refresh target profile after save, if it's own profile
            if (isOwnProfile) {
                setTargetProfile((prev: Partial<User> | null) => prev ? ({ ...prev, ...editData }) : editData as User);
            }
        }
    };

    const [activeTab, setActiveTab] = useState<'overview' | 'individual' | 'matches' | 'history' | 'advanced' | 'weapons' | 'clutches' | 'multikills' | 'social'>('overview');
    const [subTab, setSubTab] = useState<'weapons' | 'clutches' | 'multikills' | 'social'>('weapons');

    const [sideFilter, setSideFilter] = useState<'ALL' | 'CT' | 'T'>('ALL');

    // Сортировка
    const [matchSort, setMatchSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
    const [mkSort, setMkSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
    const [socialSort, setSocialSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'gamesWith', dir: 'desc' });
    const [clutchSort, setClutchSort] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });

    const [clickedPointId, setClickedPointId] = useState<string | null>(null);
    const [socialSearch, setSocialSearch] = useState('');

    // --- 1. ГЛАВНЫЙ РАСЧЕТ СТАТИСТИКИ ---
    const stats = useMemo(() => {
        const history: { matchId: string, matchIndex: number, date: string, map: string, rating: number, rank: number, kills: number, fullMatchData: DemoResponse }[] = [];
        const matchLog: { id: string, map: string, date: string, score_t: number, score_ct: number, kills: number, deaths: number, assists: number, kd: string | number, adr: string, hs_percent: number, rating: string, result: 'W' | 'L' | 'D', fullMatchData: DemoResponse }[] = [];
        const multiKillHistory: { date: string, map: string, round: number, kills: number, matchId: string, result: string }[] = [];
        const clutchHistory: { date: string, map: string, matchId: string, c1: number, c2: number, c3: number, c4: number, c5: number, points: number, highlightRound: number }[] = [];
        const allKillFeed: KillEvent[] = [];
        const allRoundsHistory: RoundHistory[] = [];

        let k = 0, d = 0, a = 0, dmg = 0, r = 0, m = 0;
        let totalHs = 0;
        let totalFk = 0, totalFd = 0;
        let totalUtilDmg = 0, totalFlashAst = 0, totalFlashesThrown = 0;
        let totalTradeKills = 0, totalTradeDeaths = 0;

        let totalKastSum = 0;
        let totalWeightedKills = 0;
        let totalMultikills = 0;
        let totalAwpMultikills = 0;
        let totalClutchScore = 0;

        // 🔥 SIDE STATS ACCUMULATORS (Averages)
        const ctStats = { rounds: 0, ratingSum: 0, rating3Sum: 0, adrSum: 0, impactSum: 0, kastSum: 0 };
        const tStats = { rounds: 0, ratingSum: 0, rating3Sum: 0, adrSum: 0, impactSum: 0, kastSum: 0 };

        // 🔥 RAW ACCUMULATORS (For calculation if missing)
        const ctRaw = { rounds: 0, kills: 0, deaths: 0, damage: 0, opening_kills: 0, multikills: 0, kastSum: 0 };
        const tRaw = { rounds: 0, kills: 0, deaths: 0, damage: 0, opening_kills: 0, multikills: 0, kastSum: 0 };

        let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0;
        let totalSwingRounds = 0;
        let rounds0 = 0, rounds1 = 0, rounds2 = 0, rounds3 = 0, rounds4 = 0, rounds5 = 0;
        let entryWins = 0;

        let rifleKills = 0, sniperKills = 0, smgKills = 0, pistolKills = 0, nadeKills = 0, otherKills = 0;
        const weaponMap: Record<string, number> = {};

        let playerName = "";
        const sortedMatches = [...matches].sort((a: DemoResponse, b: DemoResponse) => new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime());

        // 🔥 NEW: Pre-calculate Target Main IDs based on the URL parameter 'id' (which is usually a nickname)
        const targetMainIds = new Set<string>();
        targetMainIds.add(id);

        matches.forEach(m => {
            m.players.forEach(p => {
                const pid = String(p.steamid || p.name);
                const plName = String(p.name);
                const plAlias = aliases && aliases[pid];

                // If this player matches the URL param by ID, Nickname, or Alias
                if (pid === id || plName === id || plAlias === id) {
                    let mainId = pid;
                    if (merges && merges[pid]) mainId = merges[pid];
                    targetMainIds.add(mainId);
                }
            });
        });

        sortedMatches.forEach((match: DemoResponse, index: number) => {
            // 🔥 УЛУЧШЕННЫЙ ПОИСК ИГРОКА С УЧЕТОМ ОБЪЕДИНЕНИЙ
            const p = match.players.find((pl: PlayerStat) => {
                const pid = String(pl.steamid || pl.name);
                const plName = String(pl.name);
                const plAlias = aliases && aliases[pid];

                let mainId = pid;
                if (merges && merges[pid]) mainId = merges[pid];

                // If this player's main ID is one of our resolved target main IDs
                if (targetMainIds.has(mainId)) return true;

                // Check by matched main ID (merges)
                if (merges) {
                    if (pid === id || merges[pid] === id) return true;
                }

                // Check by nickname / alias (if passed ID is a nickname)
                if (plName === id || plAlias === id) return true;

                // Standard direct ID check
                return pid === id;
            });

            if (p) {
                if (!playerName) playerName = (aliases && aliases[p.steamid || p.name]) || p.name;

                let startSide: 'CT' | 'T' | null = null;
                if (match.rounds_history) {
                    for (const round of match.rounds_history) {
                        if (round.round_num > 12) break;
                        if (round.kill_feed) {
                            for (const event of round.kill_feed) {
                                if (event.killer === p.name || event.killer === p.steamid) {
                                    const s = normalizeSide(event.killer_team || event.attacker_team);
                                    if (s) { startSide = s as 'CT' | 'T'; break; }
                                }
                            }
                        }
                        if (startSide) break;
                    }
                }

                // Клатчи за матч
                const mc1 = p.clutches_1v1 || 0;
                const mc2 = p.clutches_1v2 || 0;
                const mc3 = p.clutches_1v3 || 0;
                const mc4 = p.clutches_1v4 || 0;
                const mc5 = p.clutches_1v5 || 0;
                const matchClutchScore = mc1 + (mc2 * 2) + (mc3 * 4) + (mc4 * 6) + (mc5 * 10);

                // Поиск лучшего раунда (хайлайта)
                let bestRoundNum = 1;
                let maxKillsInRound = 0;
                if (match.rounds_history) {
                    match.rounds_history.forEach((round: RoundHistory) => {
                        let kills = 0;
                        if (round.kill_feed) {
                            round.kill_feed.forEach((event: KillEvent) => {
                                const killer = event.killer || event.attacker_name || event.attacker;
                                if (killer === p.name || killer === p.steamid) kills++;
                            });
                        }
                        if (kills > maxKillsInRound) {
                            maxKillsInRound = kills;
                            bestRoundNum = round.round_num;
                        }
                    });
                }

                if (matchClutchScore > 0) {
                    clutchHistory.push({
                        date: match.upload_date,
                        map: match.map,
                        matchId: match.id,
                        c1: mc1, c2: mc2, c3: mc3, c4: mc4, c5: mc5,
                        points: matchClutchScore,
                        highlightRound: bestRoundNum
                    });
                }

                const matchMultikills = (p.k3 || 0) + (p.k4 || 0) + (p.k5 || 0);
                const matchR3 = calculateRating3({
                    rounds: match.rounds_count,
                    kills: p.kills,
                    deaths: p.deaths,
                    assists: p.assists,
                    damage: p.util_dmg ? (p.adr * match.rounds_count) : (p.damage || 0),
                    weighted_kills: p.weighted_kills || p.kills,
                    opening_kills: p.fk,
                    multikills: matchMultikills,
                    awp_multikills: p.awp_multikills || 0,
                    clutch_score: matchClutchScore
                });

                c1 += mc1; c2 += mc2; c3 += mc3; c4 += mc4; c5 += mc5;
                totalWeightedKills += p.weighted_kills || p.kills;
                totalMultikills += matchMultikills;
                totalAwpMultikills += p.awp_multikills || 0;
                totalClutchScore += matchClutchScore;
                totalKastSum += p.kast || 0;

                let matchKills = p.kills;
                let matchDeaths = p.deaths;
                let matchRounds = match.rounds_count;

                // 🔥 COLLECT ALL DATA FOR ADVANCED STATS
                if (match.rounds_history) {
                    allRoundsHistory.push(...match.rounds_history);
                    match.rounds_history.forEach(r => {
                        if (r.kill_feed) allKillFeed.push(...r.kill_feed);
                    });
                }

                let matchSwings = 0;
                let matchRating = ratingVer === '3.0' ? parseFloat(matchR3.rating) : p.rating;

                if (sideFilter === 'ALL') {
                    m++;
                    k += p.kills; d += p.deaths; a += p.assists;
                    dmg += (p.adr * match.rounds_count);
                    r += match.rounds_count;
                    totalHs += p.hs;

                    totalFk += p.fk || 0; totalFd += p.fd || 0;
                    totalUtilDmg += p.util_dmg || 0; totalFlashAst += p.flash_assists || 0;
                    totalFlashesThrown += (p.flashes_thrown || 0);
                    totalTradeKills += p.trade_kills || 0;
                    totalTradeDeaths += p.trade_deaths || 0;

                    if (p.weapons) {
                        p.weapons.forEach((w: WeaponStat) => {
                            const name = w.name.toLowerCase().trim();
                            weaponMap[name] = (weaponMap[name] || 0) + w.kills;
                        });
                    }



                    // 🔥 ACCUMULATE SIDE STATS
                    if (p.ct_stats) {
                        ctStats.rounds += p.ct_stats.rounds;
                        ctStats.ratingSum += p.ct_stats.rating * p.ct_stats.rounds;
                        ctStats.rating3Sum += (p.ct_stats.rating_3 || p.ct_stats.rating) * p.ct_stats.rounds;
                        ctStats.adrSum += p.ct_stats.adr * p.ct_stats.rounds;
                        ctStats.impactSum += p.ct_stats.impact * p.ct_stats.rounds;
                        ctStats.kastSum += p.ct_stats.kast * p.ct_stats.rounds;
                    }
                    if (p.t_stats) {
                        tStats.rounds += p.t_stats.rounds;
                        tStats.ratingSum += p.t_stats.rating * p.t_stats.rounds;
                        tStats.rating3Sum += (p.t_stats.rating_3 || p.t_stats.rating) * p.t_stats.rounds;
                        tStats.adrSum += p.t_stats.adr * p.t_stats.rounds;
                        tStats.impactSum += p.t_stats.impact * p.t_stats.rounds;
                        tStats.kastSum += p.t_stats.kast * p.t_stats.rounds;
                    }

                    if (match.rounds_history) {
                        match.rounds_history.forEach((round: RoundHistory) => {
                            let killsInRound = 0;
                            let playerSideInRound = '';
                            let isEntryKiller = false;
                            let diedInRound = false;

                            if (round.kill_feed) {
                                round.kill_feed.forEach((event: KillEvent, idx: number) => {
                                    const killer = event.killer || event.attacker_name || event.attacker;
                                    const victim = event.victim || event.victim_name;

                                    if (killer === p.name || killer === p.steamid) {
                                        if (victim && killer !== victim) killsInRound++;
                                        playerSideInRound = normalizeSide(event.killer_team || event.attacker_team);
                                        if (idx === 0) isEntryKiller = true;
                                    }

                                    if (victim === p.name || victim === p.steamid) {
                                        diedInRound = true;
                                        if (!playerSideInRound) playerSideInRound = normalizeSide(event.victim_team || event.team);
                                    }
                                });
                            }
                            if (killsInRound === 1) rounds1++;
                            if (killsInRound === 2) rounds2++;
                            if (killsInRound === 3) rounds3++;
                            if (killsInRound === 4) rounds4++;
                            if (killsInRound >= 5) rounds5++;

                            if (killsInRound >= 2) {
                                const winner = normalizeSide(round.winner_side || round.winner_team);
                                if (playerSideInRound && winner && playerSideInRound === winner) matchSwings++;
                            }

                            if (isEntryKiller) {
                                const winner = normalizeSide(round.winner_side || round.winner_team);
                                if (playerSideInRound && winner && playerSideInRound === winner) entryWins++;
                            }

                            // 🔥 MANUAL RAW AGGREGATION
                            if (playerSideInRound === 'CT') {
                                ctRaw.rounds++;
                                ctRaw.kills += killsInRound;
                                ctRaw.deaths += diedInRound ? 1 : 0;
                                ctRaw.damage += p.adr || 0;
                                ctRaw.opening_kills += isEntryKiller ? 1 : 0;
                                ctRaw.multikills += killsInRound >= 3 ? 1 : 0;
                                ctRaw.kastSum += p.kast || 0;
                            } else if (playerSideInRound === 'T') {
                                tRaw.rounds++;
                                tRaw.kills += killsInRound;
                                tRaw.deaths += diedInRound ? 1 : 0;
                                tRaw.damage += p.adr || 0;
                                tRaw.opening_kills += isEntryKiller ? 1 : 0;
                                tRaw.multikills += killsInRound >= 3 ? 1 : 0;
                                tRaw.kastSum += p.kast || 0;
                            }

                            if (killsInRound >= 3) {
                                multiKillHistory.push({
                                    date: match.upload_date, map: match.map, round: round.round_num,
                                    kills: killsInRound, matchId: match.id, result: isEntryKiller ? 'Entry' : 'Hold'
                                });
                            }
                        });
                    } else {
                        rounds1 += p.k1 || 0; rounds2 += p.k2 || 0; rounds3 += p.k3 || 0; rounds4 += p.k4 || 0; rounds5 += p.k5 || 0;
                        const kRounds = ((p.k1 || 0) + (p.k2 || 0) + (p.k3 || 0) + (p.k4 || 0) + (p.k5 || 0));
                        rounds0 += (matchRounds - kRounds);
                    }

                } else {
                    if (match.rounds_history && startSide) {
                        let playedRoundsInSide = 0;
                        match.rounds_history.forEach((round: RoundHistory) => {
                            const rn = round.round_num;
                            let currentSide = startSide;
                            if (rn > 12 && rn <= 24) currentSide = startSide === 'CT' ? 'T' : 'CT';

                            if (currentSide === sideFilter) {
                                playedRoundsInSide++;
                                matchRounds++;

                                let killsInRound = 0;
                                let diedInRound = false;
                                let isEntryKiller = false;

                                if (round.kill_feed) {
                                    round.kill_feed.forEach((event: KillEvent, idx: number) => {
                                        const killer = event.killer || event.attacker_name || event.attacker;
                                        const victim = event.victim || event.victim_name;

                                        if ((killer === p.name || killer === p.steamid)) {
                                            if (victim && killer !== victim) {
                                                killsInRound++;
                                                const wName = event.weapon ? event.weapon.replace('weapon_', '').toLowerCase().trim() : 'unknown';
                                                weaponMap[wName] = (weaponMap[wName] || 0) + 1;
                                            }
                                            if (idx === 0) isEntryKiller = true;
                                        }
                                        if (victim === p.name || victim === p.steamid) {
                                            diedInRound = true;
                                        }
                                    });
                                }

                                matchKills += killsInRound;
                                if (diedInRound) matchDeaths++;

                                if (killsInRound === 0) rounds0++;
                                if (killsInRound === 1) rounds1++;
                                if (killsInRound === 2) rounds2++;
                                if (killsInRound === 3) rounds3++;
                                if (killsInRound === 4) rounds4++;
                                if (killsInRound >= 5) rounds5++;

                                if (killsInRound >= 2) {
                                    const winner = normalizeSide(round.winner_side || round.winner_team);
                                    if (winner === currentSide) matchSwings++;
                                }

                                if (isEntryKiller) {
                                    totalFk++;
                                    const winner = normalizeSide(round.winner_side || round.winner_team);
                                    if (winner === currentSide) entryWins++;
                                }

                                if (killsInRound >= 3) {
                                    multiKillHistory.push({
                                        date: match.upload_date, map: match.map, round: round.round_num,
                                        kills: killsInRound, matchId: match.id, result: isEntryKiller ? 'Entry' : 'Hold'
                                    });
                                }
                            }
                        });

                        if (playedRoundsInSide > 0) {
                            m++;
                            r += playedRoundsInSide;
                            k += matchKills;
                            d += matchDeaths;
                            matchRating = playedRoundsInSide > 0 ? (matchKills / playedRoundsInSide) : 0;
                        }
                    }
                }

                totalSwingRounds += matchSwings;

                if (sideFilter === 'ALL' || matchRounds > 0) {
                    let currentRank = 0;
                    if (sideFilter === 'ALL') {
                        const slicedMatches = sortedMatches.slice(0, index + 1);
                        const aggs = aggregateGlobalStats(slicedMatches, aliases, merges);
                        const ratingKey = ratingVer === '3.0' ? 'rating3' : 'rating';
                        aggs.sort((a, b) => Number(b[ratingKey]) - Number(a[ratingKey]));
                        const rankIndex = aggs.findIndex(ag => {
                            let pid = String(ag.steamid);
                            if (merges && merges[pid]) pid = merges[pid];
                            return targetMainIds.has(pid) || ag.name === playerName;
                        });
                        if (rankIndex !== -1) currentRank = rankIndex + 1;
                    }

                    history.push({
                        matchId: match.id,
                        matchIndex: index + 1,
                        date: match.upload_date,
                        map: match.map,
                        rating: parseFloat(matchRating.toFixed(2)),
                        rank: currentRank,
                        kills: matchKills,
                        fullMatchData: match
                    });

                    matchLog.unshift({
                        id: match.id,
                        map: match.map,
                        date: match.upload_date,
                        score_t: match.final_score_t,
                        score_ct: match.final_score_ct,
                        kills: matchKills,
                        deaths: matchDeaths,
                        assists: sideFilter === 'ALL' ? p.assists : 0,
                        kd: matchDeaths > 0 ? (matchKills / matchDeaths).toFixed(2) : matchKills,
                        adr: p.adr.toFixed(1),
                        hs_percent: p.hs_percent,
                        rating: matchRating.toFixed(2),
                        result: p.team === (match.final_score_t > match.final_score_ct ? 'T' : 'CT') ? 'W' : (match.final_score_t === match.final_score_ct ? 'D' : 'L'),
                        fullMatchData: match
                    });
                }
            }
        });

        Object.entries(weaponMap).forEach(([name, count]) => {
            if (['ak47', 'm4a1', 'm4a1_silencer', 'galilar', 'famas', 'aug', 'sg556'].includes(name)) rifleKills += count;
            else if (['awp', 'ssg08', 'g3sg1', 'scar20'].includes(name)) sniperKills += count;
            else if (['glock', 'usp_silencer', 'hkp2000', 'p250', 'deagle', 'elite', 'fiveseven', 'cz75a', 'tec9'].includes(name)) pistolKills += count;
            else if (['mac10', 'mp9', 'mp7', 'ump45', 'p90', 'bizon'].includes(name)) smgKills += count;
            else if (['hegrenade', 'inferno', 'molotov', 'incgrenade'].includes(name)) nadeKills += count;
            else otherKills += count;
        });



        // 🔥 POST-LOOP: Calculate Missing Side Stats
        if (ctStats.rounds === 0 && ctRaw.rounds > 0) {
            const calculated = calculateRating3({
                rounds: ctRaw.rounds, kills: ctRaw.kills, deaths: ctRaw.deaths, assists: 0,
                damage: ctRaw.damage, opening_kills: ctRaw.opening_kills, multikills: ctRaw.multikills,
                awp_multikills: 0, clutch_score: 0
            });
            ctStats.rounds = ctRaw.rounds;
            ctStats.ratingSum = parseFloat(calculated.rating) * ctRaw.rounds;
            ctStats.rating3Sum = parseFloat(calculated.rating) * ctRaw.rounds;
            ctStats.adrSum = (ctRaw.damage / ctRaw.rounds) * ctRaw.rounds;
            ctStats.impactSum = parseFloat(calculated.impact) * ctRaw.rounds;
            ctStats.kastSum = (ctRaw.kastSum / ctRaw.rounds) * ctRaw.rounds;
        }

        if (tStats.rounds === 0 && tRaw.rounds > 0) {
            const calculated = calculateRating3({
                rounds: tRaw.rounds, kills: tRaw.kills, deaths: tRaw.deaths, assists: 0,
                damage: tRaw.damage, opening_kills: tRaw.opening_kills, multikills: tRaw.multikills,
                awp_multikills: 0, clutch_score: 0
            });
            tStats.rounds = tRaw.rounds;
            tStats.ratingSum = parseFloat(calculated.rating) * tRaw.rounds;
            tStats.rating3Sum = parseFloat(calculated.rating) * tRaw.rounds;
            tStats.adrSum = (tRaw.damage / tRaw.rounds) * tRaw.rounds;
            tStats.impactSum = parseFloat(calculated.impact) * tRaw.rounds;
            tStats.kastSum = (tRaw.kastSum / tRaw.rounds) * tRaw.rounds;
        }

        const r3Total = calculateRating3({
            rounds: r, kills: k, deaths: d, assists: a, damage: dmg,
            weighted_kills: totalWeightedKills, opening_kills: totalFk, multikills: totalMultikills, awp_multikills: totalAwpMultikills, clutch_score: totalClutchScore
        });

        const sortedWeapons = Object.entries(weaponMap).map(([name, kills]) => ({ name, kills })).sort((a, b) => b.kills - a.kills);

        const aggregatedPlayer: PlayerStat = {
            name: playerName || id, team: '',
            kills: k, deaths: d, assists: a, hs: totalHs, hs_percent: k > 0 ? Math.round((totalHs / k) * 100) : 0,
            kd: d > 0 ? parseFloat((k / d).toFixed(2)) : k,
            adr: sideFilter === 'ALL' ? (r > 0 ? parseFloat((dmg / r).toFixed(1)) : 0) : 0,
            rating: parseFloat(r3Total.rating),
            impact: parseFloat(r3Total.impact),
            // @ts-expect-error avg_kill_weight is added for calculation
            avg_kill_weight: parseFloat(r3Total.avg_kill_weight),
            kast: m > 0 ? parseFloat((totalKastSum / m).toFixed(1)) : 0,
            fk: totalFk, fd: totalFd,
            util_dmg: totalUtilDmg, util_dmg_per_round: r > 0 ? parseFloat((totalUtilDmg / r).toFixed(1)) : 0,
            flash_assists: totalFlashAst, trade_kills: totalTradeKills,
            trade_deaths: totalTradeDeaths,
            flashes_thrown: totalFlashesThrown,
            clutches_1v1: c1, clutches_1v2: c2, clutches_1v3: c3, clutches_1v4: c4, clutches_1v5: c5,
            k1: rounds1, k2: rounds2, k3: rounds3, k4: rounds4, k5: rounds5,
            weapons: sortedWeapons as WeaponStat[],
            rounds_with_kills: (rounds1 + rounds2 + rounds3 + rounds4 + rounds5),
            rounds_with_multikills: (rounds2 + rounds3 + rounds4 + rounds5),
            round_swing_count: totalSwingRounds,
            ct_stats: ctStats.rounds > 0 ? {
                rounds: ctStats.rounds,
                rating: parseFloat((ctStats.ratingSum / ctStats.rounds).toFixed(2)),
                rating_3: parseFloat((ctStats.rating3Sum / ctStats.rounds).toFixed(2)),
                adr: parseFloat((ctStats.adrSum / ctStats.rounds).toFixed(1)),
                impact: parseFloat((ctStats.impactSum / ctStats.rounds).toFixed(2)),
                kast: parseFloat((ctStats.kastSum / ctStats.rounds).toFixed(1)),
                kills: 0, deaths: 0, assists: 0, damage: 0, fk: 0, fd: 0 // placeholders
            } : undefined,
            t_stats: tStats.rounds > 0 ? {
                rounds: tStats.rounds,
                rating: parseFloat((tStats.ratingSum / tStats.rounds).toFixed(2)),
                rating_3: parseFloat((tStats.rating3Sum / tStats.rounds).toFixed(2)),
                adr: parseFloat((tStats.adrSum / tStats.rounds).toFixed(1)),
                impact: parseFloat((tStats.impactSum / tStats.rounds).toFixed(2)),
                kast: parseFloat((tStats.kastSum / tStats.rounds).toFixed(1)),
                kills: 0, deaths: 0, assists: 0, damage: 0, fk: 0, fd: 0 // placeholders
            } : undefined
        };

        const extendedStats = {
            rounds0, rounds1, rounds2, rounds3, rounds4, rounds5,
            rifleKills, sniperKills, smgKills, pistolKills, nadeKills, otherKills,
            entryWins,
            openingKillRatio: totalFd > 0 ? (totalFk / totalFd).toFixed(2) : totalFk.toString(),
            openingRating: (totalFk / (m || 1)).toFixed(2)
        };

        // 🔥 ОПРЕДЕЛЕНИЕ РОЛИ
        let role = { name: 'Универсал', icon: '', color: '#a78bfa', subLabel: 'K/D', subValue: (d > 0 ? (k / d).toFixed(2) : k.toString()) };

        const awpRatio = k > 0 ? sniperKills / k : 0;
        const rifleRatio = k > 0 ? rifleKills / k : 0;
        const entryPerRound = r > 0 ? totalFk / r : 0;
        const supportScore = r > 0 ? (a + totalTradeKills) / r : 0;

        if (awpRatio > 0.30) {
            role = { name: 'Снайпер', icon: '', color: '#f59e0b', subLabel: 'AWP %', subValue: `${(awpRatio * 100).toFixed(0)}%` };
        } else if (entryPerRound > 0.12) {
            role = { name: 'Энтри', icon: '', color: '#ef4444', subLabel: 'OpK/R', subValue: entryPerRound.toFixed(2) };
        } else if (rifleRatio > 0.45) {
            role = { name: 'Рифлер', icon: '', color: '#3b82f6', subLabel: 'Винтовки %', subValue: `${(rifleRatio * 100).toFixed(0)}%` };
        } else if (supportScore > 0.20) {
            role = { name: 'Саппорт', icon: '', color: '#10b981', subLabel: 'Sup/R', subValue: supportScore.toFixed(2) };
        }

        return {
            name: playerName || id, maps: m, kd: d > 0 ? (k / d).toFixed(2) : k.toString(),
            rating: r3Total.rating, impact: r3Total.impact, killWeight: r3Total.avg_kill_weight,
            history, matchLog, totalRounds: r, aggregatedPlayer, sortedWeapons, extendedStats,
            multiKillHistory, clutchHistory, totalClutchScore,
            allKillFeed,
            allRoundsHistory,
            role // 🔥 NEW
        };
    }, [id, matches, aliases, ratingVer, sideFilter, merges]); // 🔥

    interface SocialRelation {
        id: string;
        name: string;
        gamesWith: number;
        winsWith: number;
        ratingSumWith: number;
        gamesAgainst: number;
        winsAgainst: number;
        duelKills: number;
        duelDeaths: number;
        winRateWith?: number;
        avgRatingWith?: number;
        winRateAgainst?: number;
        kdDiff?: number;
        totalInteractions?: number;
    }

    // --- 2. СОЦИАЛЬНАЯ СТАТИСТИКА ---
    const socialStats = useMemo(() => {
        const relations: Record<string, SocialRelation> = {};
        matches.forEach(m => {
            const me = m.players.find((p: PlayerStat) => {
                const pid = p.steamid || p.name;
                return pid === id || p.name === id || (aliases && aliases[pid] === id) || (merges && merges[pid] === id);
            });
            if (!me) return;
            const myTeam = normalizeSide(me.team);
            const myWin = (myTeam === 'CT' && m.final_score_ct > m.final_score_t) || (myTeam === 'T' && m.final_score_t > m.final_score_ct);

            m.players.forEach((other: PlayerStat) => {
                const otherId = other.steamid || other.name;
                if (otherId === (me.steamid || me.name)) return;

                if (!relations[otherId]) {
                    relations[otherId] = { id: otherId, name: aliases[otherId] || other.name, gamesWith: 0, winsWith: 0, ratingSumWith: 0, gamesAgainst: 0, winsAgainst: 0, duelKills: 0, duelDeaths: 0 };
                }
                if (aliases[otherId]) relations[otherId].name = aliases[otherId];

                if (sideFilter === 'ALL') {
                    const otherTeam = normalizeSide(other.team);
                    if (otherTeam && myTeam && otherTeam === myTeam) {
                        relations[otherId].gamesWith++;
                        if (myWin) relations[otherId].winsWith++;
                        relations[otherId].ratingSumWith += (ratingVer === '3.0' ? (me.rating_3 || me.rating) : me.rating);
                    } else if (otherTeam && myTeam && otherTeam !== myTeam) {
                        relations[otherId].gamesAgainst++;
                        if (myWin) relations[otherId].winsAgainst++;
                    }
                }
            });

            if (m.rounds_history) {
                m.rounds_history.forEach((r: RoundHistory) => {
                    const roundTeams: Record<string, string> = {};
                    if (r.kill_feed) {
                        r.kill_feed.forEach((k: KillEvent) => {
                            if (k.killer) roundTeams[k.killer] = normalizeSide(k.killer_team || k.attacker_team);
                            if (k.victim) roundTeams[k.victim] = normalizeSide(k.victim_team || k.team);
                        });
                    }

                    const myRoundSide = roundTeams[me.name] || roundTeams[me.steamid || ''];
                    if (sideFilter !== 'ALL' && myRoundSide !== sideFilter) return;

                    if (r.kill_feed) {
                        r.kill_feed.forEach((k: KillEvent) => {
                            const killerName = k.killer || k.attacker_name || k.attacker;
                            const victimName = k.victim || k.victim_name;
                            if (!killerName || !victimName) return;

                            const kSide = roundTeams[killerName];
                            const vSide = roundTeams[victimName];

                            if (kSide && vSide && kSide === vSide) return;

                            if ((killerName === me.name || killerName === me.steamid)) {
                                const victimP = m.players.find((p: PlayerStat) => p.name === victimName || p.steamid === victimName);
                                if (victimP) {
                                    const vid = victimP.steamid || victimP.name;
                                    if (relations[vid]) relations[vid].duelKills++;
                                }
                            }
                            if ((victimName === me.name || victimName === me.steamid)) {
                                const killerP = m.players.find((p: PlayerStat) => p.name === killerName || p.steamid === killerName);
                                if (killerP) {
                                    const kid = killerP.steamid || killerP.name;
                                    if (relations[kid]) relations[kid].duelDeaths++;
                                }
                            }
                        });
                    }
                });
            }
        });
        const list = Object.values(relations).map(r => ({ ...r, winRateWith: r.gamesWith > 0 ? (r.winsWith / r.gamesWith) * 100 : 0, avgRatingWith: r.gamesWith > 0 ? r.ratingSumWith / r.gamesWith : 0, winRateAgainst: r.gamesAgainst > 0 ? (r.winsAgainst / r.gamesAgainst) * 100 : 0, kdDiff: r.duelKills - r.duelDeaths, totalInteractions: r.gamesWith + r.gamesAgainst + r.duelKills + r.duelDeaths })).filter(r => r.totalInteractions > 0);
        const bestTeammate = [...list].filter(r => r.gamesWith >= 2).sort((a, b) => (b.winRateWith || 0) - (a.winRateWith || 0))[0];
        const nemesis = [...list].filter(r => r.duelDeaths > 0).sort((a, b) => ((b.duelDeaths || 0) - (b.duelKills || 0)) - ((a.duelDeaths || 0) - (a.duelKills || 0)))[0];
        const victim = [...list].filter(r => r.duelKills > 0).sort((a, b) => ((b.duelKills || 0) - (b.duelDeaths || 0)) - ((a.duelKills || 0) - (a.duelDeaths || 0)))[0];
        return { list, bestTeammate, nemesis, victim };
    }, [matches, id, aliases, ratingVer, sideFilter, merges]);

    const globalRankData = useMemo(() => {
        if (!stats.name) return null;
        const aggs = aggregateGlobalStats(matches, aliases, merges);
        const ratingKey = ratingVer === '3.0' ? 'rating3' : 'rating';
        aggs.sort((a, b) => {
            const valA = Number(a[ratingKey] ?? 0);
            const valB = Number(b[ratingKey] ?? 0);
            return valB - valA;
        });

        let targetId = id;
        if (merges && merges[id]) targetId = merges[id];

        const idx = aggs.findIndex(p => {
            let pid = String(p.steamid);
            if (merges && merges[pid]) pid = merges[pid];
            return pid === targetId || p.name === stats.name || (aliases && aliases[String(p.steamid)] === stats.name);
        });

        if (idx !== -1) {
            const total = aggs.length;
            const rank = idx + 1;
            return { rank, total };
        }
        return null;
    }, [matches, aliases, merges, ratingVer, stats.name, id]);

    const handleDotClick = (payload: { payload?: { fullMatchData?: DemoResponse } } | unknown) => {
        const data = (payload as { payload?: { fullMatchData?: DemoResponse } })?.payload || (payload as { fullMatchData?: DemoResponse });
        if (data && data.fullMatchData) {
            const clickedId = data.fullMatchData.id;
            if (clickedPointId === clickedId) {
                navigate(`/matches/${clickedId}`);
                setClickedPointId(null);
            } else {
                setClickedPointId(clickedId);
            }
        }
    };

    interface SortState {
        key: string;
        dir: 'asc' | 'desc';
    }

    const SortHeader = ({ label, sortState, setSortState, sortKey }: { label: string, sortState: SortState, setSortState: (s: SortState) => void, sortKey: string }) => (
        <th onClick={() => setSortState({ key: sortKey, dir: sortState.key === sortKey && sortState.dir === 'desc' ? 'asc' : 'desc' })}
            style={{ padding: '12px', cursor: 'pointer', userSelect: 'none', color: sortState.key === sortKey ? themeColors.accent : themeColors.textMuted }}>
            {label} {sortState.key === sortKey && (sortState.dir === 'asc' ? '↑' : '↓')}
        </th>
    );

    const getSortedData = <T extends Record<string, unknown>>(data: T[], sortState: SortState) => {
        return [...data].sort((a, b) => {
            const valA = a[sortState.key];
            const valB = b[sortState.key];
            if (typeof valA === 'string' && typeof valB === 'string') return sortState.dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return sortState.dir === 'asc' ? (Number(valA || 0) - Number(valB || 0)) : (Number(valB || 0) - Number(valA || 0));
        });
    };

    const StatRow = ({ label, value }: { label: string, value: string | number }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
            <span style={{ color: themeColors.textMuted, fontWeight: 'bold' }}>{label}</span>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>{value}</span>
        </div>
    );

    const ClutchCard = ({ label, value }: { label: string, value: string | number }) => (
        <div className="glass" style={{ padding: '20px', borderRadius: '12px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px', border: `1px solid ${themeColors.border}` }}>
            <div style={{ fontSize: '14px', color: themeColors.textMuted, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '10px' }}>{label}</div>
            <div style={{ fontSize: '32px', fontWeight: '900', color: Number(value) > 0 ? themeColors.win : '#fff' }}>{value}</div>
        </div>
    );

    if (stats.maps === 0) return <div>Игрок не найден</div>;

    const tabs = [
        { key: 'overview', label: 'Обзор' },
        { key: 'individual', label: 'Статистика' },
        { key: 'history', label: 'История рангов' },
        { key: 'matches', label: 'Матчи' },
        { key: 'advanced', label: 'Детали' },
    ];

    const advancedTabs = [
        { key: 'weapons', label: 'Оружие' },
        { key: 'clutches', label: 'Клатчи' },
        { key: 'multikills', label: 'Мультикиллы' },
        { key: 'social', label: 'Друзья / Враги' },
    ];

    const pieData = [{ name: 'Винтовки', value: stats.extendedStats.rifleKills }, { name: 'Снайперские', value: stats.extendedStats.sniperKills }, { name: 'Пистолеты', value: stats.extendedStats.pistolKills }, { name: 'ПП', value: stats.extendedStats.smgKills }, { name: 'Гранаты', value: stats.extendedStats.nadeKills }].filter(d => d.value > 0);
    const filteredSocials = getSortedData(socialStats.list.filter(p => p.name.toLowerCase().includes(socialSearch.toLowerCase())), socialSort);
    const sortedMatchesList = getSortedData(stats.matchLog, matchSort);
    const sortedMultiKills = getSortedData(stats.multiKillHistory, mkSort);
    const sortedClutches = getSortedData(stats.clutchHistory, clutchSort);

    const mapImageUrl = `/5v5stat/maps/${(sortedMatchesList.length > 0 ? sortedMatchesList[0].fullMatchData.map : 'de_mirage').toLowerCase()}.png`;
    const finalBgUrl = targetProfile?.background_url || mapImageUrl;
    const headerBackground = `linear-gradient(to right, rgba(15, 16, 20, 0.95) 0%, rgba(15, 16, 20, 0.7) 100%), url(${finalBgUrl})`;

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            {/* Edit Modal */}
            {isEditModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)' }}>
                    <div className="glass" style={{ width: '450px', padding: '32px', borderRadius: '20px', border: `1px solid ${themeColors.border}` }}>
                        <h3 style={{ margin: '0 0 24px 0', fontSize: '22px', fontWeight: '900' }}>РЕДАКТИРОВАТЬ ПРОФИЛЬ</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <div style={{ fontSize: '11px', color: themeColors.textMuted, marginBottom: '5px', fontWeight: 'bold' }}>ОТОБРАЖАЕМОЕ ИМЯ</div>
                                <input className="glass-input" value={editData.display_name} onChange={e => setEditData({ ...editData, display_name: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: themeColors.textMuted, marginBottom: '5px', fontWeight: 'bold' }}>URL АВАТАРА</div>
                                <input className="glass-input" value={editData.avatar} onChange={e => setEditData({ ...editData, avatar: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: themeColors.textMuted, marginBottom: '5px', fontWeight: 'bold' }}>БИОГРАФИЯ</div>
                                <textarea className="glass-input" value={editData.bio} onChange={e => setEditData({ ...editData, bio: e.target.value })} style={{ width: '100%', height: '80px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px', resize: 'none' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: themeColors.textMuted, marginBottom: '5px', fontWeight: 'bold' }}>VK</div>
                                    <input className="glass-input" value={editData.social_vk} onChange={e => setEditData({ ...editData, social_vk: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: themeColors.textMuted, marginBottom: '5px', fontWeight: 'bold' }}>TELEGRAM</div>
                                    <input className="glass-input" value={editData.social_tg} onChange={e => setEditData({ ...editData, social_tg: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px' }} />
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: themeColors.textMuted, marginBottom: '5px', fontWeight: 'bold' }}>URL ФОНА ПРОФИЛЯ</div>
                                <input className="glass-input" value={editData.background_url} onChange={e => setEditData({ ...editData, background_url: e.target.value })} placeholder="https://..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '8px' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                            <button onClick={handleSaveProfile} className="btn-hover" style={{ flex: 1, padding: '12px', borderRadius: '10px', background: themeColors.accent, border: 'none', color: '#000', fontWeight: '900', cursor: 'pointer' }}>СОХРАНИТЬ</button>
                            <button onClick={() => setIsEditModalOpen(false)} className="btn-hover" style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>ОТМЕНА</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Header */}
            <div style={{ margin: '20px', padding: '30px', borderRadius: '16px', flexShrink: 0, background: headerBackground, backgroundSize: 'cover', backgroundPosition: 'center', border: `1px solid ${themeColors.border}`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '1 1 auto', minWidth: '200px' }}>
                        <button onClick={onBack} className="btn-hover" style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid rgba(255,255,255,0.2)`, color: '#fff', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}>← Назад</button>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                {targetProfile?.avatar ? (
                                    <img
                                        src={targetProfile.avatar}
                                        alt="pfp"
                                        style={{ width: '64px', height: '64px', borderRadius: '50%', border: `2px solid ${themeColors.accent}`, objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: themeColors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
                                        {(targetProfile?.display_name || stats.name)?.[0]?.toUpperCase()}
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h2
                                        onClick={() => isPoopName(stats.name) && triggerPoop()}
                                        className={isRainbowName(stats.name) ? 'rainbow-text' : ''}
                                        style={{ fontSize: '32px', fontWeight: '900', margin: 0, textTransform: 'uppercase', textShadow: '0 4px 10px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', color: isRainbowName(stats.name) ? undefined : '#fff', cursor: isPoopName(stats.name) ? 'pointer' : 'default' }}
                                    >
                                        {stats.name || id}
                                    </h2>
                                    <button
                                        onClick={handleOpenEdit}
                                        style={{ background: 'none', border: 'none', color: themeColors.accent, fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: 0, textAlign: 'left', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        РЕДАКТИРОВАТЬ ПРОФИЛЬ
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Rating {ratingVer}</span>
                                {globalRankData && (
                                    <span style={{
                                        background: globalRankData.rank === 1 ? 'linear-gradient(135deg, #fbbf24 0%, #b45309 100%)' :
                                            globalRankData.rank === 2 ? 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)' :
                                                globalRankData.rank === 3 ? 'linear-gradient(135deg, #d97706 0%, #78350f 100%)' :
                                                    'rgba(255,255,255,0.1)',
                                        color: globalRankData.rank <= 3 ? '#000' : '#fff',
                                        padding: '4px 10px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '900',
                                        border: globalRankData.rank > 3 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                                        boxShadow: globalRankData.rank <= 3 ? '0 4px 12px rgba(0,0,0,0.3)' : 'none'
                                    }}>
                                        #{globalRankData.rank} В ТОПЕ
                                    </span>
                                )}
                            </div>
                            {targetProfile?.bio && (
                                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '8px', maxWidth: '400px', fontStyle: 'italic' }}>
                                    "{targetProfile.bio}"
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                {targetProfile?.social_vk && (
                                    <a href={targetProfile.social_vk.startsWith('http') ? targetProfile.social_vk : `https://vk.com/${targetProfile.social_vk.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: '#4c75a3', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', background: 'rgba(76, 117, 163, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>VK</a>
                                )}
                                {targetProfile?.social_tg && (
                                    <a href={targetProfile.social_tg.startsWith('http') ? targetProfile.social_tg : `https://t.me/${targetProfile.social_tg.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: '#0088cc', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', background: 'rgba(0, 136, 204, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>TG</a>
                                )}
                                {targetProfile?.social_twitch && (
                                    <a href={targetProfile.social_twitch.startsWith('http') ? targetProfile.social_twitch : `https://twitch.tv/${targetProfile.social_twitch}`} target="_blank" rel="noreferrer" style={{ color: '#9146ff', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', background: 'rgba(145, 70, 255, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>Twitch</a>
                                )}
                            </div>
                        </div>
                        <button onClick={() => navigate('/year-review')} className="btn-hover" style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', border: 'none', color: '#000', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '5px' }}>2025</button>
                    </div>
                    {/* 🔥 ИСПРАВЛЕНИЕ: Добавлены кнопки фильтрации сторон */}
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '4px', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button onClick={() => setSideFilter('ALL')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: sideFilter === 'ALL' ? '#fff' : 'transparent', color: sideFilter === 'ALL' ? '#000' : themeColors.textMuted, fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>ВСЕ</button>
                        <button onClick={() => setSideFilter('CT')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: sideFilter === 'CT' ? themeColors.ct : 'transparent', color: sideFilter === 'CT' ? '#fff' : themeColors.textMuted, fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>CT</button>
                        <button onClick={() => setSideFilter('T')} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: sideFilter === 'T' ? themeColors.t : 'transparent', color: sideFilter === 'T' ? '#fff' : themeColors.textMuted, fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>T</button>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.6)', padding: '5px', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                        {tabs.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === tab.key ? themeColors.accent : 'transparent', color: activeTab === tab.key ? '#000' : '#ccc', fontWeight: 'bold', cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{tab.label}</button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sub-tabs for Details */}
            {activeTab === 'advanced' && (
                <div style={{ padding: '0 20px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {advancedTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setSubTab(tab.key as typeof subTab)}
                                style={{
                                    padding: '6px 14px', borderRadius: '8px', border: 'none',
                                    background: subTab === tab.key ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                                    color: subTab === tab.key ? themeColors.accent : themeColors.textMuted,
                                    fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px' }}>
                {activeTab === 'overview' && (
                    <div className="fade-in">
                        <div className="stats-grid stagger-container">
                            <div className="glass stagger-item stagger-1" style={{ padding: '24px', borderRadius: '16px' }}><div style={{ color: themeColors.textMuted, fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Всего Матчей</div><div style={{ fontSize: '36px', fontWeight: '800', marginTop: '5px' }}>{stats.maps}</div></div>
                            <div className="glass stagger-item stagger-2" style={{ padding: '24px', borderRadius: '16px' }}><div style={{ color: themeColors.textMuted, fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Средний K/D {sideFilter !== 'ALL' && `(${sideFilter})`}</div><div style={{ fontSize: '36px', fontWeight: '800', marginTop: '5px', color: parseFloat(stats.kd as string) >= 1 ? themeColors.win : themeColors.loss }}>{stats.kd}</div></div>

                            {/* 🔥 РОЛЬ ИГРОКА */}
                            <div className="glass stagger-item stagger-3" style={{ padding: '24px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', right: '10px', top: '10px', fontSize: '48px', opacity: 0.1 }}>{stats.role.icon}</div>
                                <div style={{ color: themeColors.textMuted, fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>Роль</div>
                                <div style={{ fontSize: '30px', fontWeight: '800', marginTop: '5px', whiteSpace: 'nowrap', color: stats.role.color }}>{stats.role.name}</div>
                                <div style={{ fontSize: '10px', color: themeColors.textMuted, marginTop: '5px', fontWeight: 'bold' }}>{stats.role.subLabel}: <span style={{ color: '#fff' }}>{stats.role.subValue}</span></div>
                            </div>

                            <div className="glass stagger-item stagger-4" style={{ padding: '24px', borderRadius: '16px' }}><div style={{ color: themeColors.textMuted, fontSize: '11px', textTransform: 'uppercase', fontWeight: '700' }}>{sideFilter === 'ALL' ? `Рейтинг ${ratingVer}` : 'Kill Ratio'}</div><div style={{ fontSize: '36px', fontWeight: '800', marginTop: '5px', color: getRatingColor(parseFloat(stats.rating)) }}>{stats.rating}</div><div style={{ fontSize: '10px', color: themeColors.textMuted, marginTop: '5px' }}>Импакт: <span style={{ color: '#fbbf24' }}>{stats.impact}</span> • Кач-во: <span style={{ color: '#4ade80' }}>{stats.killWeight}x</span></div></div>
                        </div>
                        <h3 className="fade-in" style={{ margin: '30px 0 15px 0', fontSize: '20px', fontWeight: '800' }}>Расширенная статистика</h3>
                        <div className="fade-in">
                            <AdvancedStats
                                player={stats.aggregatedPlayer}
                                rounds={stats.totalRounds}
                                killFeed={stats.allKillFeed}
                                roundsHistory={stats.allRoundsHistory}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="fade-in">
                        <div className="glass" style={{ borderRadius: '16px', padding: '24px', height: '450px', marginBottom: '20px' }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>История {sideFilter === 'ALL' ? 'ранга (Место в топе)' : 'K/D'}</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.history} margin={{ top: 20, right: 60, bottom: 10, left: 10 }} style={{ cursor: 'pointer' }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors.border} />
                                    <XAxis dataKey="matchIndex" stroke="#666" style={{ fontSize: '12px', fontWeight: 'bold' }} tick={{ fill: '#9ca3af' }} />
                                    <YAxis stroke="#666" domain={['dataMin', 'auto']} reversed={sideFilter === 'ALL'} allowDecimals={false} tick={{ fill: themeColors.textMuted }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                    <Line type="monotone" dataKey={sideFilter === 'ALL' ? 'rank' : 'rating'} stroke={themeColors.accent} strokeWidth={3} activeDot={{ r: 8, fill: '#fff', stroke: themeColors.accent, strokeWidth: 2, onClick: (_e, payload) => handleDotClick(payload as { payload?: { fullMatchData?: DemoResponse } }) }} dot={{ r: 4, fill: themeColors.bg, stroke: themeColors.accent, strokeWidth: 2, onClick: (e) => handleDotClick(e as unknown as { payload?: { fullMatchData?: DemoResponse } }) }} label={sideFilter === 'ALL' ? <CustomLabel data={stats.history} /> : undefined} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="glass" style={{ padding: '20px', borderRadius: '16px', fontSize: '13px', color: themeColors.textMuted }}>
                            * Нажмите на точку графика, чтобы открыть детали матча.
                        </div>
                    </div>
                )}

                {activeTab === 'individual' && (
                    <div className="fade-in stagger-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        <div className="glass stagger-item stagger-1" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', background: 'rgba(0,0,0,0.3)', borderBottom: `1px solid ${themeColors.border}`, fontWeight: 'bold' }}>Общая статистика</div>
                            <StatRow label="Убийства" value={stats.aggregatedPlayer.kills} />
                            <StatRow label="Смерти" value={stats.aggregatedPlayer.deaths} />
                            <StatRow label="Kill / Death" value={stats.kd} />
                            <StatRow label="Урон в раунд (ADR)" value={stats.aggregatedPlayer.adr.toFixed(1)} />
                        </div>
                        <div className="glass stagger-item stagger-2" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', background: 'rgba(0,0,0,0.3)', borderBottom: `1px solid ${themeColors.border}`, fontWeight: 'bold' }}>Статистика по раундам</div>
                            <StatRow label="Раунды с 1 киллом" value={stats.extendedStats.rounds1} />
                            <StatRow label="Раунды с 2 киллами" value={stats.extendedStats.rounds2} />
                            <StatRow label="Раунды с 3 киллами" value={stats.extendedStats.rounds3} />
                            <StatRow label="Раунды с 4 киллами" value={stats.extendedStats.rounds4} />
                            <StatRow label="Раунды с 5 киллами (Ace)" value={stats.extendedStats.rounds5} />
                        </div>
                        <div className="glass stagger-item stagger-3" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', background: 'rgba(0,0,0,0.3)', borderBottom: `1px solid ${themeColors.border}`, fontWeight: 'bold' }}>Энтри-дуэли</div>
                            <StatRow label="Коэффициент энтри" value={stats.extendedStats.openingKillRatio} />
                            <StatRow label="Винрейт команды после энтри" value={`${stats.aggregatedPlayer.fk > 0 ? ((stats.extendedStats.entryWins / stats.aggregatedPlayer.fk) * 100).toFixed(1) : 0}%`} />
                        </div>
                        <div className="glass stagger-item stagger-4" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', background: 'rgba(0,0,0,0.3)', borderBottom: `1px solid ${themeColors.border}`, fontWeight: 'bold' }}>Тип оружия</div>
                            <StatRow label="Убийства с винтовок" value={stats.extendedStats.rifleKills} />
                            <StatRow label="Убийства со снайперок" value={stats.extendedStats.sniperKills} />
                            <StatRow label="Убийства с пистолетов" value={stats.extendedStats.pistolKills} />
                        </div>
                    </div>
                )}

                {activeTab === 'matches' && (
                    <div className="fade-in glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="mobile-scroll">
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.3)', color: themeColors.textMuted, fontSize: '11px', textTransform: 'uppercase', textAlign: 'left' }}>
                                        <SortHeader label="Исход" sortKey="result" sortState={matchSort} setSortState={setMatchSort} />
                                        <SortHeader label="Карта" sortKey="map" sortState={matchSort} setSortState={setMatchSort} />
                                        <th style={{ padding: '16px', textAlign: 'center' }}>Команда</th>
                                        <SortHeader label="Kills" sortKey="kills" sortState={matchSort} setSortState={setMatchSort} />
                                        <th style={{ padding: '16px', textAlign: 'center' }}>Diff</th>
                                        <th style={{ padding: '16px', textAlign: 'center' }}>ADR</th>
                                        <SortHeader label="RTG 3.0" sortKey="rating" sortState={matchSort} setSortState={setMatchSort} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedMatchesList.map((m, index: number) => {
                                        const sT = Number(m.score_t || 0);
                                        const sCT = Number(m.score_ct || 0);
                                        const playerTeam = sT === sCT ? 'НИЧЬЯ' : (m.result === 'W' ? (sT > sCT ? 'T' : 'CT') : (sT > sCT ? 'CT' : 'T'));
                                        const myScore = playerTeam === 'T' ? sT : sCT;
                                        const enemyScore = playerTeam === 'T' ? sCT : sT;
                                        const resultColor = m.result === 'W' ? themeColors.win : (m.result === 'L' ? themeColors.loss : themeColors.textMuted);
                                        const teamColor = playerTeam === 'T' ? themeColors.t : (playerTeam === 'CT' ? themeColors.ct : themeColors.textMuted);
                                        const mapName = String(m.map || 'de_mirage').toLowerCase();
                                        const mapImgUrl = `/5v5stat/maps/${mapName}.png`;

                                        return (
                                            <tr key={String(m.id || index)} onClick={() => m.fullMatchData && navigate(`/matches/${m.fullMatchData.id}`)} className={`row-hover stagger-item stagger-${Math.min((index % 10) + 1, 10)}`} style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: 'pointer' }}>
                                                <td style={{ padding: '12px 24px', width: '140px' }}>
                                                    <div style={{ background: `${resultColor}20`, color: resultColor, border: `1px solid ${resultColor}40`, padding: '4px 10px', borderRadius: '6px', fontWeight: '800', fontSize: '12px', display: 'flex', gap: '6px' }}>
                                                        {m.result === 'W' ? 'WIN' : 'LOSS'} <span style={{ color: '#fff', opacity: 0.8 }}>{myScore}:{enemyScore}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.2)' }}>
                                                            <img src={mapImgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', display: 'flex', alignItems: 'end', justifyContent: 'center' }}>
                                                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#fff', paddingBottom: '2px' }}>{mapName.replace(/de_/i, '').substring(0, 3).toUpperCase()}</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontWeight: '700', fontSize: '14px', textTransform: 'capitalize', color: '#fff' }}>{mapName.replace(/de_/i, '')}</span>
                                                            <span style={{ fontSize: '11px', color: themeColors.textMuted }}>{(m.date || m.fullMatchData?.upload_date) ? formatMatchDate('', String(m.date || m.fullMatchData?.upload_date)).split('|')[0] : '-'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}><span style={{ fontWeight: '800', color: teamColor, fontSize: '13px' }}>{playerTeam}</span></td>
                                                <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>{m.kills}</td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}><span style={{ fontWeight: '800', color: (m.kills - m.deaths) >= 0 ? themeColors.win : themeColors.loss }}>{(m.kills - m.deaths) > 0 ? `+${m.kills - m.deaths}` : (m.kills - m.deaths)}</span></td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>{m.adr}</td>
                                                <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '45px', padding: '6px 0', borderRadius: '6px', background: getRatingColor(parseFloat(m.rating)) + '15', color: getRatingColor(parseFloat(m.rating)), fontWeight: '800', fontSize: '13px', border: `1px solid ${getRatingColor(parseFloat(m.rating))}30` }}>
                                                        {m.rating}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'advanced' && subTab === 'weapons' && (
                    <div className="fade-in stagger-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                        <div className="glass stagger-item stagger-1" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <h3 style={{ marginBottom: '20px' }}>Использование оружия</h3>
                            <div style={{ width: '100%', height: '300px' }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                            {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: '#1c1e26', border: 'none', borderRadius: '8px' }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="glass stagger-item stagger-2" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', background: 'rgba(0,0,0,0.3)', fontWeight: 'bold', borderBottom: `1px solid ${themeColors.border}` }}>Детальный обзор оружия</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                {stats.sortedWeapons.map((w, i) => {
                                    const icon = weaponIcons[w.name] || weaponIcons[w.name.toUpperCase()];
                                    return (
                                        <div key={w.name} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <span style={{ color: themeColors.textMuted, fontWeight: 'bold', minWidth: '20px' }}>{i + 1}.</span>
                                                {icon && (
                                                    <div style={{ width: '60px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <img src={icon} className="icon-white" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={w.name} />
                                                    </div>
                                                )}
                                                <span style={{ fontWeight: 'bold', color: '#fff', textTransform: 'capitalize' }}>{w.name}</span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{w.kills}</span>
                                                <div style={{ fontSize: '10px', color: themeColors.textMuted }}>Kills</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'advanced' && subTab === 'clutches' && (
                    <div className="fade-in">
                        <div className="stagger-container" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
                            <div className="stagger-item stagger-1" style={{ flex: 1, minWidth: '120px' }}><ClutchCard label="1 в 1" value={stats.aggregatedPlayer.clutches_1v1} /></div>
                            <div className="stagger-item stagger-2" style={{ flex: 1, minWidth: '120px' }}><ClutchCard label="1 в 2" value={stats.aggregatedPlayer.clutches_1v2} /></div>
                            <div className="stagger-item stagger-3" style={{ flex: 1, minWidth: '120px' }}><ClutchCard label="1 в 3" value={stats.aggregatedPlayer.clutches_1v3} /></div>
                            <div className="stagger-item stagger-4" style={{ flex: 1, minWidth: '120px' }}><ClutchCard label="1 в 4" value={stats.aggregatedPlayer.clutches_1v4} /></div>
                            <div className="stagger-item stagger-5" style={{ flex: 1, minWidth: '120px' }}><ClutchCard label="1 в 5" value={stats.aggregatedPlayer.clutches_1v5} /></div>
                        </div>
                        <div className="glass fade-in" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', background: 'rgba(0,0,0,0.3)', fontWeight: 'bold', borderBottom: `1px solid ${themeColors.border}` }}>История клатчей</div>
                            <div className="mobile-scroll">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.05)', color: themeColors.textMuted }}>
                                            <SortHeader label="Дата" sortKey="date" sortState={clutchSort} setSortState={setClutchSort} />
                                            <SortHeader label="Карта" sortKey="map" sortState={clutchSort} setSortState={setClutchSort} />
                                            <th style={{ padding: '12px' }}>Детали</th>
                                            <SortHeader label="Impact Очки" sortKey="points" sortState={clutchSort} setSortState={setClutchSort} />
                                        </tr>
                                    </thead>
                                    <tbody className="stagger-container">
                                        {sortedClutches.map((c, i: number) => {
                                            const details = [];
                                            if (c.c5 > 0) details.push({ label: `1v5 (x${c.c5})`, type: 'ace' });
                                            if (c.c4 > 0) details.push({ label: `1v4 (x${c.c4})`, type: 'hard' });
                                            if (c.c3 > 0) details.push({ label: `1v3 (x${c.c3})`, type: 'mid' });
                                            if (c.c2 > 0) details.push({ label: `1v2 (x${c.c2})`, type: 'low' });
                                            if (c.c1 > 0) details.push({ label: `1v1 (x${c.c1})`, type: 'base' });

                                            return (
                                                <tr key={i} className={`row-hover stagger-item stagger-${Math.min((i % 10) + 1, 10)}`} onClick={() => navigate(`/matches/${c.matchId}`)} style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: 'pointer' }}>
                                                    <td style={{ padding: '12px', color: themeColors.textMuted }}>{formatMatchDate('', String(c.date || '')).split('|')[0]}</td>
                                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{c.map.replace('de_', '')}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            {details.map((d, idx) => (
                                                                <span key={idx} style={{ background: d.type === 'ace' ? themeColors.accent : (d.type === 'hard' || d.type === 'mid' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255,255,255,0.1)'), color: d.type === 'ace' ? '#000' : (d.type === 'hard' || d.type === 'mid' ? '#4ade80' : '#fff'), padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{d.label}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#fbbf24' }}>+{c.points}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'advanced' && subTab === 'multikills' && (
                    <div className="fade-in">
                        <div className="stagger-container" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
                            <div className="stagger-item stagger-1" style={{ flex: 1, minWidth: '120px' }}><ClutchCard label="3 Килла" value={stats.extendedStats.rounds3} /></div>
                            <div className="stagger-item stagger-2" style={{ flex: 1, minWidth: '120px' }}><ClutchCard label="4 Килла" value={stats.extendedStats.rounds4} /></div>
                            <div className="stagger-item stagger-3" style={{ flex: 1, minWidth: '120px' }}><ClutchCard label="5 Киллов (Ace)" value={stats.extendedStats.rounds5} /></div>
                        </div>
                        <div className="glass fade-in" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', background: 'rgba(0,0,0,0.3)', fontWeight: 'bold', borderBottom: `1px solid ${themeColors.border}` }}>История мультикиллов</div>
                            <div className="mobile-scroll">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.05)', color: themeColors.textMuted }}>
                                            <SortHeader label="Дата" sortKey="date" sortState={mkSort} setSortState={setMkSort} />
                                            <SortHeader label="Карта" sortKey="map" sortState={mkSort} setSortState={setMkSort} />
                                            <SortHeader label="Раунд" sortKey="round" sortState={mkSort} setSortState={setMkSort} />
                                            <SortHeader label="Убийства" sortKey="kills" sortState={mkSort} setSortState={setMkSort} />
                                            <th style={{ padding: '12px' }}>Тип</th>
                                        </tr>
                                    </thead>
                                    <tbody className="stagger-container">
                                        {sortedMultiKills.map((mk, i: number) => (
                                            <tr key={i} className={`row-hover stagger-item stagger-${Math.min((i % 10) + 1, 10)}`} onClick={() => navigate(`/matches/${mk.matchId}`)} style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: 'pointer' }}>
                                                <td style={{ padding: '12px', color: themeColors.textMuted }}>{formatMatchDate('', String(mk.date || '')).split('|')[0]}</td>
                                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{mk.map.replace('de_', '')}</td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>{mk.round}</td>
                                                <td style={{ padding: '12px', textAlign: 'center', fontWeight: '900', color: mk.kills === 5 ? themeColors.accent : '#fff' }}>{mk.kills}</td>
                                                <td style={{ padding: '12px', color: mk.result === 'Entry' ? themeColors.win : themeColors.textMuted, textAlign: 'right' }}>{mk.result === 'Entry' ? 'Энтри' : 'Защита'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'advanced' && subTab === 'social' && (
                    <div className="fade-in">
                        <div className="stagger-container" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                            {socialStats.bestTeammate && (
                                <div className="glass stagger-item stagger-1" style={{ flex: '1 1 250px', padding: '20px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(0,0,0,0))' }}>
                                    <div style={{ fontSize: '32px' }}>🤝</div>
                                    <div style={{ fontSize: '11px', color: themeColors.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginTop: '5px' }}>Идеальный напарник</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '5px 0' }}>{socialStats.bestTeammate.name}</div>
                                    <div style={{ fontSize: '12px', color: themeColors.win }}>{socialStats.bestTeammate.winRateWith.toFixed(0)}% Винрейт (вместе)</div>
                                </div>
                            )}
                            {socialStats.victim && (
                                <div className="glass stagger-item stagger-2" style={{ flex: '1 1 250px', padding: '20px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(0,0,0,0))' }}>
                                    <div style={{ fontSize: '32px' }}>🎯</div>
                                    <div style={{ fontSize: '11px', color: themeColors.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginTop: '5px' }}>Любимая жертва</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '5px 0' }}>{socialStats.victim.name}</div>
                                    <div style={{ fontSize: '12px', color: themeColors.accent }}>+{socialStats.victim.kdDiff} (K/D Diff)</div>
                                    <div style={{ fontSize: '10px', color: themeColors.textMuted }}>{socialStats.victim.duelKills} киллов / {socialStats.victim.duelDeaths} смертей</div>
                                </div>
                            )}
                            {socialStats.nemesis && (
                                <div className="glass stagger-item stagger-3" style={{ flex: '1 1 250px', padding: '20px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(0,0,0,0))' }}>
                                    <div style={{ fontSize: '32px' }}>💀</div>
                                    <div style={{ fontSize: '11px', color: themeColors.textMuted, fontWeight: 'bold', textTransform: 'uppercase', marginTop: '5px' }}>Заклятый враг</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '5px 0' }}>{socialStats.nemesis.name}</div>
                                    <div style={{ fontSize: '12px', color: themeColors.loss }}>{socialStats.nemesis.kdDiff} (K/D Diff)</div>
                                    <div style={{ fontSize: '10px', color: themeColors.textMuted }}>{socialStats.nemesis.duelDeaths} смертей</div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px' }}>Список игроков</h3>
                            <input type="text" placeholder="Поиск..." value={socialSearch} onChange={(e) => setSocialSearch(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${themeColors.border}`, color: '#fff', padding: '8px 12px', borderRadius: '8px', outline: 'none' }} />
                        </div>

                        <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                            <div className="mobile-scroll">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '700px' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(0,0,0,0.3)', color: themeColors.textMuted, fontSize: '11px', textTransform: 'uppercase', textAlign: 'center' }}>
                                            <SortHeader label="Игрок" sortKey="name" sortState={socialSort} setSortState={setSocialSort} />
                                            <SortHeader label="Игр вместе" sortKey="gamesWith" sortState={socialSort} setSortState={setSocialSort} />
                                            <SortHeader label="Win%" sortKey="winRateWith" sortState={socialSort} setSortState={setSocialSort} />
                                            <SortHeader label="Игр против" sortKey="gamesAgainst" sortState={socialSort} setSortState={setSocialSort} />
                                            <SortHeader label="Win% (Vs)" sortKey="winRateAgainst" sortState={socialSort} setSortState={setSocialSort} />
                                            <SortHeader label="Дуэль (K-D)" sortKey="kdDiff" sortState={socialSort} setSortState={setSocialSort} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSocials.map((p) => (
                                            <tr key={p.id} className="row-hover" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                                                <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#fff', textAlign: 'left' }}>{p.name}</td>
                                                <td style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>{sideFilter === 'ALL' ? (p.gamesWith > 0 ? p.gamesWith : '-') : 'N/A'}</td>
                                                <td style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>{sideFilter === 'ALL' ? (p.gamesWith > 0 ? p.winRateWith.toFixed(0) + '%' : '-') : 'N/A'}</td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>{sideFilter === 'ALL' ? (p.gamesAgainst > 0 ? p.gamesAgainst : '-') : 'N/A'}</td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>{sideFilter === 'ALL' ? (p.gamesAgainst > 0 ? p.winRateAgainst.toFixed(0) + '%' : '-') : 'N/A'}</td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <span style={{ color: themeColors.win }}>{p.duelKills}</span> - <span style={{ color: themeColors.loss }}>{p.duelDeaths}</span>
                                                    <span style={{ fontSize: '10px', color: themeColors.textMuted, marginLeft: '5px' }}>({p.kdDiff > 0 ? '+' : ''}{p.kdDiff})</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
};