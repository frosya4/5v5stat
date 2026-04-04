import React from 'react';
import type { MatchMeta } from '../types';

interface Props {
    meta?: MatchMeta;
}

export const ParserBadge: React.FC<Props> = ({ meta }) => {
    // 1. LEGACY: Если меты нет или версия 0/1
    if (!meta || !meta.version) {
        return (
            <div title="Базовая статистика (нет истории раундов)" style={styles.badgeLegacy}>
                LEGACY
            </div>
        );
    }

    // 2. V3: Самая новая (Координаты, Хитгруппы, Экономика, Стиль)
    if (meta.version >= 3) {
        return (
            <div title="Полная статистика: Хитмапы, Экономика, Хитгруппы" style={styles.badgeV3}>
                <span>🔥</span> FULL DATA
            </div>
        );
    }

    // 3. V2: Детальная (Есть раунды, но нет координат)
    if (meta.version === 2 || meta.is_detailed) {
        return (
            <div title="Детальная статистика раундов" style={styles.badgeDetailed}>
                DETAILED
            </div>
        );
    }

    return null;
};

// --- STYLES ---

const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '9px',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginLeft: '8px', // Отступ слева, чтобы не прилипало к названию карты
    userSelect: 'none',
    cursor: 'help'
};

const styles = {
    badgeLegacy: {
        ...baseStyle,
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#6b7280', // Gray
    },
    badgeDetailed: {
        ...baseStyle,
        background: 'rgba(52, 211, 153, 0.1)',
        border: '1px solid rgba(52, 211, 153, 0.3)',
        color: '#34d399', // Emerald Green
    },
    badgeV3: {
        ...baseStyle,
        background: 'linear-gradient(90deg, rgba(251, 146, 60, 0.15) 0%, rgba(251, 146, 60, 0.05) 100%)', // Orange gradient
        border: '1px solid rgba(251, 146, 60, 0.4)',
        color: '#fb923c', // Orange/Gold
        boxShadow: '0 0 10px rgba(251, 146, 60, 0.1)',
    }
};