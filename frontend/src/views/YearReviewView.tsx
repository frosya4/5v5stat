import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeColors, getMapGradient, getRatingColor } from '../utils';
import type { PlayerStat, KillEvent, RoundHistory, WeaponStat } from '../types';
import { useAppStore } from '../store';

// --- БЕНЧМАРКИ (СРЕДНИЕ ПОКАЗАТЕЛИ ОБЫЧНОГО ИГРОКА) ---
const BENCHMARKS = {
    utilDmgPerMap: 90,      // Средний урон гранатами за карту
    sniperShare: 20,        // % убийств с AWP от общего числа
    entryAttempts: 3.5,     // Попыток энтри за карту (FK + FD) / Maps
    clutchWinRate: 0.3,     // Клатчей за карту
    kast: 72.0,             // % KAST (участие в раунде)
    adr: 75.0,              // Средний урон
    survival: 35.0,         // % Выживания
    kd: 1.0                 // K/D
};

// --- СТИЛИ ИГРЫ ---
interface Playstyle {
    id: string;
    title: string;
    emoji: string;
    funDescription: string;
    seriousDescription: string;
    color: string;
}

const PLAYSTYLES: Playstyle[] = [
    {
        id: 'utility_master',
        title: 'Гений Раскида',
        emoji: '',
        funDescription: 'Ты знаешь лайнапы даже для того, чтобы выйти в туалет. Враги постоянно горят и взрываются.',
        seriousDescription: `Ваш урон гранатами на ${(BENCHMARKS.utilDmgPerMap * 0.4).toFixed(0)}+ ед. выше среднего по больнице.`,
        color: '#818cf8' // Indigo
    },
    {
        id: 'smoke_criminal',
        title: 'Smoke Criminal',
        emoji: '',
        funDescription: 'Проходишь сквозь стены, живешь в смоках. Тебя ненавидят, потому что тебя невозможно найти и убить.',
        seriousDescription: `Высокий KAST (> ${BENCHMARKS.kast}%) and выживаемость. Вы полезны команде, редко умираете первым, но не гонитесь за фрагами.`,
        color: '#94a3b8' // Slate/Grey
    },
    {
        id: 'entry_fragger',
        title: 'Безумный Макс',
        emoji: '',
        funDescription: 'Кнопка "S" (назад) у тебя выломана. Ты влетаешь в сайт раньше флешек.',
        seriousDescription: `Вы ищете первый контакт (Entry Duel) в 1.3 раза чаще среднего игрока. Вы создаете пространство.`,
        color: '#f87171' // Red
    },
    {
        id: 'awp_abuser',
        title: 'Снайпер-Соляга',
        emoji: '',
        funDescription: 'Сейвишь AWP даже в 1v1. Твой зум слышно чаще, чем шаги.',
        seriousDescription: `Более 35% ваших убийств сделаны со снайперских винтовок. Вы — мейн снайпер.`,
        color: '#34d399' // Emerald
    },
    {
        id: 'clutch_king',
        title: 'CEO of Clutch',
        emoji: '',
        funDescription: 'Остаешься 1 в 3 ради хайлайтов. Тиммейты пьют валерьянку, пока ты крадешься на шифте.',
        seriousDescription: `Вы выигрываете клатчи в 2 раза чаще обычного игрока.`,
        color: '#a78bfa' // Purple
    },
    {
        id: 'turret',
        title: 'Турель',
        emoji: '',
        funDescription: 'Встал в точку и стоишь. Тебя не сдвинуть даже бульдозером. Стабильность — твое второе имя.',
        seriousDescription: `Высокий K/D (> 1.2) и мало смертей. Вы идеально держите позиции (Anchor) и наказываете за ошибки.`,
        color: '#fb923c' // Orange
    },
    {
        id: 'balanced',
        title: 'Универсал',
        emoji: '',
        funDescription: 'Играешь по кайфу. Иногда тащишь, иногда фидишь. Главное — участие!',
        seriousDescription: 'Ваша статистика находится в пределах нормы. Нет явных перекосов в агрессию или пассивность.',
        color: '#FFD700' // Gold
    }
];

// --- ЛОГИКА ОПРЕДЕЛЕНИЯ (ОТНОСИТЕЛЬНО СРЕДНЕГО) ---
const determinePlaystyle = (s: { maps: number, avgUtil?: number, totalFk: number, totalFd?: number, clutches: number, sniperShare?: number, kast?: string | number, adr?: string | number, kd?: string | number } | null): Playstyle => {
    if (!s || s.maps === 0) return PLAYSTYLES.find(p => p.id === 'balanced')!;

    const myUtilPerMap = s.avgUtil || 0;
    const myEntriesPerMap = s.maps > 0 ? (s.totalFk + (s.totalFd || 0)) / s.maps : 0;
    const myClutchesPerMap = s.maps > 0 ? s.clutches / s.maps : 0;
    const mySniperShare = s.sniperShare || 0;

    // Парсим числа
    const myKast = typeof s.kast === 'string' ? parseFloat(s.kast) : (Number(s.kast) || 0);
    const myAdr = typeof s.adr === 'string' ? parseFloat(s.adr) : (Number(s.adr) || 0);
    const myKd = typeof s.kd === 'string' ? parseFloat(s.kd) : (Number(s.kd) || 0);

    // 1. СНАЙПЕР (Если доля снайперских киллов > 35%)
    if (mySniperShare > 35) return PLAYSTYLES.find(p => p.id === 'awp_abuser')!;

    // 2. УТИЛИТА (В 1.4 раза больше среднего урона)
    if (myUtilPerMap > BENCHMARKS.utilDmgPerMap * 1.4) return PLAYSTYLES.find(p => p.id === 'utility_master')!;

    // 3. ЭНТРИ (В 1.3 раза активнее среднего)
    if (myEntriesPerMap > BENCHMARKS.entryAttempts * 1.3) return PLAYSTYLES.find(p => p.id === 'entry_fragger')!;

    // 4. КЛАТЧЕР (В 1.8 раза чаще берет клатчи)
    if (myClutchesPerMap > BENCHMARKS.clutchWinRate * 1.8 && s.maps > 3) return PLAYSTYLES.find(p => p.id === 'clutch_king')!;

    // 5. SMOKE CRIMINAL (Высокий KAST + Низкий ADR + Мало смертей + Хороший K/D)
    // "Я полезен, я не умираю, но я не набиваю 100 урона за раунд"
    if (myKast > BENCHMARKS.kast && myAdr < (BENCHMARKS.adr + 5) && myKd > 1.05) {
        return PLAYSTYLES.find(p => p.id === 'smoke_criminal')!;
    }

    // 6. ТУРЕЛЬ (Много киллов, мало смертей, пассивный энтри)
    if (myKd > 1.25 && myEntriesPerMap < BENCHMARKS.entryAttempts) return PLAYSTYLES.find(p => p.id === 'turret')!;

    // Дефолт
    return PLAYSTYLES.find(p => p.id === 'balanced')!;
};

const normalizeSide = (side: string | null | undefined): string => {
    if (side === undefined || side === null) return '';
    const s = String(side).toUpperCase();
    if (s === '2' || s === 'T' || s === 'TERRORIST') return 'T';
    if (s === '3' || s === 'CT' || s === 'CTERRORIST') return 'CT';
    return '';
};

export const YearReviewView: React.FC = () => {
    const { matches, aliases } = useAppStore();
    const navigate = useNavigate();
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    // Слайдер
    const [activeSlide, setActiveSlide] = useState(0);
    const sliderRef = useRef<HTMLDivElement>(null);

    // Модалки
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showStyleTooltip, setShowStyleTooltip] = useState(false);

    // Сравнение со средним
    const [showAverage, setShowAverage] = useState(false);

    const matches2025 = useMemo(() => {
        return matches.filter(m => m.upload_date.includes('2025') || m.filename.includes('2025'));
    }, [matches]);

    const globalAverage = useMemo(() => ({
        rating: 1.0, swing: 3.5, dpr: 0.67, kast: 70.0, multi: 15.0, adr: 75.0, kpr: 0.70
    }), []);

    const playersList = useMemo(() => {
        const map: Record<string, { id: string, name: string, count: number }> = {};
        matches2025.forEach(m => {
            m.players.forEach((p: PlayerStat) => {
                const id = p.steamid || p.name;
                const displayName = aliases[id] || p.name || id;
                if (!map[id]) map[id] = { id, name: displayName, count: 0 };
                map[id].count++;
                if (map[id].name.startsWith('7656') && p.name) map[id].name = p.name;
            });
        });
        return Object.values(map).sort((a, b) => b.count - a.count);
    }, [matches2025, aliases]);

    const stats = useMemo(() => {
        if (!selectedPlayerId) return null;

        let totalKills = 0, totalDeaths = 0, totalHeadshots = 0;
        let wins = 0, totalMaps = 0, totalRounds = 0;
        let clutches = 0, multikills = 0;
        let totalFk = 0, totalFd = 0;
        let totalUtilDmg = 0;
        let rifleKills = 0, sniperKills = 0;
        let totalRating = 0;
        let totalDamage = 0;
        let swingRounds = 0;
        let totalKastRounds = 0;

        let killsT = 0, roundsT = 0;
        let killsCT = 0, roundsCT = 0;

        const weaponMap: Record<string, number> = {};

        // Статистика карт для Power Score
        const mapStats: Record<string, { played: number, wins: number, losses: number, ratingSum: number, realName: string }> = {};

        let lastKnownName = aliases[selectedPlayerId] || selectedPlayerId;

        matches2025.forEach(m => {
            const p = m.players.find((pl: PlayerStat) => pl.steamid === selectedPlayerId || pl.name === selectedPlayerId);
            if (!p) return;

            if (!aliases[selectedPlayerId] && p.name) lastKnownName = p.name;

            // 🔥 FIX: Принудительные числа
            const matchRating = Number(p.rating_3 || p.rating || 1.0);
            const scoreT = Number(m.final_score_t);
            const scoreCT = Number(m.final_score_ct);

            totalMaps++;
            totalRounds += m.rounds_count;
            totalKills += p.kills;
            totalDeaths += p.deaths;
            totalHeadshots += p.hs;
            totalRating += matchRating;
            totalDamage += (p.adr * m.rounds_count);

            totalFk += p.fk || 0;
            totalFd += p.fd || 0;
            totalUtilDmg += p.util_dmg || 0;
            clutches += (p.clutches_1v1 || 0) + (p.clutches_1v2 || 0) + (p.clutches_1v3 || 0) + (p.clutches_1v4 || 0) + (p.clutches_1v5 || 0);

            // --- Анализ Раундов ---
            let startSide = 'CT';
            if (m.rounds_history && m.rounds_history.length > 0) {
                for (const r of m.rounds_history) {
                    if (r.kill_feed) {
                        const event = r.kill_feed.find((e: KillEvent) => e.killer === p.name || e.killer === p.steamid);
                        if (event) { startSide = normalizeSide(event.killer_team); break; }
                    }
                }
            }

            if (m.rounds_history) {
                let currentSide = startSide;
                m.rounds_history.forEach((r: RoundHistory) => {
                    const rn = r.round_num;
                    if (rn === 13) currentSide = startSide === 'CT' ? 'T' : 'CT';

                    let playerRoundSide = currentSide;
                    if (r.kill_feed) {
                        for (const event of r.kill_feed) {
                            if (event.killer === p.steamid || event.killer === p.name) {
                                playerRoundSide = normalizeSide(event.killer_team);
                                break;
                            }
                        }
                    }

                    if (playerRoundSide === 'T') roundsT++;
                    else if (playerRoundSide === 'CT') roundsCT++;

                    let hasKill = false;
                    let hasAssist = false;
                    let survived = true;
                    let roundKills = 0;

                    if (r.kill_feed) {
                        r.kill_feed.forEach((event: KillEvent) => {
                            const killer = event.killer || event.attacker_name || event.attacker;
                            const victim = event.victim || event.victim_name;
                            const assister = event.assister || event.assister_name;

                            if (killer === p.steamid || killer === p.name) {
                                if (killer !== victim) {
                                    hasKill = true;
                                    roundKills++;
                                    if (playerRoundSide === 'T') killsT++;
                                    else if (playerRoundSide === 'CT') killsCT++;
                                }
                            }
                            if (assister === p.steamid || assister === p.name) hasAssist = true;
                            if (victim === p.steamid || victim === p.name) survived = false;
                        });
                    }

                    if (hasKill || hasAssist || survived) totalKastRounds++;
                    if (roundKills >= 3) multikills++;

                    const winnerSide = normalizeSide(r.winner_side || r.winner_team);
                    if (roundKills >= 2 && winnerSide && playerRoundSide === winnerSide) {
                        swingRounds++;
                    }
                });
            } else {
                multikills += (p.k3 || 0) + (p.k4 || 0) + (p.k5 || 0);
                if (p.kast) totalKastRounds += (p.kast / 100) * m.rounds_count;
            }

            if (p.weapons) {
                p.weapons.forEach((w: WeaponStat) => {
                    const rawName = String(w.name).replace('weapon_', '');
                    const name = rawName.toLowerCase().trim();
                    weaponMap[rawName] = (weaponMap[rawName] || 0) + w.kills;
                    if (['ak47', 'm4a1', 'm4a4', 'galil', 'famas', 'aug', 'sg556', 'sg553'].some(n => name.includes(n))) rifleKills += w.kills;
                    else if (['awp', 'ssg08', 'g3sg1', 'scar20'].some(n => name.includes(n))) sniperKills += w.kills;
                });
            }

            // Победитель матча
            const myTeam = String(p.team).includes('T') ? 'T' : 'CT';
            const winner = scoreT > scoreCT ? 'T' : (scoreCT > scoreT ? 'CT' : 'DRAW');
            const isWin = myTeam === winner;
            const isLoss = !isWin && winner !== 'DRAW';

            if (isWin) wins++;

            // 🔥 FIX: Нормализация имени карты
            const mapKey = m.map.toLowerCase().replace('de_', '').trim();
            if (!mapStats[mapKey]) mapStats[mapKey] = { played: 0, wins: 0, losses: 0, ratingSum: 0, realName: m.map };

            mapStats[mapKey].played++;
            mapStats[mapKey].ratingSum += matchRating;

            if (isWin) mapStats[mapKey].wins++;
            if (isLoss) mapStats[mapKey].losses++;
        });

        const favWeapon = Object.entries(weaponMap).sort((a, b) => b[1] - a[1])[0];

        // --- BEST MAP CALCULATION (Power Score) ---
        // Formula: (Wins * 2) + (Rating Sum * 1) - (Losses * 1)
        // Formula: (Wins * 2) + (Rating Sum * 1) - (Losses * 1)
        const bestMapEntry = Object.entries(mapStats).sort((a, b) => {
            const calcScore = (s: typeof mapStats[string]) => {
                return (s.wins * 2.0) + (s.ratingSum * 1.0) - (s.losses * 1.0);
            };
            const sA = calcScore(a[1]);
            const sB = calcScore(b[1]);
            return sB - sA;
        })[0];

        const bestMapName = bestMapEntry ? bestMapEntry[1].realName : 'N/A';

        const openingAttempts = totalFk + totalFd;
        const entrySuccess = openingAttempts > 0 ? Math.round((totalFk / openingAttempts) * 100) : 0;
        const sniperShare = totalKills > 0 ? Math.round((sniperKills / totalKills) * 100) : 0;
        const rifleShare = totalKills > 0 ? Math.round((rifleKills / totalKills) * 100) : 0;

        const avgRating = totalMaps > 0 ? (totalRating / totalMaps).toFixed(2) : "0.00";
        const calcRatingT = roundsT > 0 ? (killsT / roundsT).toFixed(2) : "N/A";
        const calcRatingCT = roundsCT > 0 ? (killsCT / roundsCT).toFixed(2) : "N/A";

        const adr = totalRounds > 0 ? (totalDamage / totalRounds).toFixed(1) : "0";
        const kpr = totalRounds > 0 ? (totalKills / totalRounds).toFixed(2) : "0";
        const dpr = totalRounds > 0 ? (totalDeaths / totalRounds).toFixed(2) : "0";
        const multiKillRate = totalRounds > 0 ? ((multikills / totalRounds) * 100).toFixed(1) : "0";
        const swingRate = totalRounds > 0 ? ((swingRounds / totalRounds) * 100).toFixed(2) : "0.00";
        const kast = totalRounds > 0 ? ((totalKastRounds / totalRounds) * 100).toFixed(1) : "0.0";

        return {
            name: lastKnownName,
            maps: totalMaps,
            wins,
            winrate: totalMaps > 0 ? Math.round((wins / totalMaps) * 100) : 0,
            kills: totalKills,
            kd: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills,
            hs: totalKills > 0 ? Math.round((totalHeadshots / totalKills) * 100) : 0,
            favWeapon: favWeapon ? favWeapon[0] : 'N/A',
            favWeaponKills: favWeapon ? favWeapon[1] : 0,
            bestMap: bestMapName,
            clutches,
            multikills,
            entrySuccess,
            totalFk,
            totalFd,
            totalUtilDmg,
            avgUtil: totalMaps > 0 ? Math.round(totalUtilDmg / totalMaps) : 0,
            sniperShare,
            rifleShare,
            avgRating,
            avgRatingT: calcRatingT,
            avgRatingCT: calcRatingCT,
            adr, kpr, dpr, multiKillRate, swingRate, kast
        };
    }, [selectedPlayerId, matches2025, aliases]);

    // Определяем стиль игрока
    const myPlaystyle = useMemo(() => determinePlaystyle(stats), [stats]);

    const handleScroll = () => {
        if (sliderRef.current) {
            const scrollLeft = sliderRef.current.scrollLeft;
            const width = sliderRef.current.offsetWidth;
            const index = Math.round(scrollLeft / width);
            setActiveSlide(index);
        }
    };

    const scrollToSlide = (index: number) => {
        if (sliderRef.current) {
            sliderRef.current.scrollTo({
                left: index * sliderRef.current.offsetWidth,
                behavior: 'smooth'
            });
        }
    };

    const StatBar = ({ label, value, sub, avg, highIsGood = true }: { label: string, value: string | number, sub?: string, avg?: number, highIsGood?: boolean }) => {
        const valNum = parseFloat(String(value));
        let percent = 0;
        let color = '#fff';

        if (showAverage && !isNaN(valNum) && avg) {
            const diff = highIsGood ? (valNum - avg) : (avg - valNum);
            const ratio = diff / avg;
            percent = 50 + (ratio * 100);
            if (percent > 100) percent = 100;
            if (percent < 5 && percent > 0) percent = 5;
            if (percent <= 0) percent = 0;

            if (highIsGood) color = valNum >= avg ? '#4ade80' : '#fff';
            else color = valNum <= avg ? '#4ade80' : '#fff';
        } else {
            percent = 0;
            color = '#fff';
        }

        return (
            <div style={{ textAlign: 'center', padding: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: color }}>
                    {value}{sub && <span style={{ fontSize: '14px', fontWeight: 'bold', marginLeft: '2px' }}>{sub}</span>}
                </div>
                <div style={{ fontSize: '11px', color: themeColors.textMuted, marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</div>

                <div style={{ position: 'relative', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '5px', overflow: 'visible' }}>
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${percent}%`,
                        background: `linear-gradient(90deg, transparent 0%, ${color} 100%)`,
                        opacity: 0.7,
                        transition: 'width 0.3s ease'
                    }}></div>

                    {showAverage && (
                        <>
                            <div style={{ position: 'absolute', left: '50%', top: '-3px', bottom: '-3px', width: '2px', background: '#666' }}></div>
                            <div style={{ position: 'absolute', left: '50%', top: '6px', transform: 'translateX(-50%)', fontSize: '8px', color: '#666', fontWeight: 'bold' }}>Avg.</div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fade-in" style={{ paddingBottom: '50px' }}>
            {/* Header + Info Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <button onClick={() => navigate(-1)} style={{ background: themeColors.bg, border: `1px solid ${themeColors.border}`, color: themeColors.textMuted, cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontWeight: '600' }}>← Назад</button>
                <button
                    onClick={() => setShowInfoModal(true)}
                    style={{ background: 'transparent', border: `1px solid ${themeColors.border}`, color: themeColors.accent, width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Как это считается?"
                >
                    i
                </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '48px', fontWeight: '900', margin: '0', background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 10px 30px rgba(255, 215, 0, 0.3)' }}>2025 REWIND</h1>
                <p style={{ color: themeColors.textMuted, marginTop: '10px' }}>Твои главные достижения за год</p>
            </div>

            {/* INFO MODAL */}
            {showInfoModal && (
                <div onClick={() => setShowInfoModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div onClick={(e) => e.stopPropagation()} className="glass" style={{ width: '100%', maxWidth: '500px', background: '#1c1e26', borderRadius: '16px', padding: '25px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#FFD700' }}>Как мы считаем статистику?</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '13px', lineHeight: '1.5' }}>
                            <div>
                                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>🏆 Лучшая карта (Power Score)</strong>
                                Мы используем формулу "Очки Эффективности":<br />
                                <span style={{ color: themeColors.accent }}>(Победы × 2) + (Сумма Рейтинга × 1) - (Поражения × 1)</span><br />
                                Это позволяет найти карту, где вы и побеждаете, и жестко настреливаете на дистанции.
                            </div>

                            <div>
                                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>📊 Рейтинг 2.0 (Kill Rating)</strong>
                                Если парсер не отдает полный HLTV 2.0, мы используем "Kill Rating" = (Убийства / Раунды). Для сторон T и CT рейтинг рассчитывается отдельно.
                            </div>

                            <div>
                                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>🛡 KAST</strong>
                                Процент раундов, в которых вы сделали Килл, Ассист, выжили или были разменены. Показывает вашу полезность для команды.
                            </div>

                            <div>
                                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>🔄 Round Swing</strong>
                                Процент раундов, где вы сделали 2+ убийства, и ваша команда ВЫИГРАЛА раунд. Это показывает ваше прямое влияние на победу.
                            </div>

                            <div>
                                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>📈 Entry Success</strong>
                                Процент успешных первых дуэлей. Считается как: (Первые убийства) / (Первые убийства + Первые смерти).
                            </div>
                        </div>

                        <button onClick={() => setShowInfoModal(false)} style={{ marginTop: '25px', width: '100%', padding: '12px', background: themeColors.accent, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Понятно</button>
                    </div>
                </div>
            )}

            {!selectedPlayerId ? (
                <div className="glass" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', borderRadius: '16px' }}>
                    <h3 style={{ marginTop: 0, textAlign: 'center' }}>Кто ты, воин?</h3>
                    <div className="mobile-scroll" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {playersList.map(p => (
                            <div key={p.id} onClick={() => setSelectedPlayerId(p.id)} className="row-hover" style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                                <span style={{ color: themeColors.textMuted }}>{p.count} матчей</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                stats && (
                    <div style={{ maxWidth: '500px', margin: '0 auto' }}>

                        <div
                            ref={sliderRef}
                            onScroll={handleScroll}
                            style={{
                                display: 'flex',
                                overflowX: 'auto',
                                scrollSnapType: 'x mandatory',
                                gap: '20px',
                                scrollbarWidth: 'none',
                                paddingBottom: '20px'
                            }}
                            className="mobile-scroll"
                        >

                            {/* SLIDE 1 */}
                            <div style={{ minWidth: '100%', scrollSnapAlign: 'center', background: '#0f1014', border: '1px solid #FFD700', borderRadius: '24px', overflow: 'hidden', position: 'relative', boxShadow: '0 0 50px rgba(255, 215, 0, 0.1)' }}>
                                <div style={{ background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', padding: '30px', color: '#000', textAlign: 'center' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', opacity: 0.8, textTransform: 'uppercase' }}>Legend of 2025</div>
                                    <div style={{ fontSize: '32px', fontWeight: '900', margin: '5px 0', textTransform: 'uppercase' }}>{stats.name}</div>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{stats.maps} Матчей • {stats.wins} Побед</div>
                                </div>

                                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div className="glass" style={{ padding: '15px', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '12px', color: themeColors.textMuted }}>K/D Ratio</div>
                                        <div style={{ fontSize: '24px', fontWeight: '800', color: parseFloat(stats.kd as string) >= 1 ? '#4ade80' : '#fff' }}>{stats.kd}</div>
                                    </div>
                                    <div className="glass" style={{ padding: '15px', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '12px', color: themeColors.textMuted }}>Headshot %</div>
                                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff' }}>{stats.hs}%</div>
                                    </div>
                                    <div className="glass" style={{ gridColumn: '1 / -1', padding: '15px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div><div style={{ fontSize: '12px', color: themeColors.textMuted }}>Любимое оружие</div><div style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', color: '#FFD700' }}>{stats.favWeapon}</div></div>
                                        <div style={{ fontSize: '24px', fontWeight: '900' }}>{stats.favWeaponKills} <span style={{ fontSize: '12px', fontWeight: 'normal', color: themeColors.textMuted }}>Kills</span></div>
                                    </div>
                                    <div className="glass" style={{ padding: '15px', borderRadius: '12px', textAlign: 'center' }}><div style={{ fontSize: '12px', color: themeColors.textMuted }}>Клатчей</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>{stats.clutches}</div></div>
                                    <div className="glass" style={{ padding: '15px', borderRadius: '12px', textAlign: 'center' }}><div style={{ fontSize: '12px', color: themeColors.textMuted }}>Мультикиллов</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>{stats.multikills}</div></div>
                                    <div className="glass" style={{ gridColumn: '1 / -1', padding: '20px', borderRadius: '12px', textAlign: 'center', background: `linear-gradient(0deg, rgba(0,0,0,0.5), rgba(0,0,0,0.5)), ${getMapGradient(stats.bestMap)}`, backgroundSize: 'cover' }}>
                                        <div style={{ fontSize: '12px', color: '#fff', opacity: 0.8 }}>Лучшая карта</div>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#fff', textTransform: 'capitalize', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>{stats.bestMap.replace('de_', '')}</div>
                                    </div>
                                </div>
                            </div>

                            {/* SLIDE 2: PLAYSTYLE */}
                            <div style={{ minWidth: '100%', scrollSnapAlign: 'center', background: '#0f1014', border: '1px solid #FFD700', borderRadius: '24px', overflow: 'hidden', position: 'relative', boxShadow: '0 0 50px rgba(255, 215, 0, 0.1)' }}>

                                {/* 🔥 НОВАЯ ПЛАШКА СТИЛЯ */}
                                <div style={{
                                    background: `linear-gradient(135deg, ${myPlaystyle.color}20 0%, #000 100%)`,
                                    padding: '30px 20px',
                                    textAlign: 'center',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    position: 'relative'
                                }}>
                                    <div
                                        onClick={() => setShowStyleTooltip(!showStyleTooltip)}
                                        style={{
                                            position: 'absolute', top: '20px', right: '20px', width: '24px', height: '24px', borderRadius: '50%',
                                            border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: 'bold',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
                                        }}
                                    >?</div>

                                    {/* Tooltip */}
                                    {showStyleTooltip && (
                                        <div className="fade-in" style={{
                                            position: 'absolute', top: '50px', right: '20px', background: '#1c1e26',
                                            border: `1px solid ${myPlaystyle.color}`, padding: '15px', borderRadius: '12px',
                                            width: '250px', textAlign: 'left', zIndex: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: myPlaystyle.color, marginBottom: '5px' }}>
                                                Почему "{myPlaystyle.title}"?
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
                                                {myPlaystyle.seriousDescription}
                                            </div>
                                            <div onClick={() => setShowStyleTooltip(false)} style={{ textAlign: 'right', marginTop: '10px', fontSize: '11px', color: '#666', cursor: 'pointer' }}>Закрыть</div>
                                        </div>
                                    )}
                                    {showStyleTooltip && <div onClick={() => setShowStyleTooltip(false)} style={{ position: 'fixed', inset: 0, zIndex: 15 }}></div>}

                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: myPlaystyle.color, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                                        Твой Стиль Игры
                                    </div>
                                    <div style={{ fontSize: '64px', marginBottom: '10px', textShadow: `0 0 30px ${myPlaystyle.color}50` }}>
                                        {myPlaystyle.emoji}
                                    </div>
                                    <div style={{ fontSize: '32px', fontWeight: '900', margin: '5px 0', color: '#fff', textTransform: 'uppercase' }}>
                                        {myPlaystyle.title}
                                    </div>
                                    <div style={{ fontSize: '14px', color: themeColors.textMuted, fontStyle: 'italic', maxWidth: '80%', margin: '15px auto 0' }}>
                                        "{myPlaystyle.funDescription}"
                                    </div>
                                </div>

                                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div className="glass" style={{ padding: '20px', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>Entry Success</span>
                                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: stats.entrySuccess > 50 ? '#4ade80' : '#f87171' }}>{stats.entrySuccess}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${stats.entrySuccess}%`, height: '100%', background: stats.entrySuccess > 50 ? '#4ade80' : '#f87171' }}></div>
                                        </div>
                                        <div style={{ fontSize: '11px', color: themeColors.textMuted, marginTop: '8px' }}>
                                            Сделано {stats.totalFk} первых убийств
                                        </div>
                                    </div>

                                    <div className="glass" style={{ padding: '20px', borderRadius: '12px', display: 'flex', gap: '20px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '12px', color: themeColors.textMuted, marginBottom: '5px' }}>Rifle Kills</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.rifleShare}%</div>
                                        </div>
                                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '12px', color: themeColors.textMuted, marginBottom: '5px' }}>Sniper Kills</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.sniperShare}%</div>
                                        </div>
                                    </div>

                                    <div className="glass" style={{ padding: '20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: themeColors.accent }}>UTIL</div>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFD700' }}>{stats.totalUtilDmg}</div>
                                            <div style={{ fontSize: '12px', color: themeColors.textMuted }}>Урона гранатами (~{stats.avgUtil} за карту)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SLIDE 3: ADVANCED RATINGS */}
                            <div style={{ minWidth: '100%', scrollSnapAlign: 'center', background: '#0f1014', border: '1px solid #FFD700', borderRadius: '24px', overflow: 'hidden', position: 'relative', boxShadow: '0 0 50px rgba(255, 215, 0, 0.1)' }}>
                                <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: themeColors.textMuted }}>
                                        <input
                                            type="checkbox"
                                            checked={showAverage}
                                            onChange={(e) => setShowAverage(e.target.checked)}
                                            style={{ accentColor: themeColors.accent }}
                                        />
                                        Show player average
                                    </label>
                                </div>

                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', maxWidth: '300px', margin: '0 auto' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '24px', fontWeight: '900', color: stats.avgRatingT !== "N/A" ? themeColors.t : themeColors.textMuted }}>{stats.avgRatingT}</div>
                                            <div style={{ fontSize: '10px', color: themeColors.textMuted, fontWeight: 'bold' }}>T RATING</div>
                                        </div>

                                        <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '8px solid rgba(255,255,255,0.1)' }}></div>
                                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '8px solid transparent', borderTopColor: getRatingColor(parseFloat(stats.avgRating)), transform: 'rotate(-45deg)' }}></div>
                                            <div style={{ zIndex: 2, textAlign: 'center' }}>
                                                <div style={{ fontSize: '10px', fontWeight: 'bold', color: getRatingColor(parseFloat(stats.avgRating)), marginBottom: '0' }}>RATING 2.0</div>
                                                <div style={{ fontSize: '42px', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{stats.avgRating}</div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '24px', fontWeight: '900', color: stats.avgRatingCT !== "N/A" ? themeColors.ct : themeColors.textMuted }}>{stats.avgRatingCT}</div>
                                            <div style={{ fontSize: '10px', color: themeColors.textMuted, fontWeight: 'bold' }}>CT RATING</div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <StatBar label="Round Swing" value={`${stats.swingRate}%`} sub="" avg={globalAverage.swing} />
                                    </div>
                                    <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <StatBar label="DPR" value={stats.dpr} sub="" avg={globalAverage.dpr} highIsGood={false} />
                                    </div>
                                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <StatBar label="KAST" value={stats.kast} sub={stats.kast !== "N/A" ? "%" : ""} avg={globalAverage.kast} />
                                    </div>
                                    <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                        <StatBar label="Multi-Kill" value={`${stats.multiKillRate}%`} sub="" avg={globalAverage.multi} />
                                    </div>
                                    <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                        <StatBar label="ADR" value={stats.adr} sub="" avg={globalAverage.adr} />
                                    </div>
                                    <div>
                                        <StatBar label="KPR" value={stats.kpr} sub="" avg={globalAverage.kpr} />
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                            <div onClick={() => scrollToSlide(0)} style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeSlide === 0 ? '#FFD700' : 'rgba(255, 255, 255, 0.2)', cursor: 'pointer', transition: '0.3s' }}></div>
                            <div onClick={() => scrollToSlide(1)} style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeSlide === 1 ? '#FFD700' : 'rgba(255, 255, 255, 0.2)', cursor: 'pointer', transition: '0.3s' }}></div>
                            <div onClick={() => scrollToSlide(2)} style={{ width: '10px', height: '10px', borderRadius: '50%', background: activeSlide === 2 ? '#FFD700' : 'rgba(255, 255, 255, 0.2)', cursor: 'pointer', transition: '0.3s' }}></div>
                        </div>

                        <div style={{ padding: '0 20px', textAlign: 'center' }}>
                            <button onClick={() => setSelectedPlayerId(null)} style={{ background: 'transparent', border: 'none', color: themeColors.textMuted, fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Выбрать другого игрока</button>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};