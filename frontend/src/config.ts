// src/config.ts

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const AppConfig = {
    // ⚙️ НАСТРОЙКИ АДМИНА
    features: {
        telegramBanner: true, // Показать баннер ТГ?
        yearReview: true,     // Показать итоги 2025?
        maintenanceMode: false // (На будущее) Режим техработ
    },
    links: {
        telegram: "https://t.me/stat573pugs",
        yearReviewAction: "/year-review" // Куда вести по клику на итоги
    },
    text: {
        telegramTitle: "Подпишись на канал!",
        telegramDesc: "Новости обновлений и статистика",
        yearReviewTitle: "Итоги 2025 года 🏆",
        yearReviewDesc: "Посмотри свой прогресс за прошедший год"
    }
};