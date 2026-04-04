// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyATw-u6D_xlcQHvEhzW-S5uHCjMKA91xFc",
  authDomain: "cs5v5stat.firebaseapp.com",
  projectId: "cs5v5stat",
  storageBucket: "cs5v5stat.firebasestorage.app",
  messagingSenderId: "661470089660",
  appId: "1:661470089660:web:cf4223104cfa07ef645bb9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);