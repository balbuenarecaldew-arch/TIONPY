export const PROMO_CONFIG = Object.freeze({
  welcomeBonusAmount: 10000,
  referralRewardAmount: 10000,
  minimumOrderSubtotalForCredits: 40000,
  minimumValidReferralPurchase: 40000,
  maxRewardedReferrals: 3,
  maxCreditPerOrder: 10000,
  minimumRealPayment: 1000,
  welcomeBonusDurationHours: 72,
});

export const CREDIT_HISTORY_KIND = Object.freeze({
  WELCOME: 'welcome_bonus',
  REFERRAL: 'referral_reward',
  USAGE: 'credit_usage',
  REFUND: 'credit_refund',
});

export const COMMITTED_ORDER_STATUSES = new Set([
  'confirmado',
  'preparando',
  'en_camino',
  'entregado',
]);
