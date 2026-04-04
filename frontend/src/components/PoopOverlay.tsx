import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';

const PARTICLE_COUNT = 20;

export const PoopOverlay: React.FC = () => {
    const { showPoop } = useAppStore();
    const [particles, setParticles] = useState<{ id: number, x: number, y: number, delay: number, size: number, rotate: number }[]>([]);

    useEffect(() => {
        if (showPoop) {
            const newParticles = Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
                id: i,
                x: Math.random() * 100, // %
                y: Math.random() * 100, // %
                delay: Math.random() * 0.5,
                size: 20 + Math.random() * 40,
                rotate: Math.random() * 360
            }));
            // Using a timeout to move setParticles out of the synchronous effect execution
            const timer = setTimeout(() => setParticles(newParticles), 0);
            return () => clearTimeout(timer);
        } else {
            const timer = setTimeout(() => setParticles([]), 0);
            return () => clearTimeout(timer);
        }
    }, [showPoop]);

    if (!showPoop) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            pointerEvents: 'none',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'radial-gradient(circle, rgba(62,39,35,0.2) 0%, rgba(0,0,0,0) 70%)',
            animation: 'poopBg 5s ease-in-out'
        }}>
            {/* Main Poop */}
            <div style={{
                fontSize: '250px',
                filter: 'drop-shadow(0 0 30px rgba(121, 85, 72, 0.5))',
                zIndex: 10,
                animation: 'mainPoop 5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                💩
            </div>

            {/* Particles */}
            {particles.map(p => (
                <div key={p.id} style={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: '-50px',
                    fontSize: `${p.size}px`,
                    opacity: 0,
                    transform: `rotate(${p.rotate}deg)`,
                    animation: `poopFall 3s linear ${p.delay}s forwards`
                }}>
                    💩
                </div>
            ))}

            <style>{`
                @keyframes mainPoop {
                    0% { transform: scale(0) rotate(-20deg); opacity: 0; }
                    10% { transform: scale(1.2) rotate(10deg); opacity: 1; }
                    20% { transform: scale(1) rotate(0deg); opacity: 1; }
                    80% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
                    100% { transform: scale(2) rotate(10deg); opacity: 0; filter: blur(20px); }
                }

                @keyframes poopFall {
                    0% { transform: translateY(-50px) rotate(0deg); opacity: 0; }
                    20% { opacity: 0.6; }
                    80% { opacity: 0.6; }
                    100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
                }

                @keyframes poopBg {
                    0% { opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { opacity: 0; }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};
