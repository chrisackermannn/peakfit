// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAfnByDnS9VNb-xXUes_AUU3J8fN4937is",
  authDomain: "fir-basics-90f1d.firebaseapp.com",
  databaseURL: "https://fir-basics-90f1d-default-rtdb.firebaseio.com",
  projectId: "fir-basics-90f1d",
  storageBucket: "fir-basics-90f1d.firebasestorage.app",
  messagingSenderId: "1074755682998",
  appId: "1:1074755682998:web:ee6b4864876c7cba311c17",
  measurementId: "G-KG2ETG67DM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);