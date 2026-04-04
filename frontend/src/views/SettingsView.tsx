import React, { useState } from 'react';
import { doc, setDoc, updateDoc, deleteField, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { themeColors } from '../utils';
import { useAppStore } from '../store';

const ScaleButton = ({ val, currentScale, setScale }: { val: number, currentScale: number, setScale: (v: number) => void }) => (
    <button
        onClick={() => setScale(val)}
        style={{
            padding: '10px 20px',
            background: currentScale === val ? themeColors.accent : 'rgba(255,255,255,0.05)',
            color: currentScale === val ? '#fff' : themeColors.textMuted,
            border: `1px solid ${currentScale === val ? themeColors.accent : themeColors.border}`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            flex: 1
        }}
    >
        {Math.round(val * 100)}% {val === 1 && '(Норма)'}
    </button>
);

const MergedInputs = ({ onMerge }: { onMerge: (alt: string, main: string) => void }) => {
    const [alt, setAlt] = useState('');
    const [main, setMain] = useState('');

    return (
        <>
            <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '10px' }}>🔗 Объединение игроков</h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                    placeholder="SteamID твинка (который исчезнет)"
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: `1px solid ${themeColors.border}`,
                        background: 'rgba(0,0,0,0.3)',
                        color: '#fff'
                    }}
                />
                <input
                    value={main}
                    onChange={(e) => setMain(e.target.value)}
                    placeholder="SteamID основы (куда пойдет стата)"
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: `1px solid ${themeColors.border}`,
                        background: 'rgba(0,0,0,0.3)',
                        color: '#fff'
                    }}
                />
                <button
                    onClick={() => {
                        if (alt.trim() && main.trim()) {
                            onMerge(alt.trim(), main.trim());
                            setAlt('');
                            setMain('');
                        }
                    }}
                    style={{
                        background: themeColors.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0 20px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Merge
                </button>
            </div>
        </>
    );
};

export const SettingsView: React.FC = () => {
    const { isAdmin, ratingVer, setRatingVer, appScale, setScale, merges, setMerges, updateMerge, removeMerge, setMatches, user, updateProfile } = useAppStore();

    const [dbBg, setDbBg] = useState(user?.dashboard_background || '');
    const handleUpdateDbBg = async () => {
        if (!user) return;
        const success = await updateProfile({ dashboard_background: dbBg });
        if (success) {
            // Updated user in store will propagate, no need for local state refresh if App.tsx uses store
        }
    };

    // HANDLERS
    const handleMerge = async (alt: string, main: string) => {
        if (!isAdmin) return;
        try {
            await setDoc(doc(db, 'settings', 'merges'), { [alt]: main }, { merge: true });
            updateMerge(alt, main);
        } catch (e) {
            console.error(e);
            alert('Ошибка при объединении');
        }
    };

    const handleUnmerge = async (alt: string) => {
        if (!isAdmin) return;
        try {
            await updateDoc(doc(db, 'settings', 'merges'), { [alt]: deleteField() });
            removeMerge(alt);
        } catch (e) {
            console.error(e);
            alert('Ошибка при отмене объединения');
        }
    };

    const handleClearAll = async () => {
        if (!isAdmin) return;
        if (!confirm("ВНИМАНИЕ! Это удалит ВСЕ матчи и сбросит ВСЕ настройки.\nВы уверены??")) return;

        const pwd = prompt("Введите пароль для подтверждения (Antifa12):");
        if (pwd !== "Antifa12") {
            alert("Неверный пароль");
            return;
        }

        try {
            // Delete matches
            const q = collection(db, 'matches');
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();

            // Clear settings
            await deleteDoc(doc(db, 'settings', 'aliases'));
            await deleteDoc(doc(db, 'settings', 'merges'));

            // Reset Store
            setMatches([]);
            setMerges({});
            alert("Все данные успешно очищены.");
            window.location.reload();

        } catch (e) {
            console.error(e);
            alert('Ошибка при удалении данных');
        }
    };

    return (
        <div className="fade-in">
            <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '30px' }}>Настройки</h2>

            {/* БЛОК 1: ИНТЕРФЕЙС (Для всех) */}
            <div className="glass" style={{ padding: '30px', borderRadius: '16px', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    🖥️ Интерфейс и Отображение
                </h3>

                {/* Настройка масштаба */}
                <div style={{ marginBottom: '30px' }}>
                    <div style={{ fontSize: '14px', color: themeColors.textMuted, marginBottom: '10px' }}>
                        Масштаб приложения (текущий: {Math.round(appScale * 100)}%)
                    </div>
                    <div style={{ display: 'flex', gap: '10px', maxWidth: '500px' }}>
                        <ScaleButton val={0.5} currentScale={appScale} setScale={setScale} />
                        <ScaleButton val={1} currentScale={appScale} setScale={setScale} />
                        <ScaleButton val={1.5} currentScale={appScale} setScale={setScale} />
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        * 50% — компактный, 100% — стандартный, 150% — увеличенный
                    </div>
                </div>

                {/* Настройка рейтинга */}
                <div style={{ marginBottom: '30px' }}>
                    <div style={{ fontSize: '14px', color: themeColors.textMuted, marginBottom: '10px' }}>
                        Версия Рейтинга
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => setRatingVer('2.0')}
                            style={{
                                padding: '10px 24px',
                                background: ratingVer === '2.0' ? themeColors.accent : 'rgba(255,255,255,0.05)',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Rating 2.0 (HLTV)
                        </button>
                        <button
                            onClick={() => setRatingVer('3.0')}
                            style={{
                                padding: '10px 24px',
                                background: ratingVer === '3.0' ? themeColors.accent : 'rgba(255,255,255,0.05)',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Rating 3.0 (Exp)
                        </button>
                    </div>
                </div>

                <div style={{ height: '1px', background: themeColors.border, margin: '20px 0' }}></div>

                {/* Настройка фона дашборда */}
                <div>
                    <div style={{ fontSize: '14px', color: themeColors.textMuted, marginBottom: '10px' }}>
                        🌐 Кастомный фон дашборда (URL)
                    </div>
                    <div style={{ display: 'flex', gap: '10px', maxWidth: '600px' }}>
                        <input
                            value={dbBg}
                            onChange={(e) => setDbBg(e.target.value)}
                            placeholder="Вставьте ссылку на изображение (jpg, png, webp)..."
                            style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '10px',
                                border: `1px solid ${themeColors.border}`,
                                background: 'rgba(0,0,0,0.3)',
                                color: '#fff',
                                outline: 'none',
                                fontSize: '13px'
                            }}
                        />
                        <button
                            onClick={handleUpdateDbBg}
                            disabled={!user}
                            style={{
                                background: themeColors.accent,
                                color: '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '0 25px',
                                cursor: user ? 'pointer' : 'not-allowed',
                                fontWeight: 'bold',
                                opacity: user ? 1 : 0.5
                            }}
                        >
                            Обновить
                        </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        * Этот фон будет применен ко всему приложению.
                    </div>
                </div>
            </div>

            {/* БЛОК 2: АДМИН ЗОНА (Только для админа) */}
            {isAdmin && (
                <div className="glass" style={{ padding: '30px', borderRadius: '16px', border: `1px solid ${themeColors.loss}40` }}>
                    <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', color: themeColors.loss, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        ⛔ Опасная зона (Admin)
                    </h3>

                    {/* 🔥 СЛИЯНИЕ ИГРОКОВ */}
                    <div style={{ marginBottom: '30px' }}>
                        <MergedInputs onMerge={handleMerge} />
                        <div style={{ fontSize: '12px', color: themeColors.textMuted, marginTop: '10px' }}>
                            * Активные объединения:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '5px' }}>
                            {merges && Object.entries(merges).map(([alt, main]) => (
                                <div key={alt} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#fff' }}>
                                    <span>{alt}</span>
                                    <span style={{ color: themeColors.textMuted }}>→</span>
                                    <span>{main}</span>
                                    <span
                                        onClick={() => handleUnmerge(alt)}
                                        style={{ cursor: 'pointer', color: themeColors.loss, marginLeft: 'auto' }}
                                    >
                                        [Удалить]
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ height: '1px', background: 'rgba(239, 68, 68, 0.2)', margin: '20px 0' }}></div>

                    <p style={{ color: themeColors.textMuted, fontSize: '14px', marginBottom: '20px' }}>
                        Эти действия необратимы. Будьте осторожны.
                    </p>

                    <button
                        onClick={handleClearAll}
                        style={{
                            background: `linear-gradient(45deg, ${themeColors.loss}, #a32a2a)`,
                            color: '#fff',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(255, 70, 85, 0.3)'
                        }}
                    >
                        🗑️ Удалить все данные и сбросить
                    </button>
                </div>
            )}

            {/* Если не админ, можно показать заглушку или просто ничего */}
            {!isAdmin && (
                <div style={{ textAlign: 'center', marginTop: '40px', color: themeColors.textMuted, fontSize: '12px' }}>
                    Чтобы получить доступ к управлению данными, войдите как администратор в меню слева.
                </div>
            )}
        </div>
    );
};
