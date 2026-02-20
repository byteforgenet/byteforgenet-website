import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } 
from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZ3EbTS5n8qdejvWS1VozeSTnCbN7c9Ho",
  authDomain: "byteforgenet-d06b8.firebaseapp.com",
  projectId: "byteforgenet-d06b8",
  storageBucket: "byteforgenet-d06b8.appspot.com",
  messagingSenderId: "161297732100",
  appId: "1:161297732100:web:9505e71666a4d4945ddb51"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// 🔥 THIS LINE FIXES REDIRECT SESSION ISSUE
setPersistence(auth, browserLocalPersistence);

export const db = getFirestore(app);
