import React, { useState } from 'react';
import type { PlayerStat, DemoResponse } from '../types';
import { getRatingColor, themeColors } from '../utils';

// ─── Helpers ─────────────────────────────────────────────────────

const fmt1 = (n: number | undefined) => (n ?? 0).toFixed(1);
const fmt2 = (n: number | undefined) => (n ?? 0).toFixed(2);
const fmt3 = (n: number | undefined) => (n ?? 0).toFixed(3);
const pct = (n: number | undefined) => `${(n ?? 0).toFixed(1)}%`;

function kastPct(p: PlayerStat, totalRounds: number): number {
    if (!totalRounds) return 0;
    const k = p.kast_kill ?? 0;
    const a = p.kast_assist ?? 0;
    const s = p.kast_survived ?? 0;
    const t = p.kast_traded ?? 0;
    // Union — a round contributes if any flag fired.
    // We use the stored kast float if breakdown fields not yet populated (old matches).
    if (k + a + s + t > 0) {
        // Approximate via the max possible rounds contributed
        return Math.min(100, (p.kast ?? 0));
    }
    return p.kast ?? 0;
}

const CELL: React.CSSProperties = {
    padding: '10px 8px',
    textAlign: 'center',
    fontSize: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    whiteSpace: 'nowrap',
};
const HEAD: React.CSSProperties = {
    ...CELL,
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    color: themeColors.textMuted,
    fontWeight: 700,
    letterSpacing: '0.5px',
    paddingBottom: '8px',
};

// ─── Scoreboard ───────────────────────────────────────────────────

function Scoreboard({ players, totalRounds, side, color }: {
    players: PlayerStat[];
    totalRounds: number;
    side: string;
    color: string;
}) {
    const sorted = [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return (
        <div style={{ marginBottom: 24 }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: `linear-gradient(90deg, ${color}22 0%, transparent 80%)`,
                borderBottom: `2px solid ${color}`,
                borderRadius: '8px 8px 0 0',
            }}>
                <span style={{ fontWeight: 900, fontSize: 14, color, letterSpacing: 1 }}>{side}</span>
                <span style={{ fontSize: 11, color: themeColors.textMuted }}>{sorted.length} players</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                    <thead>
                        <tr>
                            <th style={{ ...HEAD, textAlign: 'left', paddingLeft: 14 }}>Player</th>
                            <th style={HEAD}>K / D / A</th>
                            <th style={HEAD}>ADR</th>
                            <th style={HEAD}>Rating</th>
                            <th style={HEAD}>KAST%</th>
                            <th style={HEAD}>HS%</th>
                            <th style={HEAD}>FK%</th>
                            <th style={HEAD}>FK</th>
                            <th style={HEAD}>KPR</th>
                            <th style={HEAD}>DPR</th>
                            <th style={HEAD}>2K</th>
                            <th style={HEAD}>3K+</th>
                            <th style={HEAD}>UD</th>
                            <th style={HEAD}>Trade+</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((p) => {
                            const hsPct = p.kills > 0 ? (p.hs / p.kills) * 100 : 0;
                            const fkTotal = (p.fk ?? 0) + (p.fd ?? 0);
                            const fkPct = fkTotal > 0 ? (p.fk ?? 0) / fkTotal * 100 : 0;
                            const rating = p.rating ?? 0;
                            const ratingColor = getRatingColor(rating);
                            const kastVal = kastPct(p, totalRounds);

                            return (
                                <tr key={p.steamid} style={{ transition: 'background 0.15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                    <td style={{ ...CELL, textAlign: 'left', paddingLeft: 14, fontWeight: 600, color: '#fff' }}>
                                        {p.name}
                                    </td>
                                    <td style={CELL}>
                                        <span style={{ color: '#4ade80' }}>{p.kills}</span>
                                        <span style={{ color: themeColors.textMuted }}> / </span>
                                        <span style={{ color: '#f87171' }}>{p.deaths}</span>
                                        <span style={{ color: themeColors.textMuted }}> / </span>
                                        <span style={{ color: '#94a3b8' }}>{p.assists}</span>
                                    </td>
                                    <td style={CELL}>{fmt1(p.adr)}</td>
                                    <td style={{ ...CELL, fontWeight: 700, color: ratingColor }}>{fmt2(rating)}</td>
                                    <td style={{ ...CELL, color: kastVal >= 70 ? '#4ade80' : kastVal >= 50 ? '#facc15' : '#f87171' }}>
                                        {pct(kastVal)}
                                    </td>
                                    <td style={CELL}>{pct(hsPct)}</td>
                                    <td style={{ ...CELL, color: fkPct >= 55 ? '#4ade80' : fkPct >= 40 ? '#facc15' : '#f87171' }}>
                                        {pct(fkPct)}
                                    </td>
                                    <td style={CELL}>{p.fk ?? 0}</td>
                                    <td style={CELL}>{fmt3(p.kpr)}</td>
                                    <td style={CELL}>{fmt3(p.dpr)}</td>
                                    <td style={{ ...CELL, color: (p.k2 ?? 0) > 0 ? '#60a5fa' : undefined }}>{p.k2 ?? 0}</td>
                                    <td style={{ ...CELL, color: ((p.k3 ?? 0) + (p.k4 ?? 0) + (p.k5 ?? 0)) > 0 ? '#a78bfa' : undefined }}>
                                        {(p.k3 ?? 0) + (p.k4 ?? 0) + (p.k5 ?? 0)}
                                    </td>
                                    <td style={CELL}>{p.util_dmg ?? 0}</td>
                                    <td style={{ ...CELL, color: (p.trade_kills ?? 0) > 0 ? '#34d399' : undefined }}>
                                        {p.trade_kills ?? 0}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── KAST Breakdown ───────────────────────────────────────────────

function KASTBreakdown({ players, totalRounds: _totalRounds }: { players: PlayerStat[]; totalRounds: number }) {
    const sorted = [...players].sort((a, b) => (b.kast ?? 0) - (a.kast ?? 0));

    const pill = (label: string, val: number, color: string) => (
        <span key={label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: `${color}22`, border: `1px solid ${color}55`,
            borderRadius: 20, padding: '2px 10px', fontSize: 11,
            color,
        }}>
            <span style={{ fontWeight: 700 }}>{label}</span>
            <span style={{ opacity: 0.85 }}>{val}r</span>
        </span>
    );

    return (
        <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: themeColors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                KAST Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sorted.map(p => {
                    const k = p.kast_kill ?? 0;
                    const a = p.kast_assist ?? 0;
                    const s = p.kast_survived ?? 0;
                    const t = p.kast_traded ?? 0;
                    const kastVal = p.kast ?? 0;
                    const hasBreakdown = k + a + s + t > 0;

                    return (
                        <div key={p.steamid} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '8px 14px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <span style={{ minWidth: 140, fontWeight: 600, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                                {p.name}
                            </span>
                            <span style={{
                                minWidth: 54, fontWeight: 700, fontSize: 14,
                                color: kastVal >= 70 ? '#4ade80' : kastVal >= 50 ? '#facc15' : '#f87171',
                            }}>
                                {kastVal.toFixed(0)}%
                            </span>

                            {hasBreakdown ? (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {pill('K', k, '#4ade80')}
                                    {pill('A', a, '#60a5fa')}
                                    {pill('S', s, '#facc15')}
                                    {pill('T', t, '#a78bfa')}
                                </div>
                            ) : (
                                <span style={{ fontSize: 11, color: themeColors.textMuted, fontStyle: 'italic' }}>
                                    Upload a new demo to see K/A/S/T breakdown
                                </span>
                            )}

                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 120, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(kastVal, 100)}%`, background: kastVal >= 70 ? '#4ade80' : kastVal >= 50 ? '#facc15' : '#f87171', borderRadius: 3 }} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Advanced Player Cards ────────────────────────────────────────

function PlayerCard({ p, totalRounds: _totalRounds }: { p: PlayerStat; totalRounds: number }) {
    const fkTotal = (p.fk ?? 0) + (p.fd ?? 0);
    const fkPct = fkTotal > 0 ? (p.fk ?? 0) / fkTotal * 100 : 0;

    const row = (label: string, value: React.ReactNode) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
            <span style={{ color: themeColors.textMuted }}>{label}</span>
            <span style={{ fontWeight: 600, color: '#fff' }}>{value}</span>
        </div>
    );

    return (
        <div style={{
            flex: '1 1 280px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '14px 16px',
        }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 10 }}>{p.name}</div>
            {row('KPR / DPR', `${fmt3(p.kpr)} / ${fmt3(p.dpr)}`)}
            {row('Opening FK / FD', `${p.fk ?? 0} / ${p.fd ?? 0}  (${pct(fkPct)})`)}
            {row('Trade kills made', p.trade_kills ?? 0)}
            {row('Multikills', <span>
                {(p.k2 ?? 0) > 0 && <span style={{ color: '#60a5fa', marginRight: 6 }}>{p.k2}×2k</span>}
                {(p.k3 ?? 0) > 0 && <span style={{ color: '#a78bfa', marginRight: 6 }}>{p.k3}×3k</span>}
                {(p.k4 ?? 0) > 0 && <span style={{ color: '#f97316', marginRight: 6 }}>{p.k4}×4k</span>}
                {(p.k5 ?? 0) > 0 && <span style={{ color: '#ef4444', marginRight: 6 }}>{p.k5}×ACE</span>}
                {(p.k2 ?? 0) + (p.k3 ?? 0) + (p.k4 ?? 0) + (p.k5 ?? 0) === 0 && '—'}
            </span>)}
            {row('Clutches', <span>
                {[1, 2, 3, 4, 5].map(n => {
                    const key = `clutches_1v${n}` as keyof PlayerStat;
                    const val = (p[key] as number) ?? 0;
                    return val > 0 ? <span key={n} style={{ color: '#4ade80', marginRight: 6 }}>{val}×1v{n}</span> : null;
                })}
                {(p.clutches_1v1 ?? 0) + (p.clutches_1v2 ?? 0) + (p.clutches_1v3 ?? 0) + (p.clutches_1v4 ?? 0) + (p.clutches_1v5 ?? 0) === 0 && '—'}
            </span>)}
            {row('Flash support', `${p.enemies_flashed_time != null ? fmt1(p.enemies_flashed_time) + 's' : '—'} blind`)}
            {row('Util damage', p.util_dmg ?? 0)}
            {row('HS%', pct((p.kills > 0 ? p.hs / p.kills * 100 : 0)))}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────

export function Parser3Stats({ match }: { match: DemoResponse }) {
    const [activeSection, setActiveSection] = useState<'scoreboard' | 'kast' | 'cards'>('scoreboard');
    const totalRounds = match.rounds_count || match.rounds_history?.length || 1;

    const ctPlayers = match.players.filter(p =>
        p.team === 'CT' || p.team === '3' || String(p.team) === '3'
    );
    const tPlayers = match.players.filter(p =>
        p.team === 'T' || p.team === '2' || String(p.team) === '2'
    );

    const tabs: { id: 'scoreboard' | 'kast' | 'cards'; label: string }[] = [
        { id: 'scoreboard', label: 'Scoreboard' },
        { id: 'kast', label: 'KAST Breakdown' },
        { id: 'cards', label: 'Advanced Cards' },
    ];

    return (
        <div style={{ padding: '0 4px' }}>
            {/* Section tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id)}
                        style={{
                            padding: '6px 16px',
                            borderRadius: 7,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            transition: 'all 0.2s',
                            background: activeSection === tab.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                            color: activeSection === tab.id ? '#fff' : themeColors.textMuted,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Scoreboard */}
            {activeSection === 'scoreboard' && (
                <div className="glass fade-in" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Scoreboard players={ctPlayers} totalRounds={totalRounds} side="CT" color="#60a5fa" />
                    <Scoreboard players={tPlayers} totalRounds={totalRounds} side="T" color="#facc15" />
                </div>
            )}

            {/* KAST */}
            {activeSection === 'kast' && (
                <div className="glass fade-in" style={{ borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <KASTBreakdown players={match.players} totalRounds={totalRounds} />
                    <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 11, color: themeColors.textMuted }}>
                        <strong style={{ color: '#fff' }}>K</strong> = Kill round&nbsp;&nbsp;
                        <strong style={{ color: '#fff' }}>A</strong> = Assist round&nbsp;&nbsp;
                        <strong style={{ color: '#fff' }}>S</strong> = Survived round&nbsp;&nbsp;
                        <strong style={{ color: '#fff' }}>T</strong> = Traded within 5 seconds
                    </div>
                </div>
            )}

            {/* Advanced Cards */}
            {activeSection === 'cards' && (
                <div className="stagger-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {[...ctPlayers, ...tPlayers]
                        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                        .map((p, i) => (
                            <div key={p.steamid} className={`stagger-item stagger-${Math.min((i % 10) + 1, 10)}`} style={{ flex: '1 1 280px' }}>
                                <PlayerCard p={p} totalRounds={totalRounds} />
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}
