import React from 'react';
import { useAppStore } from '../store';
import { themeColors } from '../utils';

export const GlobalBanners: React.FC = () => {
    const { toasts, removeToast } = useAppStore();

    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none'
        }}>
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className="glass fade-in"
                    style={{
                        padding: '16px 24px',
                        minWidth: '280px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        pointerEvents: 'auto',
                        borderLeft: `4px solid ${toast.type === 'success' ? themeColors.win :
                                toast.type === 'error' ? themeColors.loss :
                                    themeColors.accent
                            }`,
                        background: 'rgba(10, 11, 16, 0.95)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                    }}
                >
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{toast.message}</div>
                    <button
                        onClick={() => removeToast(toast.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: themeColors.textMuted,
                            cursor: 'pointer',
                            fontSize: '18px',
                            padding: '4px'
                        }}
                    >
                        &times;
                    </button>
                </div>
            ))}
        </div>
    );
};