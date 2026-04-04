const firestoreService = require('node-firestore-import-export');
const firebase = require('firebase-admin');
const fs = require('fs');

// Ваш ключ
const serviceAccount = require('./serviceAccountKey.json');

// Инициализация
// ВАЖНО: Если вы восстанавливаете в ДРУГОЙ проект, замените ключ на ключ того проекта!
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount)
});

const db = firebase.firestore();

// Укажите имя файла бэкапа, который хотите загрузить
// Например: 'database-backup-2025-01-25.json'
const BACKUP_FILE = 'database-backup-2025-01-25.json'; 

const restore = async () => {
  try {
    if (!fs.existsSync(BACKUP_FILE)) {
        console.error(`❌ Файл ${BACKUP_FILE} не найден!`);
        return;
    }

    console.log(`🔥 Начинаю восстановление из файла: ${BACKUP_FILE}...`);
    
    // Читаем файл
    const fileContents = fs.readFileSync(BACKUP_FILE, 'utf8');
    const data = JSON.parse(fileContents);

    // Загружаем в Firestore
    await firestoreService.firestoreImport(db, data);
    
    console.log('✅ Восстановление завершено успешно!');

  } catch (error) {
    console.error('❌ Ошибка при восстановлении:', error);
  }
};

restore();