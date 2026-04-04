import React from 'react';
import { themeColors } from '../utils';
import type { PlayerStat, DuelStat } from "../types";

interface DuelMatrixProps {
    players: PlayerStat[];
    aliases: Record<string, string>;
}

export const DuelMatrix: React.FC<DuelMatrixProps> = ({ players, aliases }) => {
    const tPlayers = players.filter((p: PlayerStat) => p.team === 'T');
    const ctPlayers = players.filter((p: PlayerStat) => p.team === 'CT');
    return (
        <div className="glass" style={{ borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 'bold' }}>Дуэли (T vs CT)</h3>
            <div className="mobile-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '10px', textAlign: 'left', color: themeColors.textMuted }}>T \ CT</th>
                            {ctPlayers.map((ct: PlayerStat) => (
                                <th key={ct.name} style={{ padding: '10px', color: themeColors.ct, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    {(ct.steamid && aliases[ct.steamid]) ? aliases[ct.steamid] : ct.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tPlayers.map((t: PlayerStat) => (
                            <tr key={t.name} className="row-hover" style={{ borderBottom: `1px solid ${themeColors.border}` }}>
                                <td style={{ padding: '10px', fontWeight: 'bold', color: themeColors.t, whiteSpace: 'nowrap' }}>
                                    {(t.steamid && aliases[t.steamid]) ? aliases[t.steamid] : t.name}
                                </td>
                                {ctPlayers.map((ct: PlayerStat) => {
                                    const stat = (t.duels || []).find((d: DuelStat) => d.enemy === ct.name) || { kills: 0, deaths: 0, diff: 0 };
                                    let bg = 'transparent';
                                    let color = themeColors.textMuted;
                                    if (stat.diff > 0) { bg = 'rgba(34, 197, 94, 0.1)'; color = themeColors.win; }
                                    if (stat.diff < 0) { bg = 'rgba(239, 68, 68, 0.1)'; color = themeColors.loss; }
                                    return (
                                        <td key={ct.name} style={{ padding: '8px', textAlign: 'center', background: bg }}>
                                            <div style={{ fontWeight: 'bold' }}>{stat.kills}:{stat.deaths}</div>
                                            <div style={{ fontSize: '10px', color: color }}>{stat.diff > 0 ? `+${stat.diff}` : stat.diff}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};