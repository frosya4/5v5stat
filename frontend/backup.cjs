const firestoreService = require('node-firestore-import-export');
const firebase = require('firebase-admin');
const fs = require('fs');

// Подключаем ваш ключ
const serviceAccount = require('./serviceAccountKey.json');

// Инициализация
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount)
});

console.log('🔥 Начинаю полное скачивание базы (включая subcollections)...');

// Функция экспорта
const backup = async () => {
  try {
    const db = firebase.firestore();
    
    // firestoreExport выгружает всё дерево данных
    const data = await firestoreService.firestoreExport(db);
    
    // Генерируем имя файла с датой
    const date = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const fileName = `database-backup-${date}.json`;

    // Сохраняем
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
    console.log(`✅ Бэкап успешно сохранен в файл: ${fileName}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
};

backup();