import React, { useState } from 'react';
import { themeColors } from '../utils';
import type { DemoResponse } from '../types';

interface Props {
    match: DemoResponse;
    onClose: () => void;
    onSave: (updatedMatch: DemoResponse) => void;
}

export const MatchEditModal: React.FC<Props> = ({ match, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        map: match.map,
        scoreCT: match.final_score_ct,
        scoreT: match.final_score_t,
        date: match.upload_date
    });

    const handleChange = (field: keyof typeof formData, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...match,
            map: formData.map,
            final_score_ct: Number(formData.scoreCT),
            final_score_t: Number(formData.scoreT),
            upload_date: formData.date
        });
        onClose();
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }} onClick={onClose}>
            <div className="glass" style={{ width: '400px', padding: '30px', borderRadius: '16px', border: `1px solid ${themeColors.border}` }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Редактировать Матч</h3>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', color: themeColors.textMuted, marginBottom: '5px' }}>Карта</label>
                        <input
                            type="text"
                            value={formData.map}
                            onChange={e => handleChange('map', e.target.value)}
                            style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${themeColors.border}`, borderRadius: '8px', color: '#fff', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', color: themeColors.ct, marginBottom: '5px' }}>CT Score</label>
                            <input
                                type="number"
                                value={formData.scoreCT}
                                onChange={e => handleChange('scoreCT', e.target.value)}
                                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${themeColors.border}`, borderRadius: '8px', color: '#fff', outline: 'none' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', color: themeColors.t, marginBottom: '5px' }}>T Score</label>
                            <input
                                type="number"
                                value={formData.scoreT}
                                onChange={e => handleChange('scoreT', e.target.value)}
                                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${themeColors.border}`, borderRadius: '8px', color: '#fff', outline: 'none' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', color: themeColors.textMuted, marginBottom: '5px' }}>Дата</label>
                        <input
                            type="text"
                            value={formData.date}
                            onChange={e => handleChange('date', e.target.value)}
                            style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${themeColors.border}`, borderRadius: '8px', color: '#fff', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button type="submit" className="btn-hover" style={{ flex: 1, padding: '12px', background: themeColors.accent, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Сохранить</button>
                        <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${themeColors.border}`, borderRadius: '8px', color: themeColors.textMuted, fontWeight: 'bold', cursor: 'pointer' }}>Отмена</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
