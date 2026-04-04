import React from 'react';
import { themeColors } from '../utils';

interface SidebarBtnProps {
    icon: string;
    label: string;
    active: boolean;
    onClick: () => void;
}

export const SidebarBtn: React.FC<SidebarBtnProps> = ({ icon, label, active, onClick }) => (
    <div onClick={onClick} className="btn-hover" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', background: active ? themeColors.accent : 'transparent', color: active ? '#fff' : themeColors.textMuted, fontWeight: active ? '600' : '500' }}>
        <span style={{ transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: active ? 'scale(1.25)' : 'scale(1)', display: 'inline-block' }}>{icon}</span>
        <span>{label}</span>
    </div>
);