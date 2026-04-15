const CATEGORY_META = [
  {
    name: 'Bebidas',
    slug: 'bebidas',
    emoji: 'MIX',
    badge: 'MIX',
    shortLabel: 'mezclas listas',
    description: 'Gaseosas y mixers para resolver rapido.',
    accent: '#F97316',
    surface: '#FFF7ED',
    gradient: 'linear-gradient(135deg, #1F2937 0%, #9A3412 100%)',
  },
  {
    name: 'Cervezas',
    slug: 'cervezas',
    emoji: 'CERV',
    badge: 'CERV',
    shortLabel: 'frias para la previa',
    description: 'Latas, botellas y packs para pedir sin vueltas.',
    accent: '#F59E0B',
    surface: '#FFFBEB',
    gradient: 'linear-gradient(135deg, #312E81 0%, #D97706 100%)',
  },
  {
    name: 'Destilados',
    slug: 'destilados',
    emoji: 'BAR',
    badge: 'BAR',
    shortLabel: 'botellas de noche',
    description: 'Whisky, vodka y ron con delivery express.',
    accent: '#DC2626',
    surface: '#FEF2F2',
    gradient: 'linear-gradient(135deg, #111827 0%, #991B1B 100%)',
  },
  {
    name: 'Sin alcohol',
    slug: 'sin-alcohol',
    emoji: 'ZERO',
    badge: 'ZERO',
    shortLabel: 'hidratacion rapida',
    description: 'Gaseosas, agua, jugos y energeticas.',
    accent: '#14B8A6',
    surface: '#ECFEFF',
    gradient: 'linear-gradient(135deg, #164E63 0%, #0F766E 100%)',
  },
  {
    name: 'Hielo',
    slug: 'hielo',
    emoji: 'ICE',
    badge: 'ICE',
    shortLabel: 'para enfriar al toque',
    description: 'Bolsas listas para la previa o la madrugada.',
    accent: '#38BDF8',
    surface: '#EFF6FF',
    gradient: 'linear-gradient(135deg, #0F172A 0%, #0EA5E9 100%)',
  },
  {
    name: 'Snacks',
    slug: 'snacks',
    emoji: 'SNK',
    badge: 'SNK',
    shortLabel: 'picoteo rapido',
    description: 'Papitas, mani, chocolates y algo dulce.',
    accent: '#F97316',
    surface: '#FFF7ED',
    gradient: 'linear-gradient(135deg, #7C2D12 0%, #EA580C 100%)',
  },
  {
    name: 'Farmacia basica',
    slug: 'farmacia-basica',
    emoji: 'OTC',
    badge: 'OTC',
    shortLabel: 'solo venta libre',
    description: 'Lo esencial para resolver sin receta.',
    accent: '#10B981',
    surface: '#ECFDF5',
    gradient: 'linear-gradient(135deg, #064E3B 0%, #10B981 100%)',
  },
  {
    name: 'Combos',
    slug: 'combos',
    emoji: 'COMBO',
    badge: 'COMBO',
    shortLabel: 'packs listos',
    description: 'Previa, fiesta, madrugada y resaca.',
    accent: '#8B5CF6',
    surface: '#F5F3FF',
    gradient: 'linear-gradient(135deg, #4C1D95 0%, #DB2777 100%)',
  },
];

const CATEGORY_META_BY_SLUG = Object.fromEntries(
  CATEGORY_META.map((item, index) => [
    item.slug,
    {
      ...item,
      order: index,
    },
  ])
);

const LEGACY_CATEGORY_SLUGS = new Set([
  'telefonia',
  'celulares',
  'audio',
  'computacion',
  'gaming',
  'accesorios',
  'smart-home',
]);

const LEGACY_PRODUCT_TERMS = [
  'auricular',
  'celular',
  'notebook',
  'teclado',
  'mouse',
  'smartwatch',
  'monitor',
  'consola',
  'gamer',
  'router',
  'parlante',
  'cargador',
];

export const CATEGORY_SEED = CATEGORY_META;

export const CATALOG_SEED_PRODUCTS = [
  {
    name: 'Soda 1.5 L',
    brand: 'Pritty',
    description: 'Ideal para mezclar tragos o acompanar una compra rapida.',
    price: 7000,
    old_price: null,
    stock: 30,
    category_slug: 'bebidas',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Pomelo tonica 1.5 L',
    brand: 'Paso de los Toros',
    description: 'Mixer fresco para whisky, vodka o tragos suaves.',
    price: 11000,
    old_price: 13000,
    stock: 24,
    category_slug: 'bebidas',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Cerveza lata 473 ml',
    brand: 'Pilsen',
    description: 'Lata fria lista para la previa, el partido o la ultima vuelta.',
    price: 12000,
    old_price: 14000,
    stock: 48,
    category_slug: 'cervezas',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Cerveza botella 1 litro',
    brand: 'Brahma',
    description: 'Botella retornable para compartir sin complicarte.',
    price: 16000,
    old_price: null,
    stock: 26,
    category_slug: 'cervezas',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Pack de cervezas x6',
    brand: 'Skol',
    description: 'Seis latas frias para arrancar la noche con un solo toque.',
    price: 62000,
    old_price: 69000,
    stock: 18,
    category_slug: 'cervezas',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Whisky 750 ml',
    brand: 'Johnnie Walker',
    description: 'Botella clasica para la previa con gaseosa, hielo y delivery rapido.',
    price: 135000,
    old_price: 148000,
    stock: 12,
    category_slug: 'destilados',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Vodka 750 ml',
    brand: 'Absolut',
    description: 'Para mezclar rapido y resolver la noche en pocos pasos.',
    price: 99000,
    old_price: 109000,
    stock: 10,
    category_slug: 'destilados',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Ron 750 ml',
    brand: 'Havana Club',
    description: 'Ideal para cola, hielo y una entrega sin vueltas.',
    price: 88000,
    old_price: null,
    stock: 10,
    category_slug: 'destilados',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Coca-Cola 1.5 L',
    brand: 'Coca-Cola',
    description: 'Fria y lista para mezclar o acompanar cualquier combo.',
    price: 11000,
    old_price: null,
    stock: 30,
    category_slug: 'sin-alcohol',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Pepsi 2 L',
    brand: 'Pepsi',
    description: 'Botella grande para fiestas, juntadas o pedidos de madrugada.',
    price: 10500,
    old_price: null,
    stock: 26,
    category_slug: 'sin-alcohol',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Agua mineral 1.5 L',
    brand: 'La Fuente',
    description: 'Para hidratarte rapido y sumar algo liviano al pedido.',
    price: 6000,
    old_price: null,
    stock: 35,
    category_slug: 'sin-alcohol',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Energetica 473 ml',
    brand: 'Monster',
    description: 'Lata grande para seguir o levantar la noche al instante.',
    price: 15000,
    old_price: 17000,
    stock: 28,
    category_slug: 'sin-alcohol',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Jugo citrico 1 L',
    brand: 'Watts',
    description: 'Opcion sin alcohol para acompanar snacks o farmacia basica.',
    price: 9000,
    old_price: null,
    stock: 20,
    category_slug: 'sin-alcohol',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Bolsa de hielo 2 kg',
    brand: 'Luna Roja',
    description: 'Bolsa practica para cerveza, tragos o delivery rapido.',
    price: 9000,
    old_price: null,
    stock: 24,
    category_slug: 'hielo',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Bolsa de hielo 5 kg',
    brand: 'Luna Roja',
    description: 'Mas hielo para fiestas, reuniones y pedidos grandes.',
    price: 18000,
    old_price: 21000,
    stock: 14,
    category_slug: 'hielo',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Papitas clasicas',
    brand: 'Pringles',
    description: 'Snack facil para sumar al combo o pedir solo en minutos.',
    price: 14000,
    old_price: null,
    stock: 22,
    category_slug: 'snacks',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Palitos salados',
    brand: 'Rumba',
    description: 'Picoteo rapido para la previa, la juntada o la madrugada.',
    price: 9000,
    old_price: null,
    stock: 20,
    category_slug: 'snacks',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Mani tostado',
    brand: 'Del Campo',
    description: 'Clasico para acompanar cerveza o una compra express.',
    price: 8000,
    old_price: null,
    stock: 18,
    category_slug: 'snacks',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Chocolates surtidos',
    brand: 'Arcor',
    description: 'Algo dulce para completar el pedido o levantar la noche.',
    price: 12000,
    old_price: null,
    stock: 16,
    category_slug: 'snacks',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Galletitas dulces',
    brand: 'Oreo',
    description: 'Compra simple para sumar a bebidas, energeticas o farmacia.',
    price: 10000,
    old_price: null,
    stock: 18,
    category_slug: 'snacks',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Paracetamol 500 mg',
    brand: 'Generico',
    description: 'Solo venta libre. Opcion basica para tener a mano de noche.',
    price: 7000,
    old_price: null,
    stock: 20,
    category_slug: 'farmacia-basica',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Ibuprofeno 400 mg',
    brand: 'Generico',
    description: 'Producto OTC para acompanar un pedido urgente.',
    price: 9000,
    old_price: null,
    stock: 18,
    category_slug: 'farmacia-basica',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Antiacido masticable',
    brand: 'Generico',
    description: 'Solo venta libre. Practico para la madrugada.',
    price: 8000,
    old_price: null,
    stock: 15,
    category_slug: 'farmacia-basica',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Suero oral',
    brand: 'Generico',
    description: 'Hidratacion rapida para tenerlo listo en casa.',
    price: 12000,
    old_price: null,
    stock: 14,
    category_slug: 'farmacia-basica',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Curitas x20',
    brand: 'Nexcare',
    description: 'Basico de botiquin para resolver pequenos imprevistos.',
    price: 9500,
    old_price: null,
    stock: 12,
    category_slug: 'farmacia-basica',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Preservativos x3',
    brand: 'Prime',
    description: 'Producto de venta libre para sumar al pedido de forma discreta.',
    price: 14000,
    old_price: null,
    stock: 18,
    category_slug: 'farmacia-basica',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Combo Previa',
    brand: 'Luna Roja',
    description: 'Cerveza lata, hielo 2 kg y papitas. Combo rapido para arrancar.',
    price: 29000,
    old_price: 35000,
    stock: 12,
    category_slug: 'combos',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Combo Fiesta',
    brand: 'Luna Roja',
    description: 'Whisky, Coca-Cola 1.5 L y hielo 5 kg para pedir en un solo paso.',
    price: 148000,
    old_price: 165000,
    stock: 8,
    category_slug: 'combos',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Combo Madrugada',
    brand: 'Luna Roja',
    description: 'Energeticas y snacks para seguir la noche con compra simple.',
    price: 36000,
    old_price: 42000,
    stock: 10,
    category_slug: 'combos',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
  {
    name: 'Combo Resaca',
    brand: 'Luna Roja',
    description: 'Paracetamol, suero oral y antiacido. Solo productos de venta libre.',
    price: 24000,
    old_price: 28000,
    stock: 16,
    category_slug: 'combos',
    is_active: true,
    image_url: '',
    image_urls: [],
  },
];

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

export function getCategorySlug(category) {
  if (!category) return '';
  if (typeof category === 'string') return normalizeSlug(category);
  return normalizeSlug(category.slug || category.name);
}

export function getCategoryMeta(category) {
  const slug = getCategorySlug(category);
  return CATEGORY_META_BY_SLUG[slug] || null;
}

export function getCategoryNameFromSlug(category) {
  const meta = getCategoryMeta(category);
  return meta?.name || '';
}

export function getCategoryLabel(category) {
  if (!category) return '';
  if (typeof category === 'string') {
    return getCategoryNameFromSlug(category) || category;
  }

  return getCategoryNameFromSlug(category.slug || category.name) || category.name || '';
}

export function sortCategoriesForStore(categories = []) {
  return [...categories].sort((left, right) => {
    const leftOrder = getCategoryMeta(left)?.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = getCategoryMeta(right)?.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return getCategoryLabel(left).localeCompare(getCategoryLabel(right));
  });
}

export function getProductCategorySlug(product) {
  return normalizeSlug(
    product?.categories?.slug ||
    product?.category_slug ||
    product?.category ||
    product?.category_name
  );
}

export function isAlcoholCategorySlug(slug) {
  return ['cervezas', 'destilados'].includes(normalizeSlug(slug));
}

export function isAlcoholProduct(product) {
  return isAlcoholCategorySlug(getProductCategorySlug(product));
}

export function isPharmacyProduct(product) {
  return getProductCategorySlug(product) === 'farmacia-basica';
}

export function isComboProduct(product) {
  return getProductCategorySlug(product) === 'combos' || String(product?.name || '').toLowerCase().includes('combo');
}

export function isQuickBuyProduct(product) {
  const slug = getProductCategorySlug(product);
  return ['snacks', 'sin-alcohol', 'hielo', 'farmacia-basica'].includes(slug) || isComboProduct(product);
}

export function getProductNotices(product) {
  const notices = [];

  if (isAlcoholProduct(product)) {
    notices.push('Venta solo para mayores de edad.');
  }

  if (isPharmacyProduct(product) || isComboProduct(product)) {
    const description = String(product?.description || '').toLowerCase();
    if (isPharmacyProduct(product) || description.includes('venta libre')) {
      notices.push('Solo productos de venta libre. No incluye medicamentos bajo receta.');
    }
  }

  return notices;
}

export function hasLegacyCatalog(categories = [], products = []) {
  const legacyCategory = (categories || []).some((category) =>
    LEGACY_CATEGORY_SLUGS.has(getCategorySlug(category))
  );

  if (legacyCategory) return true;

  return (products || []).some((product) => {
    const haystack = `${product?.name || ''} ${product?.brand || ''} ${product?.description || ''}`.toLowerCase();
    return LEGACY_PRODUCT_TERMS.some((term) => haystack.includes(term));
  });
}

export function buildSeedProductsPayload(categories = []) {
  const categoryIdBySlug = new Map(
    (categories || []).map((category) => [getCategorySlug(category), category.id])
  );

  return CATALOG_SEED_PRODUCTS.map((product) => ({
    name: product.name,
    brand: product.brand,
    description: product.description,
    price: product.price,
    old_price: product.old_price,
    stock: product.stock,
    is_active: product.is_active,
    image_url: product.image_url || '',
    image_urls: Array.isArray(product.image_urls) ? product.image_urls : [],
    category_id: categoryIdBySlug.get(product.category_slug) || null,
  }));
}

export function getMerchandisingSections(products = []) {
  const activeProducts = (products || []).filter((product) => product?.is_active !== false);

  const combos = activeProducts.filter(isComboProduct).slice(0, 4);
  const quick = activeProducts.filter(isQuickBuyProduct).slice(0, 8);
  const pharmacy = activeProducts.filter(isPharmacyProduct).slice(0, 4);
  const popular = activeProducts
    .filter((product) => !isComboProduct(product))
    .sort((left, right) => {
      const leftDiscount = left.old_price && left.old_price > left.price ? 1 : 0;
      const rightDiscount = right.old_price && right.old_price > right.price ? 1 : 0;
      if (leftDiscount !== rightDiscount) return rightDiscount - leftDiscount;
      return Number(right.stock || 0) - Number(left.stock || 0);
    })
    .slice(0, 8);

  return {
    combos,
    quick,
    pharmacy,
    popular,
  };
}
