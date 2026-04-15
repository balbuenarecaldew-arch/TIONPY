import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'luna_roja_cart';
const LEGACY_STORAGE_KEYS = ['tionpy_cart'];

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const requestedQty = Math.max(1, Number(action.qty) || 1);
      const availableStock = Number(action.product.stock);
      const maxStock = Number.isFinite(availableStock) && availableStock > 0
        ? availableStock
        : requestedQty;
      const nextQty = Math.min(requestedQty, maxStock);

      if (nextQty <= 0) return state;

      const existing = state.find(i => i.id === action.product.id);
      if (existing) {
        return state.map(i =>
          i.id === action.product.id
            ? { ...i, qty: Math.min(i.qty + nextQty, maxStock) }
            : i
        );
      }
      return [...state, { ...action.product, qty: nextQty }];
    }
    case 'REMOVE':
      return state.filter(i => i.id !== action.id);
    case 'SET_QTY':
      if (action.qty <= 0) return state.filter(i => i.id !== action.id);
      return state.map(i =>
        i.id === action.id
          ? {
              ...i,
              qty: Math.max(
                1,
                Math.min(
                  action.qty,
                  Number.isFinite(Number(i.stock)) && Number(i.stock) > 0
                    ? Number(i.stock)
                    : action.qty
                )
              ),
            }
          : i
      );
    case 'CLEAR':
      return [];
    case 'LOAD':
      return action.items;
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const [directCheckoutItems, setDirectCheckoutItems] = useState(null);

  // Cargar desde localStorage al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
        || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
      if (saved) dispatch({ type: 'LOAD', items: JSON.parse(saved) });
    } catch {}
  }, []);

  // Guardar en localStorage cuando cambia el carrito
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const total    = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count    = items.reduce((sum, i) => sum + i.qty, 0);
  const checkoutItems = directCheckoutItems || items;
  const checkoutCount = checkoutItems.reduce((sum, i) => sum + i.qty, 0);
  const checkoutTotal = checkoutItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const hasDirectCheckout = Boolean(directCheckoutItems?.length);

  function addItem(product, qty = 1) { dispatch({ type: 'ADD', product, qty }); }
  function removeItem(id)          { dispatch({ type: 'REMOVE',  id }); }
  function setQty(id, qty)         { dispatch({ type: 'SET_QTY', id, qty }); }
  function clearCart()             { dispatch({ type: 'CLEAR' }); setDirectCheckoutItems(null); }
  function startDirectCheckout(product, qty = 1) {
    const availableStock = Number(product.stock);
    const maxStock = Number.isFinite(availableStock) && availableStock > 0
      ? availableStock
      : qty;
    const safeQty = Math.max(1, Math.min(qty, maxStock));
    setDirectCheckoutItems([{ ...product, qty: safeQty }]);
  }
  function clearDirectCheckout() {
    setDirectCheckoutItems(null);
  }

  return (
    <CartContext.Provider value={{
      items,
      total,
      count,
      checkoutItems,
      checkoutTotal,
      checkoutCount,
      hasDirectCheckout,
      addItem,
      removeItem,
      setQty,
      clearCart,
      startDirectCheckout,
      clearDirectCheckout,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}
