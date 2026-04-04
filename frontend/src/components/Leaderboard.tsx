import React from 'react';
import { themeColors, getRatingColor, isRainbowName, isPoopName } from '../utils';
import { useAppStore } from '../store';
// Стало:
import type { PlayerStat } from "../types";

interface LeaderboardProps {
    players: PlayerStat[];
    title: string;
    teamColor: string;
    onPlayerClick: (id: string) => void;
    aliases: Record<string, string>;
    isAdmin: boolean;
    onRename?: (id: string, name: string) => void;
    onDeletePlayer?: (id: string) => void;
    ratingVer: '2.0' | '3.0';
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ players, title, teamColor, onPlayerClick, aliases, isAdmin, onRename, onDeletePlayer, ratingVer }) => {
    const { triggerPoop } = useAppStore();
    const sorted = [...(players || [])].sort((a: PlayerStat, b: PlayerStat) => {
        const rA = ratingVer === '3.0' ? (a.rating_3 || a.rating) : a.rating;
        const rB = ratingVer === '3.0' ? (b.rating_3 || b.rating) : b.rating;
        return rB - rA;
    });
    const maxAdr = Math.max(...(players || []).map((p: PlayerStat) => p.adr), 1);

    return (
        <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${themeColors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(90deg, ${teamColor}15 0%, transparent 100%)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: teamColor, boxShadow: `0 0 10px ${teamColor}` }}></div><h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>{title}</h3></div>
                <span style={{ fontSize: '11px', color: themeColors.textMuted, background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px' }}>{players.length} ALIVE</span>
            </div>
            <div className="mobile-scroll" style={{ flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead><tr style={{ color: themeColors.textMuted, fontSize: '10px', textTransform: 'uppercase', textAlign: 'center', borderBottom: `1px solid ${themeColors.border}` }}><th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: '600' }}>Игрок</th><th style={{ padding: '12px', width: '40px' }}>K</th><th style={{ padding: '12px', width: '40px' }}>A</th><th style={{ padding: '12px', width: '40px' }}>D</th><th style={{ padding: '12px', width: '50px' }}>+/-</th><th style={{ padding: '12px', width: '60px' }}>R {ratingVer}</th><th style={{ padding: '16px 24px', textAlign: 'right', width: '100px' }}>ADR</th></tr></thead>
                    <tbody>{sorted.map((p: PlayerStat, i: number) => {
                        const displayName = (p.steamid && aliases[p.steamid]) ? aliases[p.steamid] : p.name;
                        const kdDiff = p.kills - p.deaths;
                        const currentRating = ratingVer === '3.0' ? (p.rating_3 || p.rating) : p.rating;
                        const handleNameClick = () => {
                            if (isPoopName(displayName)) triggerPoop();
                            onPlayerClick(displayName);
                        };

                        return (<tr key={p.steamid || i} className="row-hover" style={{ borderBottom: `1px solid ${themeColors.border}` }}><td style={{ padding: '14px 24px', textAlign: 'left' }}> <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}> <span onClick={handleNameClick} className={`link-hover ${isRainbowName(displayName) ? 'rainbow-text' : ''}`} style={{ fontWeight: '600', color: isRainbowName(displayName) ? undefined : '#fff' }}>{displayName}</span> {isAdmin && (<div style={{ display: 'flex', gap: '6px', marginLeft: '4px' }}> {p.steamid && onRename && (<span onClick={(e: React.MouseEvent) => { e.stopPropagation(); const newName = prompt("Новое имя:", displayName); if (newName && newName !== displayName) onRename(p.steamid, newName); }} style={{ cursor: 'pointer', opacity: 0.5, fontSize: '10px' }} title="Переименовать">✏️</span>)} {onDeletePlayer && (<span onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDeletePlayer(p.steamid || p.name); }} style={{ cursor: 'pointer', opacity: 0.5, fontSize: '10px', color: themeColors.loss }} title="Удалить игрока из матча">✖</span>)} </div>)} </div> </td><td style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: '#fff' }}>{p.kills}</td><td style={{ padding: '12px', textAlign: 'center', color: themeColors.textMuted }}>{p.assists}</td><td style={{ padding: '12px', textAlign: 'center', color: themeColors.loss }}>{p.deaths}</td><td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: kdDiff >= 0 ? themeColors.win : themeColors.loss }}>{kdDiff > 0 ? `+${kdDiff}` : kdDiff}</td>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: '800', color: getRatingColor(currentRating) }}>{currentRating ? currentRating.toFixed(2) : "-"}</td>
                            <td style={{ padding: '14px 24px' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}><span style={{ fontWeight: '700', fontSize: '12px' }}>{p.adr.toFixed(0)}</span><div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}><div style={{ width: `${maxAdr > 0 ? (p.adr / maxAdr) * 100 : 0}%`, height: '100%', background: p.adr > 100 ? themeColors.win : teamColor, borderRadius: '2px' }}></div></div></div></td></tr>)
                    })}</tbody>
                </table>
            </div>
        </div>
    );
};