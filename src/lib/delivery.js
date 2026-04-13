const DEFAULT_AMOUNT_FACTORS = [
  { minSubtotal: 0, maxSubtotal: 100000, factor: 1 },
  { minSubtotal: 100001, maxSubtotal: 200000, factor: 0.5 },
  { minSubtotal: 200001, maxSubtotal: null, factor: 0 },
];

export const DEFAULT_DELIVERY_SETTINGS = {
  enabled: true,
  origin: {
    address: '',
    mapsLink: '',
    latitude: null,
    longitude: null,
  },
  pricing: {
    pricePerKm: 2500,
    distanceMultiplier: 1,
    minFee: 0,
    maxFee: 30000,
    roundingStep: 500,
  },
  amountFactors: DEFAULT_AMOUNT_FACTORS,
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function hasValidCoordinates(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

export function parseCoordinatesFromMapInput(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  const directMatch = input.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (directMatch) {
    return { lat: Number(directMatch[1]), lng: Number(directMatch[2]) };
  }

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|destination|origin|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return { lat: Number(match[1]), lng: Number(match[2]) };
    }
  }

  return null;
}

export function formatFactorRange(rule) {
  const min = toNumber(rule?.minSubtotal, 0);
  const max = toNullableNumber(rule?.maxSubtotal);

  if (max === null) {
    return `Desde Gs. ${min.toLocaleString('es-PY')}`;
  }

  return `Gs. ${min.toLocaleString('es-PY')} a Gs. ${max.toLocaleString('es-PY')}`;
}

export function normalizeDeliverySettings(rawSettings) {
  const source = rawSettings || {};
  const origin = source.origin || {};
  const pricing = source.pricing || {};
  const amountFactors = Array.isArray(source.amountFactors) && source.amountFactors.length
    ? source.amountFactors
    : DEFAULT_AMOUNT_FACTORS;

  return {
    enabled: source.enabled !== false,
    origin: {
      address: String(origin.address || ''),
      mapsLink: String(origin.mapsLink || ''),
      latitude: toNullableNumber(origin.latitude),
      longitude: toNullableNumber(origin.longitude),
    },
    pricing: {
      pricePerKm: Math.max(0, toNumber(pricing.pricePerKm, DEFAULT_DELIVERY_SETTINGS.pricing.pricePerKm)),
      distanceMultiplier: Math.max(0.1, toNumber(pricing.distanceMultiplier, DEFAULT_DELIVERY_SETTINGS.pricing.distanceMultiplier)),
      minFee: Math.max(0, toNumber(pricing.minFee, DEFAULT_DELIVERY_SETTINGS.pricing.minFee)),
      maxFee: clamp(toNumber(pricing.maxFee, DEFAULT_DELIVERY_SETTINGS.pricing.maxFee), 0, 30000),
      roundingStep: Math.max(0, toNumber(pricing.roundingStep, DEFAULT_DELIVERY_SETTINGS.pricing.roundingStep)),
    },
    amountFactors: amountFactors
      .map((rule) => ({
        minSubtotal: Math.max(0, toNumber(rule?.minSubtotal, 0)),
        maxSubtotal: toNullableNumber(rule?.maxSubtotal),
        factor: Math.max(0, toNumber(rule?.factor, 1)),
      }))
      .sort((a, b) => a.minSubtotal - b.minSubtotal),
  };
}

export function getAmountFactorRule(subtotal, settings) {
  const normalized = normalizeDeliverySettings(settings);
  const total = Math.max(0, toNumber(subtotal, 0));

  return normalized.amountFactors.find((rule) => {
    const min = rule.minSubtotal;
    const max = rule.maxSubtotal;
    return total >= min && (max === null || total <= max);
  }) || normalized.amountFactors[normalized.amountFactors.length - 1];
}

function haversineDistanceKm(originLat, originLng, destinationLat, destinationLng) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(destinationLat - originLat);
  const dLng = toRadians(destinationLng - originLng);
  const lat1 = toRadians(originLat);
  const lat2 = toRadians(destinationLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function calculateDeliveryQuote({
  subtotalAfterDiscount,
  destinationLat,
  destinationLng,
  settings,
  fallbackCost = 0,
}) {
  const normalized = normalizeDeliverySettings(settings);
  const factorRule = getAmountFactorRule(subtotalAfterDiscount, normalized);
  const factor = factorRule?.factor ?? 1;

  if (!normalized.enabled) {
    return {
      available: false,
      mode: 'disabled',
      shipping: clamp(toNumber(fallbackCost, 0), 0, normalized.pricing.maxFee),
      factor,
      factorRule,
      distanceKm: null,
      adjustedDistanceKm: null,
      capped: false,
    };
  }

  if (factor <= 0) {
    return {
      available: true,
      mode: 'free',
      shipping: 0,
      factor,
      factorRule,
      distanceKm: 0,
      adjustedDistanceKm: 0,
      capped: false,
    };
  }

  if (
    !hasValidCoordinates(normalized.origin.latitude, normalized.origin.longitude) ||
    !hasValidCoordinates(destinationLat, destinationLng)
  ) {
    return {
      available: false,
      mode: 'fallback',
      shipping: clamp(toNumber(fallbackCost, 0), 0, normalized.pricing.maxFee),
      factor,
      factorRule,
      distanceKm: null,
      adjustedDistanceKm: null,
      capped: false,
    };
  }

  const distanceKm = haversineDistanceKm(
    Number(normalized.origin.latitude),
    Number(normalized.origin.longitude),
    Number(destinationLat),
    Number(destinationLng)
  );

  const adjustedDistanceKm = Math.max(distanceKm * normalized.pricing.distanceMultiplier, 0);
  const baseCost = adjustedDistanceKm * normalized.pricing.pricePerKm;
  const factoredCost = baseCost * factor;

  const roundedCost = normalized.pricing.roundingStep > 0
    ? Math.ceil(factoredCost / normalized.pricing.roundingStep) * normalized.pricing.roundingStep
    : Math.round(factoredCost);

  const shipping = clamp(
    Math.max(normalized.pricing.minFee, roundedCost),
    0,
    normalized.pricing.maxFee
  );

  return {
    available: true,
    mode: 'distance',
    shipping,
    factor,
    factorRule,
    distanceKm,
    adjustedDistanceKm,
    baseCost,
    roundedCost,
    capped: shipping !== Math.max(normalized.pricing.minFee, roundedCost),
  };
}
