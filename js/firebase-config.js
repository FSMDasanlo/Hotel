// js/firebase-config.js

// ATENCIÓN: Reemplaza el objeto firebaseConfig con tu propia configuración.
// La encontrarás en la consola de Firebase > Configuración del proyecto > General > Tus apps > SDK > Configuración
const firebaseConfig = {
  apiKey: "AIzaSyBZ_Y68gj3yrVOPAJxDhfp53Vrav62eoyY",
  authDomain: "hotelroomly.firebaseapp.com",
  projectId: "hotelroomly",
  storageBucket: "hotelroomly.firebasestorage.app",
  messagingSenderId: "784800585551",
  appId: "1:784800585551:web:464d350aa287d260c1d73a",
  measurementId: "G-845Z8Y6QMS"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar Cloud Firestore y obtener una referencia al servicio que usaremos en otros ficheros
const db = firebase.firestore();