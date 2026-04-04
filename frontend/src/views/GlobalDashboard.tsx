import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeColors } from '../utils';
import { aggregateGlobalStats } from '../utils/statsEngine';
import { useAppStore } from '../store';

export const GlobalDashboard: React.FC = () => {
    const { matches, aliases, merges } = useAppStore();
    const navigate = useNavigate();

    const { globalStats } = useMemo(() => {
        const aggs = aggregateGlobalStats(matches, aliases, merges);

        // Global Summaries
        let totalKills = 0;
        let totalDeaths = 0;
        let totalHS = 0;
        let ratingSum = 0;
        let ratingCount = 0;

        aggs.forEach(p => {
            totalKills += p.totalKills;
            totalDeaths += p.totalDeaths;
            totalHS += p.totalHeadshots;
            // Weighted average for global rating
            if (p.roundsPlayed > 0) {
                ratingSum += p.rating * p.roundsPlayed;
                ratingCount += p.roundsPlayed;
            }
        });

        const gStats = {
            matches: matches.length,
            players: aggs.length,
            totalKills: totalKills,
            kd: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2),
            avgRating: ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : "0.00",
            hs: totalKills > 0 ? Math.round((totalHS / totalKills) * 100) : 0
        };

        return {
            aggregated: aggs,
            globalStats: gStats
        };
    }, [matches, aliases, merges]);

    if (matches.length === 0) {
        return (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: themeColors.textMuted }}>
                <div style={{ fontSize: '18px' }}>Нет данных</div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <h2 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '24px', letterSpacing: '-1px' }}>Дашборд</h2>

            {/* 🏆 2025 REWIND BANNER */}
            <div onClick={() => navigate('/year-review')} className="glass-hover" style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
                padding: '30px',
                borderRadius: '24px',
                marginBottom: '40px',
                cursor: 'pointer',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: '#f59e0b', letterSpacing: '1px' }}>2025 REWIND</h3>
                    <p style={{ margin: '8px 0 0 0', color: themeColors.textMuted, fontSize: '15px', fontWeight: '500' }}>Твоя личная история побед в одном месте.</p>
                </div>
            </div>

            {/* --- GLOBAL STATS CARDS --- */}
            <div className="stats-grid stagger-container">
                {[
                    { label: 'Матчей', value: globalStats.matches, color: '#fff' },
                    { label: 'Игроков', value: globalStats.players, color: themeColors.accent },
                    { label: 'Киллов', value: globalStats.totalKills.toLocaleString(), color: '#fff' },
                    { label: 'Avg K/D', value: globalStats.kd, color: parseFloat(globalStats.kd) >= 1 ? themeColors.win : themeColors.loss },
                    { label: 'Rating', value: globalStats.avgRating, color: themeColors.accent },
                    { label: 'HS%', value: globalStats.hs + '%', color: '#fff' },
                ].map((stat, i) => (
                    <div key={i} className={`glass gradient-card stagger-item stagger-${(i % 10) + 1}`} style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ color: themeColors.textMuted, fontSize: '12px', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '1.5px' }}>{stat.label}</div>
                        <div style={{ fontSize: '32px', fontWeight: '900', marginTop: '8px', color: stat.color }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '40px', textAlign: 'center', paddingBottom: '40px' }}>
                <button
                    onClick={() => navigate('/players')}
                    className="btn-hover glass"
                    style={{
                        padding: '14px 40px', background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                        fontWeight: '800', fontSize: '14px', borderRadius: '15px', cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: '1px'
                    }}
                >
                    Перейти к списку всех игроков
                </button>
            </div>
        </div>
    );
};