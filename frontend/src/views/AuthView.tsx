import React, { useState } from 'react';
import { useAppStore } from '../store';
import { themeColors } from '../utils';
import axios from 'axios';

const LOCAL_PARSER_URL = 'http://localhost:8000';

export const AuthView: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [steamid, setSteamid] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { setToken, setUser } = useAppStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/api/login' : '/api/register';
        const data = isLogin
            ? { email, password }
            : { email, password, display_name: displayName, steamid };

        try {
            const resp = await axios.post(`${LOCAL_PARSER_URL}${endpoint}`, data);
            setToken(resp.data.token);
            setUser(resp.data.user);
            // Redirect or close is handled by store state change in App.tsx
        } catch (err: unknown) {
            let errorMessage = 'Произошла ошибка';
            if (axios.isAxiosError(err)) {
                errorMessage = err.response?.data?.message || err.response?.data || err.message;
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-in" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '60vh', width: '100%', maxWidth: '400px', margin: '0 auto'
        }}>
            <div className="glass" style={{
                padding: '40px', borderRadius: '24px', width: '100%',
                border: '1px solid var(--glass-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}>
                <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '8px', textAlign: 'center' }}>
                    {isLogin ? 'С возвращением' : 'Создать аккаунт'}
                </h2>
                <p style={{ color: themeColors.textMuted, textAlign: 'center', marginBottom: '32px', fontSize: '14px' }}>
                    {isLogin ? 'Войдите в свой профиль 573 stat' : 'Присоединяйтесь к сообществу аналитиков'}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!isLogin && (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: themeColors.textMuted, marginLeft: '4px' }}>ИМЯ</label>
                                <input
                                    type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                                    placeholder="Ваш никнейм" required
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: themeColors.textMuted, marginLeft: '4px' }}>STEAM ID</label>
                                <input
                                    type="text" value={steamid} onChange={e => setSteamid(e.target.value)}
                                    placeholder="76561198..."
                                    style={inputStyle}
                                />
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: themeColors.textMuted, marginLeft: '4px' }}>EMAIL</label>
                        <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="mail@example.com" required
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: themeColors.textMuted, marginLeft: '4px' }}>ПАРОЛЬ</label>
                        <input
                            type="password" value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••" required
                            style={inputStyle}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.1)',
                            color: themeColors.loss, fontSize: '13px', textAlign: 'center', border: '1px solid rgba(244, 63, 94, 0.2)'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit" disabled={loading}
                        className="btn-hover"
                        style={{
                            marginTop: '12px', padding: '16px', borderRadius: '14px',
                            background: themeColors.accent, color: '#fff', border: 'none',
                            fontWeight: '800', fontSize: '15px', cursor: 'pointer',
                            boxShadow: `0 8px 20px ${themeColors.accent}30`,
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'ЗАГРУЗКА...' : (isLogin ? 'ВОЙТИ' : 'ЗАРЕГИСТРИРОВАТЬСЯ')}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px' }}>
                    <span style={{ color: themeColors.textMuted }}>
                        {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
                    </span>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        style={{
                            background: 'none', border: 'none', color: themeColors.accent,
                            fontWeight: 'bold', cursor: 'pointer', marginLeft: '6px'
                        }}
                    >
                        {isLogin ? 'Создать' : 'Войти'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const inputStyle: React.CSSProperties = {
    padding: '14px 18px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--glass-border)',
    color: '#fff',
    outline: 'none',
    fontSize: '15px',
    transition: 'all 0.2s'
};
