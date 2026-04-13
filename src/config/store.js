export const storeConfig = {
  name: 'TIONPY',
  slogan: 'Compra desde tu zona de confort',
  city: 'Ayolas, Misiones',
  discounts: {
    memberPercent: 5,
    memberLabel: 'Descuento por registro',
  },
  shipping: {
    cost: 25000,
    freeFrom: 300000,
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
  categories: [
    'Celulares',
    'Audio',
    'Computacion',
    'Gaming',
    'Accesorios',
    'Smart Home',
  ],
};

const categoryLabelsBySlug = {
  telefonia: 'Celulares',
  celulares: 'Celulares',
  audio: 'Audio',
  computacion: 'Computacion',
  gaming: 'Gaming',
  accesorios: 'Accesorios',
  'smart-home': 'Smart Home',
};

export function getCategoryLabel(category) {
  if (!category) return '';

  if (typeof category === 'string') {
    return categoryLabelsBySlug[category] || category;
  }

  return categoryLabelsBySlug[category.slug] || category.name || '';
}
