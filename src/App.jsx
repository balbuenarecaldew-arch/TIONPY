import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { hasRequiredEnv, missingEnvVars } from './lib/env';
import Header from './components/Layout/Header';
import ShopPage from './components/Shop/ShopPage';
import ProductDetail from './components/Shop/ProductDetail';
import CartPage from './components/Cart/CartPage';
import CheckoutPage from './components/Checkout/CheckoutPage';
import MyOrders from './components/Orders/MyOrders';
import OrderDetail from './components/Orders/OrderDetail';
import ProfilePage from './components/Profile/ProfilePage';
import AdminLayout from './components/Admin/AdminLayout';
import ManageProducts from './components/Admin/ManageProducts';
import ManageOrders from './components/Admin/ManageOrders';
import AdminDashboard from './components/Admin/AdminDashboard';
import SetupRequired from './components/System/SetupRequired';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  if (!hasRequiredEnv) {
    return <SetupRequired missingEnvVars={missingEnvVars} />;
  }

  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<ShopPage />} />
          <Route path="/producto/:id" element={<ProductDetail />} />
          <Route path="/carrito" element={<CartPage />} />

          <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
          <Route path="/mis-pedidos" element={<RequireAuth><MyOrders /></RequireAuth>} />
          <Route path="/mis-pedidos/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/mi-cuenta" element={<RequireAuth><ProfilePage /></RequireAuth>} />

          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminDashboard />} />
            <Route path="productos" element={<ManageProducts />} />
            <Route path="pedidos" element={<ManageOrders />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
