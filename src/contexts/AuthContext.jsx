import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';
import {
  buildWelcomeBonusPatch,
  findReferrerByCode,
  generateUniqueReferralCode,
  normalizePhoneNumber,
  normalizePromotionProfile,
} from '../lib/promotions';

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

  async function ensurePromotionFields(profileData, firebaseUser) {
    const normalized = normalizePromotionProfile(profileData);
    const nextFields = {};

    if (!normalized.referral_code) {
      nextFields.referral_code = await generateUniqueReferralCode({
        fullName: normalized.full_name || firebaseUser.displayName || '',
        email: normalized.email || firebaseUser.email || '',
      });
    }

    if (!normalized.phone_normalized && normalized.phone) {
      nextFields.phone_normalized = normalizePhoneNumber(normalized.phone);
    }

    if (profileData?.credit_balance === null || profileData?.credit_balance === undefined) {
      nextFields.credit_balance = normalized.credit_balance;
    }

    if (!Array.isArray(profileData?.credit_history)) {
      nextFields.credit_history = normalized.credit_history;
    }

    if (profileData?.referred_by_code === null || profileData?.referred_by_code === undefined) {
      nextFields.referred_by_code = normalized.referred_by_code || '';
    }

    if (!Object.keys(nextFields).length) {
      return normalized;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(nextFields)
      .eq('id', normalized.id)
      .select()
      .single();

    if (error) {
      console.error('ensurePromotionFields error:', error);
      return normalized;
    }

    return normalizePromotionProfile(data);
  }

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
      const referralCode = await generateUniqueReferralCode({
        fullName: firebaseUser.displayName || '',
        email: firebaseUser.email || '',
      });

      const { data: created, error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          firebase_uid: firebaseUser.uid,
          email: firebaseUser.email,
          full_name: firebaseUser.displayName || '',
          phone_normalized: '',
          is_admin: firebaseUser.uid === env.VITE_ADMIN_UID,
          referral_code: referralCode,
          referred_by_code: '',
          credit_balance: 0,
          credit_history: [],
          welcome_bonus_granted: false,
          first_valid_purchase_processed: false,
          referral_reward_granted: false,
        })
        .select()
        .single();

      if (upsertError) {
        console.error('syncProfile upsert error:', upsertError);
        return;
      }

      const normalizedCreated = normalizePromotionProfile(created);
      setProfile(normalizedCreated);
      return normalizedCreated;
    }

    const ensuredProfile = await ensurePromotionFields(data, firebaseUser);
    setProfile(ensuredProfile);
    return ensuredProfile;
  }

  async function refreshProfile(targetUser = user) {
    if (!targetUser) {
      setProfile(null);
      return null;
    }

    return syncProfile(targetUser);
  }

  async function register({ email, password, fullName, phone, referralCode }) {
    if (!auth || !supabase) throw new Error('La app no esta configurada');

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    const normalizedPhone = phone.trim();
    const normalizedPhoneKey = normalizePhoneNumber(normalizedPhone);
    const normalizedReferralCode = referralCode?.trim() || '';

    if (normalizedPhoneKey) {
      const { data: existingPhone, error: phoneError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_normalized', normalizedPhoneKey)
        .maybeSingle();

      if (phoneError) throw phoneError;
      if (existingPhone) {
        throw new Error('Ese telefono ya esta asociado a otra cuenta');
      }
    }

    let referrerProfile = null;
    if (normalizedReferralCode) {
      referrerProfile = await findReferrerByCode(normalizedReferralCode);
      if (!referrerProfile) {
        throw new Error('El codigo de referido no existe');
      }

      if (referrerProfile.email === normalizedEmail) {
        throw new Error('No puedes usar tu propio codigo de referido');
      }

      if (
        normalizedPhoneKey
        && referrerProfile.phone_normalized
        && referrerProfile.phone_normalized === normalizedPhoneKey
      ) {
        throw new Error('No puedes usar tu propio codigo de referido');
      }
    }

    const ownReferralCode = await generateUniqueReferralCode({
      fullName: normalizedFullName,
      email: normalizedEmail,
    });
    const welcomePatch = buildWelcomeBonusPatch({});

    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

    try {
      await updateProfile(cred.user, { displayName: normalizedFullName });

      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          firebase_uid: cred.user.uid,
          email: normalizedEmail,
          full_name: normalizedFullName,
          phone: normalizedPhone,
          phone_normalized: normalizedPhoneKey,
          is_admin: cred.user.uid === env.VITE_ADMIN_UID,
          referral_code: ownReferralCode,
          referred_by_code: referrerProfile?.referral_code || '',
          referred_by_profile_id: referrerProfile?.id || null,
          ...welcomePatch,
        })
        .select()
        .single();

      if (error) throw error;

      const normalizedProfile = normalizePromotionProfile(data);
      setProfile(normalizedProfile);
      return cred.user;
    } catch (error) {
      try {
        await deleteUser(cred.user);
      } catch (deleteError) {
        console.error('No se pudo revertir el usuario de Firebase tras fallo de perfil', deleteError);
      }
      throw error;
    }
  }

  async function login({ email, password }) {
    if (!auth) throw new Error('La app no esta configurada');
    const normalizedEmail = email.trim().toLowerCase();
    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    return cred.user;
  }

  async function logout() {
    if (!auth) return;
    await signOut(auth);
    setProfile(null);
  }

  async function resetPassword(email) {
    if (!auth) throw new Error('La app no esta configurada');
    const normalizedEmail = email.trim().toLowerCase();
    await sendPasswordResetEmail(auth, normalizedEmail);
  }

  async function updateProfileData(fields) {
    if (!supabase || !user) throw new Error('La app no esta configurada');

    const nextFields = { ...fields };

    if (typeof nextFields.phone === 'string') {
      const nextPhone = nextFields.phone.trim();
      const nextPhoneKey = normalizePhoneNumber(nextPhone);

      if (nextPhoneKey) {
        const { data: existingPhone, error: phoneError } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone_normalized', nextPhoneKey)
          .neq('firebase_uid', user.uid)
          .maybeSingle();

        if (phoneError) throw phoneError;
        if (existingPhone) {
          throw new Error('Ese telefono ya esta asociado a otra cuenta');
        }
      }

      nextFields.phone = nextPhone;
      nextFields.phone_normalized = nextPhoneKey;
    }

    if (typeof nextFields.full_name === 'string') {
      nextFields.full_name = nextFields.full_name.trim();
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(nextFields)
      .eq('firebase_uid', user.uid)
      .select()
      .single();

    if (error) throw error;

    setProfile(normalizePromotionProfile(data));

    if (nextFields.full_name && user) {
      await updateProfile(user, { displayName: nextFields.full_name });
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
    refreshProfile,
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
