import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !supabase) {
      setLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await syncProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  async function syncProfile(firebaseUser) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('firebase_uid', firebaseUser.uid)
      .maybeSingle();

    if (error) {
      console.error('syncProfile error:', error);
      return;
    }

    if (!data) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          firebase_uid: firebaseUser.uid,
          email: firebaseUser.email,
          full_name: firebaseUser.displayName || '',
          is_admin: firebaseUser.uid === env.VITE_ADMIN_UID,
        })
        .select()
        .single();
      setProfile(created);
    } else {
      setProfile(data);
    }
  }

  async function register({ email, password, fullName, phone }) {
    if (!auth || !supabase) throw new Error('La app no esta configurada');

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: fullName });

    const { data } = await supabase
      .from('profiles')
      .insert({
        firebase_uid: cred.user.uid,
        email,
        full_name: fullName,
        phone,
        is_admin: cred.user.uid === env.VITE_ADMIN_UID,
      })
      .select()
      .single();

    setProfile(data);
    return cred.user;
  }

  async function login({ email, password }) {
    if (!auth) throw new Error('La app no esta configurada');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
    setProfile(null);
  }

  async function resetPassword(email) {
    if (!auth) throw new Error('La app no esta configurada');
    await sendPasswordResetEmail(auth, email);
  }

  async function updateProfileData(fields) {
    if (!supabase || !user) throw new Error('La app no esta configurada');

    const { data } = await supabase
      .from('profiles')
      .update(fields)
      .eq('firebase_uid', user.uid)
      .select()
      .single();

    setProfile(data);

    if (fields.full_name && user) {
      await updateProfile(user, { displayName: fields.full_name });
    }
  }

  const isAdmin = profile?.is_admin || user?.uid === env.VITE_ADMIN_UID;

  const value = {
    user,
    profile,
    loading,
    isAdmin,
    register,
    login,
    logout,
    resetPassword,
    updateProfileData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
