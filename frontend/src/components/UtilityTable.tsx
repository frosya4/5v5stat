import { themeColors } from '../utils';
import type { PlayerStat } from "../types";

export const UtilityTable = ({ players, aliases }: { players: PlayerStat[], aliases: Record<string, string> }) => (
    <div className="glass" style={{ borderRadius: '8px', overflow: 'hidden' }}>
        <div className="mobile-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: themeColors.text }}>
                <thead><tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: `1px solid ${themeColors.border}`, color: themeColors.textMuted, fontSize: '11px', textTransform: 'uppercase' }}><th style={{ padding: '10px', textAlign: 'left' }}>Игрок</th><th style={{ padding: '10px', textAlign: 'center' }}>Ослепил (сек)</th><th style={{ padding: '10px', textAlign: 'center' }}>Урон гранатами</th><th style={{ padding: '10px', textAlign: 'center' }}>Урон/Раунд</th></tr></thead>
                <tbody>{players.map((p: PlayerStat, i: number) => (
                    <tr key={p.name} style={{ borderBottom: `1px solid ${themeColors.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold', borderLeft: `3px solid ${p.team === 'T' ? themeColors.t : themeColors.ct}` }}>{(p.steamid && aliases[p.steamid]) ? aliases[p.steamid] : p.name}</td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>{(p.blind_time || 0).toFixed(1)}s</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: themeColors.loss }}>{p.util_dmg}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{p.util_dmg_per_round.toFixed(1)}</td>
                    </tr>
                ))}</tbody>
            </table>
        </div>
    </div>
);