import React, { useMemo, useState } from 'react';
import type { DemoResponse, PlayerStat } from '../types';
import { themeColors, LOCAL_PARSER_URL } from '../utils';
import axios from 'axios';

interface Props {
    match: DemoResponse;
    aliases: Record<string, string>;
}

export const AIAnalyst: React.FC<Props> = ({ match, aliases }) => {
    const [ollamaReview, setOllamaReview] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const generateAIReview = async () => {
        setIsLoading(true);
        setError('');
        try {
            const sortedPlayers = [...match.players].sort((a, b) => {
                const sideA = String(a.team || '').toUpperCase();
                const sideB = String(b.team || '').toUpperCase();
                if (sideA === sideB) return b.rating - a.rating;
                return sideA.localeCompare(sideB);
            });

            const playerLines = sortedPlayers.map(p => {
                const name = aliases[p.steamid] || p.name;
                const side = String(p.team || '').includes('3') || String(p.team || '').toUpperCase().includes('CT') ? 'CT' : 'T';

                // Top weapons
                const topWeapons = [...(p.weapons || [])]
                    .sort((a, b) => b.kills - a.kills)
                    .slice(0, 3)
                    .filter(w => w.kills > 0)
                    .map(w => `${w.name.replace('weapon_', '')}:${w.kills}к`)
                    .join(', ');

                // Multikills
                const mk = [];
                if ((p.k2 || 0) > 0) mk.push(`${p.k2}x2к`);
                if ((p.k3 || 0) > 0) mk.push(`${p.k3}x3к`);
                if ((p.k4 || 0) > 0) mk.push(`${p.k4}x4к`);
                if ((p.k5 || 0) > 0) mk.push(`${p.k5}xэйс`);
                const mkStr = mk.length > 0 ? `, мультикиллы: ${mk.join(' ')}` : '';

                // Clutches
                const clutchTotal = (p.clutches_1v1 || 0) + (p.clutches_1v2 || 0) + (p.clutches_1v3 || 0) + (p.clutches_1v4 || 0) + (p.clutches_1v5 || 0);
                const clutchStr = clutchTotal > 0 ? `, клатч ${clutchTotal}x` : '';

                // FK/FD
                const entryStr = ((p.fk || 0) > 0 || (p.fd || 0) > 0) ? `, открытия: ${p.fk || 0}FK/${p.fd || 0}FD` : '';

                return `[${side}] ${name}: ${p.kills}К/${p.deaths}D/${p.assists}A, ADR=${p.adr.toFixed(0)}, RTG=${p.rating.toFixed(2)}, KAST=${(p.kast || 0).toFixed(0)}%${entryStr}${mkStr}${clutchStr}${topWeapons ? `, оружие=[${topWeapons}]` : ''}`;
            });

            const pistolInfo = match.rounds_history && match.rounds_history.length > 0
                ? `Пистольные раунды: Раунд 1 (T/CT стартовые), Раунд ${Math.ceil(match.rounds_count / 2) + 1} (second half pistol).`
                : '';

            const prompt = `Карта: ${match.map}\nСчёт: CT ${match.final_score_ct} : ${match.final_score_t} T (всего ${match.rounds_count} раундов)\n${pistolInfo}\n\nСтатистика игроков:\n${playerLines.join('\n')}`;

            const res = await axios.post(`${LOCAL_PARSER_URL}/api/generate-review`, { prompt });
            setOllamaReview(res.data.review);
        } catch (e: any) {
            setError(e?.response?.data || e.message || 'Ошибка генерации');
        } finally {
            setIsLoading(false);
        }
    };

    const summary = useMemo(() => {
        const getName = (p: PlayerStat) => aliases[p.steamid] || p.name;

        const lines: { text: string, type: 'positive' | 'negative' | 'neutral' | 'highlight' }[] = [];

        // 1. MATCH OUTCOME
        const scoreDiff = Math.abs(match.final_score_ct - match.final_score_t);
        const winner = match.final_score_ct > match.final_score_t ? 'CT' : (match.final_score_t > match.final_score_ct ? 'T' : 'Draw');
        const isStomp = scoreDiff >= 8;
        const isClose = scoreDiff <= 2;

        if (isStomp) {
            lines.push({ text: `Матч закончился полным разгромом со счетом ${match.final_score_ct}:${match.final_score_t}. Сторона ${winner} доминировала всю игру.`, type: 'neutral' });
        } else if (isClose) {
            lines.push({ text: `Невероятно плотная игра! Исход решился в последних раундах со счетом ${match.final_score_ct}:${match.final_score_t}.`, type: 'highlight' });
        } else {
            lines.push({ text: `Матч завершился со счетом ${match.final_score_ct}:${match.final_score_t} в пользу ${winner}.`, type: 'neutral' });
        }

        // 2. MVP ANALYSIS
        const players = [...match.players].sort((a, b) => b.rating - a.rating);
        const mvp = players[0];
        const bot = players[players.length - 1];

        if (mvp.rating >= 1.50) {
            lines.push({ text: `${getName(mvp)} выдал феноменальную, нечестную игру с рейтингом ${mvp.rating.toFixed(2)}. Это соло-керри перформанс.`, type: 'highlight' });
        } else if (mvp.rating >= 1.20) {
            lines.push({ text: `${getName(mvp)} был самым ценным игроком матча с солидным рейтингом ${mvp.rating.toFixed(2)}.`, type: 'positive' });
        }

        // 3. SPECIFIC PERFORMANCES
        const highKills = match.players.filter(p => p.kills >= 25);
        if (highKills.length > 0) {
            const names = highKills.map(getName).join(', ');
            lines.push({ text: `Огневая мощь: ${names} сделали более 25 фрагов.`, type: 'positive' });
        }

        const entries = [...match.players].sort((a, b) => b.fk - a.fk);
        if (entries[0].fk >= 5) {
            lines.push({ text: `${getName(entries[0])} открывал раунды как бог, сделав ${entries[0].fk} первых убийств.`, type: 'highlight' });
        }

        const awpers = match.players.filter(p => {
            const awp = p.weapons.find(w => w.name.toLowerCase().includes('awp'));
            return awp && awp.kills >= 10;
        });

        if (awpers.length > 0) {
            lines.push({ text: `Снайперская дуэль: ${awpers.map(getName).join(' и ')} контролировали карту с AWP.`, type: 'neutral' });
        }

        const clutchers = [...match.players].sort((a, b) => { // Simple clutch sum
            return (b.clutches_1v1 + b.clutches_1v2 + b.clutches_1v3) - (a.clutches_1v1 + a.clutches_1v2 + a.clutches_1v3)
        });
        const topClutcher = clutchers[0];
        const totalClutches = topClutcher.clutches_1v1 + topClutcher.clutches_1v2 + topClutcher.clutches_1v3 + topClutcher.clutches_1v4;

        if (totalClutches >= 2) {
            lines.push({ text: `${getName(topClutcher)} - министр клатчей, выиграв ${totalClutches} ситуаций 1vX.`, type: 'highlight' });
        }

        // 4. LOW PERFORMANCE
        if (bot.rating < 0.60 && bot.kills < 10) {
            lines.push({ text: `${getName(bot)} явно не попал в игру (Рейтинг ${bot.rating.toFixed(2)}), что усложнило жизнь команде.`, type: 'negative' });
        }

        return lines;

    }, [match, aliases]);

    return (
        <div className="glass fade-in" style={{ padding: '25px', borderRadius: '16px', border: `1px solid ${themeColors.accent}40`, background: `linear-gradient(180deg, ${themeColors.accent}10 0%, rgba(0,0,0,0) 100%)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>AI Анализ Матча</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                {summary.map((line, i) => (
                    <div key={i} style={{
                        padding: '12px',
                        borderRadius: '8px',
                        background: line.type === 'highlight' ? 'rgba(245, 158, 11, 0.1)' : (line.type === 'negative' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)'),
                        borderLeft: `4px solid ${line.type === 'highlight' ? '#f59e0b' : (line.type === 'negative' ? '#ef4444' : (line.type === 'positive' ? '#10b981' : '#64748b'))}`,
                        color: '#eee',
                        fontSize: '14px',
                        lineHeight: '1.5'
                    }}>
                        {line.text}
                    </div>
                ))}
            </div>

            <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${themeColors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{ fontWeight: 'bold' }}>Сводка от нейросети (Ollama)</div>
                    <button onClick={generateAIReview} disabled={isLoading} style={{ background: themeColors.accent, color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: isLoading ? 'wait' : 'pointer', fontWeight: 'bold' }}>{isLoading ? 'Генерация...' : 'Сгенерировать'}</button>
                </div>
                {error && <div style={{ color: themeColors.loss, fontSize: '13px', marginBottom: '10px' }}>{error}</div>}
                {ollamaReview && <div style={{ color: '#fff', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${themeColors.accent}` }}>{ollamaReview}</div>}
                {!ollamaReview && !isLoading && !error && <div style={{ color: themeColors.textMuted, fontSize: '13px' }}>Нажмите кнопку для запуска локальной нейросети. Она проанализирует ход матча и напишет персональный отчет. Требуется включенный Ollama на бэкенде.</div>}
            </div>
        </div>
    );
};
