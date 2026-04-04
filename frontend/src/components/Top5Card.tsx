import React from 'react';
import type { AggregatedPlayer } from '../utils/statsEngine';
import { themeColors, isRainbowName, isPoopName } from '../utils';
import { useAppStore } from '../store';

interface Top5CardProps {
    title: string;
    subtitle?: string;
    icon: string;
    players: AggregatedPlayer[];
    metric: keyof AggregatedPlayer | ((p: AggregatedPlayer) => number);
    formatValue: (val: number) => string;
    color?: string;
    onPlayerClick: (id: string) => void;
}

export const Top5Card: React.FC<Top5CardProps> = ({ title, subtitle, icon, players, metric, formatValue, color = themeColors.accent, onPlayerClick }) => {
    const { triggerPoop } = useAppStore();

    const getValue = (p: AggregatedPlayer) => {
        if (typeof metric === 'function') return metric(p);
        return p[metric] as number;
    };

    const topValue = players.length > 0 ? getValue(players[0]) : 1;

    return (
        <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', border: `1px solid ${color}40` }}>
            <div style={{ padding: '16px 20px', background: `linear-gradient(90deg, ${color}20 0%, transparent 100%)`, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {icon && <div style={{ fontSize: '24px' }}>{icon}</div>}
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff', textTransform: 'uppercase' }}>{title}</div>
                        {subtitle && <div style={{ fontSize: '11px', color: themeColors.textMuted }}>{subtitle}</div>}
                    </div>
                </div>
            </div>

            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {players.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeColors.textMuted, fontSize: '13px' }}>Нет данных</div>
                ) : (
                    players.map((p, i) => {
                        const val = getValue(p);
                        const width = topValue > 0 ? (val / topValue) * 100 : 0;
                        const isTop = i === 0;

                        const handlePlayerClick = () => {
                            if (isPoopName(p.name)) triggerPoop();
                            onPlayerClick(p.name);
                        };

                        return (
                            <div key={p.steamid} onClick={handlePlayerClick} className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: '0.2s' }}>
                                <div style={{
                                    width: '24px', height: '24px',
                                    background: isTop ? color : 'rgba(255,255,255,0.1)',
                                    color: isTop ? '#000' : '#888',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 'bold'
                                }}>
                                    {i + 1}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span className={isRainbowName(p.name) ? 'rainbow-text' : ''} style={{ fontSize: '13px', fontWeight: '600', color: isRainbowName(p.name) ? undefined : (isTop ? '#fff' : '#ddd') }}>{p.name}</span>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: isTop ? color : themeColors.textMuted }}>{formatValue(val)}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${width}%`, height: '100%', background: isTop ? color : '#555', borderRadius: '2px' }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
