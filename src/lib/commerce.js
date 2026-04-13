export function getMemberDiscountRate(storeConfig) {
  return storeConfig?.discounts?.memberPercent || 0;
}

export function getMemberDiscountAmount(subtotal, isRegistered, storeConfig) {
  if (!isRegistered) return 0;
  const rate = getMemberDiscountRate(storeConfig);
  return Math.round((subtotal * rate) / 100);
}

export function getShippingCost(subtotalAfterDiscount, storeConfig) {
  const freeFrom = storeConfig?.shipping?.freeFrom || 0;
  const shippingCost = storeConfig?.shipping?.cost || 0;
  return subtotalAfterDiscount >= freeFrom ? 0 : shippingCost;
}

export function buildCheckoutSummary(items, isRegistered, storeConfig) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = getMemberDiscountAmount(subtotal, isRegistered, storeConfig);
  const subtotalAfterDiscount = Math.max(subtotal - discount, 0);
  const shipping = getShippingCost(subtotalAfterDiscount, storeConfig);
  const total = subtotalAfterDiscount + shipping;

  return {
    subtotal,
    discount,
    subtotalAfterDiscount,
    shipping,
    total,
    memberDiscountRate: getMemberDiscountRate(storeConfig),
  };
}

export function getMemberPrice(price, storeConfig) {
  const rate = getMemberDiscountRate(storeConfig);
  if (!rate) return price;
  return Math.max(price - Math.round((price * rate) / 100), 0);
}

export function generateDeliveryCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
