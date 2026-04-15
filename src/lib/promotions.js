import { supabase } from './supabase';
import { CREDIT_HISTORY_KIND, COMMITTED_ORDER_STATUSES, PROMO_CONFIG } from '../config/promotions';

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function formatGs(amount) {
  return `Gs. ${Number(amount || 0).toLocaleString('es-PY')}`;
}

export function normalizeReferralCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('595')) return digits;
  if (digits.startsWith('0')) return `595${digits.slice(1)}`;
  if (digits.length === 9) return `595${digits}`;
  return digits;
}

export function normalizePromotionProfile(profile) {
  const creditHistory = Array.isArray(profile?.credit_history) ? profile.credit_history : [];

  return {
    ...(profile || {}),
    credit_balance: Math.max(Number(profile?.credit_balance || 0), 0),
    credit_history: creditHistory,
    referral_code: normalizeReferralCode(profile?.referral_code),
    referred_by_code: normalizeReferralCode(profile?.referred_by_code),
    referred_by_profile_id: profile?.referred_by_profile_id || null,
    phone_normalized: profile?.phone_normalized || normalizePhoneNumber(profile?.phone),
    welcome_bonus_granted: Boolean(profile?.welcome_bonus_granted),
    welcome_bonus_expires_at: profile?.welcome_bonus_expires_at || null,
    first_valid_purchase_processed: Boolean(profile?.first_valid_purchase_processed),
    referral_reward_granted: Boolean(profile?.referral_reward_granted),
    referral_reward_order_id: profile?.referral_reward_order_id || null,
  };
}

export function buildWelcomeBonusExpiry(referenceDate = new Date()) {
  return new Date(
    referenceDate.getTime() + PROMO_CONFIG.welcomeBonusDurationHours * 60 * 60 * 1000
  ).toISOString();
}

function randomReferralSuffix(length = 4) {
  let suffix = '';
  for (let index = 0; index < length; index += 1) {
    const next = Math.floor(Math.random() * REFERRAL_ALPHABET.length);
    suffix += REFERRAL_ALPHABET[next];
  }
  return suffix;
}

function referralBaseFromName(fullName, email = '') {
  const source = String(fullName || email || 'LUNA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const base = source.slice(0, 5) || 'LUNA';
  return base.padEnd(5, 'X');
}

export async function generateUniqueReferralCode({ fullName, email }) {
  if (!supabase) {
    throw new Error('La app no esta configurada');
  }

  const base = referralBaseFromName(fullName, email);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = normalizeReferralCode(`${base}${randomReferralSuffix(4)}`);
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle();

    if (error) throw error;
    if (!data) return code;
  }

  throw new Error('No se pudo generar un codigo de referido unico');
}

export async function findReferrerByCode(rawCode) {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('referral_code', code)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizePromotionProfile(data) : null;
}

function createHistoryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCreditHistoryEntry({
  kind,
  amount,
  reason,
  orderId = null,
  referredProfileId = null,
  referredProfileName = '',
  expiresAt = null,
}) {
  return {
    id: createHistoryId(),
    kind,
    amount: Number(amount || 0),
    reason,
    order_id: orderId,
    referred_profile_id: referredProfileId,
    referred_profile_name: referredProfileName,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };
}

export function withCreditHistoryEntry(profile, entry) {
  const current = normalizePromotionProfile(profile);
  const nextBalance = Math.max(current.credit_balance + Number(entry.amount || 0), 0);

  return {
    credit_balance: nextBalance,
    credit_history: [
      {
        ...entry,
        balance_after: nextBalance,
      },
      ...current.credit_history,
    ].slice(0, 80),
  };
}

export function hasCreditHistoryEntry(profile, matcher) {
  return normalizePromotionProfile(profile).credit_history.some((entry) => matcher(entry));
}

export function buildWelcomeBonusPatch(profile) {
  const expiresAt = buildWelcomeBonusExpiry();
  const historyEntry = createCreditHistoryEntry({
    kind: CREDIT_HISTORY_KIND.WELCOME,
    amount: PROMO_CONFIG.welcomeBonusAmount,
    reason: 'Bono de bienvenida',
    expiresAt,
  });

  return {
    ...withCreditHistoryEntry(profile, historyEntry),
    welcome_bonus_granted: true,
    welcome_bonus_expires_at: expiresAt,
  };
}

export function buildReferralRewardPatch(profile, { orderId, referredProfileId, referredProfileName }) {
  const historyEntry = createCreditHistoryEntry({
    kind: CREDIT_HISTORY_KIND.REFERRAL,
    amount: PROMO_CONFIG.referralRewardAmount,
    reason: 'Premio por referido',
    orderId,
    referredProfileId,
    referredProfileName,
  });

  return withCreditHistoryEntry(profile, historyEntry);
}

export function buildCreditUsagePatch(profile, { amount, orderId }) {
  const historyEntry = createCreditHistoryEntry({
    kind: CREDIT_HISTORY_KIND.USAGE,
    amount: -Math.abs(Number(amount || 0)),
    reason: 'Credito aplicado al pedido',
    orderId,
  });

  return withCreditHistoryEntry(profile, historyEntry);
}

export function buildCreditRefundPatch(profile, { amount, orderId }) {
  const historyEntry = createCreditHistoryEntry({
    kind: CREDIT_HISTORY_KIND.REFUND,
    amount: Math.abs(Number(amount || 0)),
    reason: 'Reintegro por pedido cancelado',
    orderId,
  });

  return withCreditHistoryEntry(profile, historyEntry);
}

export function getProfileCreditBalance(profile) {
  return normalizePromotionProfile(profile).credit_balance;
}

export function getCreditCheckoutState({
  subtotalAfterDiscount,
  totalBeforeCredits,
  availableCredit,
  useCredits,
}) {
  // La expiracion del bono de bienvenida queda guardada en perfil/historial.
  // No se descuenta automaticamente aqui para no mezclar en forma incorrecta
  // saldo de bienvenida y saldo ganado por referidos sin una billetera segmentada.
  const safeSubtotal = Math.max(Number(subtotalAfterDiscount || 0), 0);
  const safeTotal = Math.max(Number(totalBeforeCredits || 0), 0);
  const safeBalance = Math.max(Number(availableCredit || 0), 0);

  if (!safeBalance) {
    return {
      availableCredit: 0,
      applied: 0,
      maxApplicable: 0,
      canUse: false,
      reason: 'Todavia no tienes creditos disponibles.',
    };
  }

  if (safeSubtotal < PROMO_CONFIG.minimumOrderSubtotalForCredits) {
    return {
      availableCredit: safeBalance,
      applied: 0,
      maxApplicable: 0,
      canUse: false,
      reason: `Tus creditos se habilitan desde ${formatGs(PROMO_CONFIG.minimumOrderSubtotalForCredits)} en productos.`,
    };
  }

  const maxApplicable = Math.max(
    Math.min(
      safeBalance,
      PROMO_CONFIG.maxCreditPerOrder,
      safeTotal - PROMO_CONFIG.minimumRealPayment
    ),
    0
  );

  if (!maxApplicable) {
    return {
      availableCredit: safeBalance,
      applied: 0,
      maxApplicable: 0,
      canUse: false,
      reason: 'El pedido necesita un pago adicional para aplicar creditos.',
    };
  }

  return {
    availableCredit: safeBalance,
    applied: useCredits ? maxApplicable : 0,
    maxApplicable,
    canUse: true,
    reason: `Puedes usar hasta ${formatGs(maxApplicable)} en este pedido.`,
  };
}

export function getOrderEligibleSubtotal(order) {
  const pricing = order?.address_snapshot?.pricing || {};

  if (pricing.subtotal_after_discount !== undefined && pricing.subtotal_after_discount !== null) {
    return Number(pricing.subtotal_after_discount || 0);
  }

  if (pricing.subtotalAfterDiscount !== undefined && pricing.subtotalAfterDiscount !== null) {
    return Number(pricing.subtotalAfterDiscount || 0);
  }

  if (pricing.subtotal !== undefined && pricing.subtotal !== null) {
    const discount = Number(pricing.discount || 0);
    return Math.max(Number(pricing.subtotal || 0) - discount, 0);
  }

  return Number(order?.total || 0);
}

async function updateOrderPricing(order, nextPricing) {
  const nextAddressSnapshot = {
    ...(order.address_snapshot || {}),
    pricing: nextPricing,
  };

  const { error } = await supabase
    .from('orders')
    .update({ address_snapshot: nextAddressSnapshot })
    .eq('id', order.id);

  if (error) throw error;
}

async function refundOrderCreditsIfNeeded(order) {
  const pricing = order?.address_snapshot?.pricing || {};
  const creditApplied = Number(pricing.credit_applied || 0);

  if (creditApplied <= 0 || pricing.credit_refund_processed) {
    return false;
  }

  const { data: buyerData, error: buyerError } = await supabase
    .from('profiles')
    .select('*')
    .eq('firebase_uid', order.firebase_uid)
    .maybeSingle();

  if (buyerError) throw buyerError;
  if (!buyerData) return false;

  const buyerProfile = normalizePromotionProfile(buyerData);
  const alreadyRefunded = hasCreditHistoryEntry(
    buyerProfile,
    (entry) => entry.kind === CREDIT_HISTORY_KIND.REFUND && entry.order_id === order.id
  );

  if (!alreadyRefunded) {
    const refundPatch = buildCreditRefundPatch(buyerProfile, {
      amount: creditApplied,
      orderId: order.id,
    });

    const { error: refundError } = await supabase
      .from('profiles')
      .update(refundPatch)
      .eq('id', buyerProfile.id);

    if (refundError) throw refundError;
  }

  await updateOrderPricing(order, {
    ...pricing,
    credit_refund_processed: true,
    credit_refund_amount: creditApplied,
    credit_refund_processed_at: new Date().toISOString(),
  });

  return !alreadyRefunded;
}

async function rewardReferralIfNeeded(order) {
  const eligibleSubtotal = getOrderEligibleSubtotal(order);
  if (eligibleSubtotal < PROMO_CONFIG.minimumValidReferralPurchase) {
    return false;
  }

  const { data: buyerData, error: buyerError } = await supabase
    .from('profiles')
    .select('*')
    .eq('firebase_uid', order.firebase_uid)
    .maybeSingle();

  if (buyerError) throw buyerError;
  if (!buyerData) return false;

  const buyerProfile = normalizePromotionProfile(buyerData);
  if (!buyerProfile.referred_by_profile_id || buyerProfile.first_valid_purchase_processed) {
    return false;
  }

  const { data: referrerData, error: referrerError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', buyerProfile.referred_by_profile_id)
    .maybeSingle();

  if (referrerError) throw referrerError;
  if (!referrerData) return false;

  const referrerProfile = normalizePromotionProfile(referrerData);
  const isSameIdentity = referrerProfile.id === buyerProfile.id
    || (buyerProfile.email && referrerProfile.email && buyerProfile.email === referrerProfile.email)
    || (
      buyerProfile.phone_normalized
      && referrerProfile.phone_normalized
      && buyerProfile.phone_normalized === referrerProfile.phone_normalized
    );

  if (isSameIdentity) {
    await supabase
      .from('profiles')
      .update({
        first_valid_purchase_processed: true,
        referral_reward_granted: false,
        referral_reward_order_id: order.id,
      })
      .eq('id', buyerProfile.id);
    return false;
  }

  const { count: rewardedCount, error: countError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('referred_by_profile_id', referrerProfile.id)
    .eq('referral_reward_granted', true);

  if (countError) throw countError;

  const rewardAlreadyCreated = hasCreditHistoryEntry(
    referrerProfile,
    (entry) => entry.kind === CREDIT_HISTORY_KIND.REFERRAL && entry.order_id === order.id
  );

  if (!rewardAlreadyCreated && (rewardedCount || 0) < PROMO_CONFIG.maxRewardedReferrals) {
    const rewardPatch = buildReferralRewardPatch(referrerProfile, {
      orderId: order.id,
      referredProfileId: buyerProfile.id,
      referredProfileName: buyerProfile.full_name || buyerProfile.email || 'Cliente',
    });

    const { error: rewardError } = await supabase
      .from('profiles')
      .update(rewardPatch)
      .eq('id', referrerProfile.id);

    if (rewardError) throw rewardError;
  }

  const granted = rewardAlreadyCreated || (rewardedCount || 0) < PROMO_CONFIG.maxRewardedReferrals;
  const { error: buyerUpdateError } = await supabase
    .from('profiles')
    .update({
      first_valid_purchase_processed: true,
      referral_reward_granted: granted,
      referral_reward_order_id: order.id,
    })
    .eq('id', buyerProfile.id);

  if (buyerUpdateError) throw buyerUpdateError;

  return !rewardAlreadyCreated && granted;
}

export async function reconcileOrderPromotions(order) {
  if (!supabase || !order?.id) return { rewarded: false, refunded: false };

  const rewarded = COMMITTED_ORDER_STATUSES.has(order.status)
    ? await rewardReferralIfNeeded(order)
    : false;

  const refunded = order.status === 'cancelado'
    ? await refundOrderCreditsIfNeeded(order)
    : false;

  return { rewarded, refunded };
}

export async function fetchReferralSummary(profileId) {
  if (!supabase || !profileId) {
    return {
      registeredCount: 0,
      rewardedCount: 0,
      referrals: [],
    };
  }

  const [
    { count: registeredCount, error: registeredError },
    { count: rewardedCount, error: rewardedError },
    { data: referrals, error: referralsError },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by_profile_id', profileId),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by_profile_id', profileId)
      .eq('referral_reward_granted', true),
    supabase
      .from('profiles')
      .select('id, full_name, email, created_at, referral_reward_granted')
      .eq('referred_by_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (registeredError) throw registeredError;
  if (rewardedError) throw rewardedError;
  if (referralsError) throw referralsError;

  return {
    registeredCount: registeredCount || 0,
    rewardedCount: rewardedCount || 0,
    referrals: referrals || [],
  };
}
