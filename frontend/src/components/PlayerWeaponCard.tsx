import { themeColors, formatWeapon } from '../utils';
import type { PlayerStat, WeaponStat } from "../types";

export const PlayerWeaponCard = ({ player, aliases }: { player: PlayerStat, aliases: Record<string, string> }) => (
    <div className="glass" style={{ borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: `1px solid ${themeColors.border}`, paddingBottom: '5px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: player.team === 'T' ? themeColors.t : themeColors.ct }}>{(player.steamid && aliases[player.steamid]) ? aliases[player.steamid] : player.name}</div>
            <div style={{ color: themeColors.textMuted, fontSize: '11px' }}>{player.kills} Kills</div>
        </div>
        {(player.weapons || []).length === 0 ? <div style={{ color: '#555', fontSize: '11px' }}>Нет убийств</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                {(player.weapons || []).map((w: WeaponStat) => (
                    <div key={w.name} style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: themeColors.text }}><span>{formatWeapon(w.name)}</span><span>{w.kills}</span></div>
                        <div style={{ background: 'rgba(255,255,255,0.1)', height: '3px', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${w.hs_percent}%`, background: w.hs_percent > 40 ? themeColors.accent : '#f59e0b', height: '100%' }}></div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);