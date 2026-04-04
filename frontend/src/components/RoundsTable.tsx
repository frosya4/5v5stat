import React from 'react';
import { themeColors } from '../utils';
import type { RoundHistory } from '../types';

interface Props {
    rounds: RoundHistory[];
    onDeleteRound?: (roundNum: number) => void;
}

export const RoundsTable: React.FC<Props> = ({ rounds, onDeleteRound }) => {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#fff' }}>
                <thead>
                    <tr style={{ borderBottom: `1px solid ${themeColors.border}`, textAlign: 'left' }}>
                        <th style={{ padding: '12px', color: themeColors.textMuted }}>#</th>
                        <th style={{ padding: '12px', color: themeColors.textMuted }}>Победитель</th>
                        <th style={{ padding: '12px', color: themeColors.textMuted }}>Тип победы</th>
                        <th style={{ padding: '12px', color: themeColors.textMuted, textAlign: 'center' }}>Счет</th>
                        <th style={{ padding: '12px', color: themeColors.textMuted }}>Экономика (Buy Type)</th>
                        {onDeleteRound && <th style={{ padding: '12px', textAlign: 'right' }}>Действия</th>}
                    </tr>
                </thead>
                <tbody>
                    {rounds.map((r) => (
                        <tr key={r.round_num} className="row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.round_num}</td>
                            
                            <td style={{ padding: '12px' }}>
                                <span style={{ 
                                    color: r.winner_side === 'CT' ? themeColors.ct : themeColors.t, 
                                    fontWeight: '800',
                                    background: r.winner_side === 'CT' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                                    padding: '4px 8px',
                                    borderRadius: '4px'
                                }}>
                                    {r.winner_side}
                                </span>
                            </td>
                            
                            <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                                {renderWinType(r.win_type)}
                            </td>
                            
                            {/* 🔥 ИСПРАВЛЕНИЕ ЗДЕСЬ: score_a вместо score_ct */}
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                                <span style={{ color: themeColors.ct }}>{r.score_a}</span> : <span style={{ color: themeColors.t }}>{r.score_b}</span>
                            </td>

                            <td style={{ padding: '12px', fontSize: '11px', color: '#ccc' }}>
                                {r.buy_type_ct && r.buy_type_t ? (
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <span style={{ color: themeColors.ct }}>CT: {r.buy_type_ct}</span>
                                        <span style={{ color: '#555' }}>|</span>
                                        <span style={{ color: themeColors.t }}>T: {r.buy_type_t}</span>
                                    </div>
                                ) : (
                                    <span style={{ opacity: 0.5 }}>-</span>
                                )}
                            </td>

                            {onDeleteRound && (
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteRound(r.round_num); }}
                                        style={{ 
                                            background: 'rgba(239, 68, 68, 0.1)', 
                                            color: '#ef4444', 
                                            border: '1px solid rgba(239, 68, 68, 0.3)', 
                                            borderRadius: '6px', 
                                            padding: '4px 8px', 
                                            cursor: 'pointer',
                                            fontSize: '11px'
                                        }}
                                    >
                                        Удалить
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Хелпер для иконок типов победы
const renderWinType = (type: string) => {
    switch (type) {
        case 'bomb': return '💣 Bomb Exploded';
        case 'defuse': return '✂️ Defused';
        case 'elimination': return '🔫 Elimination';
        case 'time': return '⏱️ Time Expired';
        default: return type;
    }
};