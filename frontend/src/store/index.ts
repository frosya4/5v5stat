import { create } from 'zustand';
import type { DemoResponse } from '../types';
import { LOCAL_PARSER_URL } from '../utils';

export interface User {
    id: string;
    email: string;
    display_name: string;
    steamid: string;
    avatar?: string;
    background_url?: string;
    dashboard_background?: string;
    bio?: string;
    social_vk?: string;
    social_tg?: string;
    social_twitch?: string;
    role: string;
    created_at: string;
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface AppState {
    // Data
    matches: DemoResponse[];
    aliases: Record<string, string>;
    merges: Record<string, string>;
    isLoading: boolean;
    loadingMessage: string;

    // UI/SettingsState
    isAdmin: boolean;
    appScale: number;
    ratingVer: '2.0' | '3.0';
    showPoop: boolean;
    toasts: Toast[];

    // Auth
    user: User | null;
    token: string | null;

    // Actions
    setMatches: (matches: DemoResponse[]) => void;
    setAliases: (aliases: Record<string, string>) => void;
    setMerges: (merges: Record<string, string>) => void;
    updateAlias: (steamid: string, name: string) => void;
    updateMerge: (alt: string, main: string) => void;
    removeMerge: (alt: string) => void;

    setLoading: (loading: boolean, message?: string) => void;
    setAdmin: (isAdmin: boolean) => void;
    setScale: (scale: number) => void;
    setRatingVer: (ver: '2.0' | '3.0') => void;
    triggerPoop: () => void;
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    removeToast: (id: string) => void;

    // Auth Actions
    setUser: (user: User | null) => void;
    setToken: (token: string | null) => void;
    updateProfile: (data: Partial<User>) => Promise<boolean>;
    logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Initial State
    matches: [],
    aliases: {},
    merges: {},
    isLoading: false,
    loadingMessage: '',

    isAdmin: false,
    appScale: 1.0,
    ratingVer: '3.0',
    showPoop: false,
    toasts: [],

    user: null,
    token: localStorage.getItem('auth_token'),

    // Actions
    setMatches: (matches) => set({ matches }),
    setAliases: (aliases) => set({ aliases }),
    setMerges: (merges) => set({ merges }),

    updateAlias: (steamid, name) => set((state) => ({
        aliases: { ...state.aliases, [steamid]: name }
    })),

    updateMerge: (alt, main) => set((state) => ({
        merges: { ...state.merges, [alt]: main }
    })),

    removeMerge: (alt) => set((state) => {
        const newMerges = { ...state.merges };
        delete newMerges[alt];
        return { merges: newMerges };
    }),

    setLoading: (isLoading, loadingMessage = '') => set({ isLoading, loadingMessage }),
    setAdmin: (isAdmin) => set({ isAdmin }),
    setScale: (appScale) => set({ appScale }),
    setRatingVer: (ratingVer) => set({ ratingVer }),
    triggerPoop: () => {
        set({ showPoop: true });
        setTimeout(() => set({ showPoop: false }), 5000);
    },

    addToast: (message, type = 'info') => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
        }, 5000);
    },

    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
    })),

    setUser: (user) => set({ user, isAdmin: user?.role === 'admin' }),
    setToken: (token) => {
        if (token) localStorage.setItem('auth_token', token);
        else localStorage.removeItem('auth_token');
        set({ token });
    },
    updateProfile: async (data: Partial<User>) => {
        const { token, user, addToast } = useAppStore.getState();
        if (!token || !user) return false;

        try {
            const resp = await fetch(`${LOCAL_PARSER_URL}/api/update-profile`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (resp.ok) {
                const updatedUser = await resp.json();
                set({ user: updatedUser });
                addToast('Профиль обновлен', 'success');
                return true;
            } else {
                addToast('Ошибка при обновлении профиля', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('Ошибка соединения с сервером', 'error');
            return false;
        }
    },
    logout: () => {
        localStorage.removeItem('auth_token');
        set({ user: null, token: null, isAdmin: false });
    },
}));
