// src/authUtils.js
import { auth, googleProvider } from "./firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
} from "firebase/auth";

// Signup (student/admin)
export const signUp = async (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

// Login
export const login = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// Google Login
export const googleSignIn = async () => {
  return signInWithPopup(auth, googleProvider);
};

// Forgot Password
export const resetPassword = async (email) => {
  return sendPasswordResetEmail(auth, email);
};

// Logout
export const logout = async () => {
  return signOut(auth);
};