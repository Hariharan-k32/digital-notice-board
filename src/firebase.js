import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDcnQJ3hZSpsMneCMa083eVFPDtIT3_lq4",
  authDomain: "digitalnoticeboard-67d3b.firebaseapp.com",
  projectId: "digitalnoticeboard-67d3b",
  storageBucket: "digitalnoticeboard-67d3b.appspot.com",
  messagingSenderId: "50737469186",
  appId: "1:50737469186:web:77aae34f20e88a0b36d41b",
  measurementId: "G-TER7Q6RZ30"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);