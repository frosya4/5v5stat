import React from 'react';
import { themeColors } from '../utils';

interface LoadingScreenProps {
    message: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: '#05060a',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '30px',
            color: '#fff'
        }}>
            {/* Анимированный логотип */}
            <div style={{
                position: 'relative',
                width: '100px',
                height: '100px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {/* Пульсирующие круги */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `2px solid ${themeColors.accent}`,
                    opacity: 0.5,
                    animation: 'pulseGlow 2s infinite'
                }} />
                <div style={{
                    position: 'absolute',
                    width: '80%',
                    height: '80%',
                    borderRadius: '50%',
                    border: `2px solid ${themeColors.accent}`,
                    opacity: 0.3,
                    animation: 'pulseGlow 2s infinite 0.5s'
                }} />

                {/* Центральный значок */}
                <div style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: themeColors.accent,
                    animation: 'spin 3s infinite linear'
                }}>
                    STATS
                </div>
            </div>

            <div style={{ textAlign: 'center' }}>
                <h2 style={{
                    fontSize: '32px',
                    fontWeight: '900',
                    margin: 0,
                    letterSpacing: '-1px',
                    textTransform: 'none'
                }}>
                    573 <span className="rainbow-text">stat</span>
                </h2>
                <p style={{
                    color: themeColors.textMuted,
                    marginTop: '10px',
                    fontSize: '14px',
                    fontWeight: '500',
                    animation: 'blink 1.5s infinite'
                }}>
                    {message || 'Загрузка данных...'}
                </p>
            </div>

            {/* Прогресс-бар внизу */}
            <div style={{
                width: '200px',
                height: '2px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '2px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: '40%',
                    height: '100%',
                    background: themeColors.accent,
                    boxShadow: `0 0 10px ${themeColors.accent}`,
                    animation: 'loadingProgress 2s infinite'
                }} />
            </div>

            <style>{`
        @keyframes pulseGlow {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes loadingProgress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
        </div>
    );
};
