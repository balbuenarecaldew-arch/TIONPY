import { CATEGORY_SEED, getCategoryLabel as getCatalogCategoryLabel } from './catalog';

export const storeConfig = {
  name: 'Luna Roja',
  slogan: 'Tu bodega express',
  tagline: 'Pedidos rapidos de noche',
  description: 'Bebidas, hielo, snacks, farmacia basica y combos listos para pedir desde el celular.',
  city: 'Ayolas, Misiones',
  discounts: {
    memberPercent: 5,
    memberLabel: 'Ahorro por cuenta',
  },
  shipping: {
    cost: 8000,
    freeFrom: 120000,
  },
  payments: {
    primary: 'Contra entrega',
    secondary: 'Transferencia',
  },
  contact: {
    whatsapp: '',
    email: '',
  },
  transfer: {
    owner: '',
    bank: '',
    account: '',
  },
  admin: {
    email: 'sewyllconstrucciones@gmail.com',
  },
  service: {
    eta: '20 a 35 min',
    coverage: 'Cobertura en Ayolas centro y zonas cercanas',
    hours: '18:00 a 03:00',
    quickMessage: 'Combos listos para la previa, la madrugada o una compra urgente.',
  },
  notices: {
    alcohol: 'Venta solo para mayores de edad.',
    pharmacy: 'Solo productos de venta libre. No incluye medicamentos bajo receta.',
  },
  categories: CATEGORY_SEED.map((category) => category.name),
};

export function getCategoryLabel(category) {
  return getCatalogCategoryLabel(category);
}
