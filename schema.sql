create extension if not exists "pgcrypto";

create table if not exists categories (
  id serial primary key,
  name text not null,
  slug text not null unique,
  emoji text not null default 'CAT'
);

create table if not exists products (
  id serial primary key,
  name text not null,
  brand text not null default '',
  description text not null default '',
  price bigint not null,
  old_price bigint,
  category_id integer references categories(id) on delete set null,
  image_url text not null default '',
  image_urls jsonb not null default '[]'::jsonb,
  stock integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists products
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  label text not null default 'Casa',
  full_name text not null,
  phone text not null,
  street text not null,
  neighborhood text not null default '',
  city text not null default 'Ayolas, Misiones',
  reference text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists addresses
  add column if not exists maps_link text not null default '',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create table if not exists store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  firebase_uid text not null,
  customer_email text not null,
  customer_name text not null,
  address_snapshot jsonb not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmado', 'preparando', 'en_camino', 'entregado', 'cancelado')),
  total bigint not null,
  notes text not null default '',
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id serial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  product_id integer references products(id) on delete set null,
  product_snapshot jsonb not null,
  quantity integer not null check (quantity > 0),
  unit_price bigint not null
);

create table if not exists order_status_history (
  id serial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_updated_at on products;
create trigger products_updated_at
before update on products
for each row
execute function update_updated_at();

drop trigger if exists orders_updated_at on orders;
create trigger orders_updated_at
before update on orders
for each row
execute function update_updated_at();

create or replace function generate_order_number()
returns trigger as $$
declare
  today_text text;
  seq integer;
begin
  today_text := to_char(now(), 'YYYYMMDD');

  select count(*) + 1
    into seq
    from orders
   where date(created_at) = current_date;

  new.order_number := 'LUNA-' || today_text || '-' || lpad(seq::text, 4, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_order_number on orders;
create trigger set_order_number
before insert on orders
for each row
execute function generate_order_number();

create or replace function log_order_status()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into order_status_history(order_id, status)
    values (new.id, new.status);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists order_status_log on orders;
create trigger order_status_log
after update on orders
for each row
execute function log_order_status();

create index if not exists idx_products_category_id on products(category_id);
create index if not exists idx_profiles_firebase_uid on profiles(firebase_uid);
create index if not exists idx_addresses_firebase_uid on addresses(firebase_uid);
create index if not exists idx_orders_firebase_uid on orders(firebase_uid);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_order_status_history_order_id on order_status_history(order_id);

insert into categories (name, slug, emoji)
values
  ('Bebidas', 'bebidas', 'MIX'),
  ('Cervezas', 'cervezas', 'CERV'),
  ('Destilados', 'destilados', 'BAR'),
  ('Sin alcohol', 'sin-alcohol', 'ZERO'),
  ('Hielo', 'hielo', 'ICE'),
  ('Snacks', 'snacks', 'SNK'),
  ('Farmacia basica', 'farmacia-basica', 'OTC'),
  ('Combos', 'combos', 'COMBO')
on conflict (slug) do update
set
  name = excluded.name,
  emoji = excluded.emoji;

with seed_products(name, brand, description, price, old_price, category_slug, stock, is_active) as (
  values
    ('Soda 1.5 L', 'Pritty', 'Ideal para mezclar tragos o acompanar una compra rapida.', 7000, null, 'bebidas', 30, true),
    ('Pomelo tonica 1.5 L', 'Paso de los Toros', 'Mixer fresco para whisky, vodka o tragos suaves.', 11000, 13000, 'bebidas', 24, true),
    ('Cerveza lata 473 ml', 'Pilsen', 'Lata fria lista para la previa, el partido o la ultima vuelta.', 12000, 14000, 'cervezas', 48, true),
    ('Cerveza botella 1 litro', 'Brahma', 'Botella retornable para compartir sin complicarte.', 16000, null, 'cervezas', 26, true),
    ('Pack de cervezas x6', 'Skol', 'Seis latas frias para arrancar la noche con un solo toque.', 62000, 69000, 'cervezas', 18, true),
    ('Whisky 750 ml', 'Johnnie Walker', 'Botella clasica para la previa con gaseosa, hielo y delivery rapido.', 135000, 148000, 'destilados', 12, true),
    ('Vodka 750 ml', 'Absolut', 'Para mezclar rapido y resolver la noche en pocos pasos.', 99000, 109000, 'destilados', 10, true),
    ('Ron 750 ml', 'Havana Club', 'Ideal para cola, hielo y una entrega sin vueltas.', 88000, null, 'destilados', 10, true),
    ('Coca-Cola 1.5 L', 'Coca-Cola', 'Fria y lista para mezclar o acompanar cualquier combo.', 11000, null, 'sin-alcohol', 30, true),
    ('Pepsi 2 L', 'Pepsi', 'Botella grande para fiestas, juntadas o pedidos de madrugada.', 10500, null, 'sin-alcohol', 26, true),
    ('Agua mineral 1.5 L', 'La Fuente', 'Para hidratarte rapido y sumar algo liviano al pedido.', 6000, null, 'sin-alcohol', 35, true),
    ('Energetica 473 ml', 'Monster', 'Lata grande para seguir o levantar la noche al instante.', 15000, 17000, 'sin-alcohol', 28, true),
    ('Jugo citrico 1 L', 'Watts', 'Opcion sin alcohol para acompanar snacks o farmacia basica.', 9000, null, 'sin-alcohol', 20, true),
    ('Bolsa de hielo 2 kg', 'Luna Roja', 'Bolsa practica para cerveza, tragos o delivery rapido.', 9000, null, 'hielo', 24, true),
    ('Bolsa de hielo 5 kg', 'Luna Roja', 'Mas hielo para fiestas, reuniones y pedidos grandes.', 18000, 21000, 'hielo', 14, true),
    ('Papitas clasicas', 'Pringles', 'Snack facil para sumar al combo o pedir solo en minutos.', 14000, null, 'snacks', 22, true),
    ('Palitos salados', 'Rumba', 'Picoteo rapido para la previa, la juntada o la madrugada.', 9000, null, 'snacks', 20, true),
    ('Mani tostado', 'Del Campo', 'Clasico para acompanar cerveza o una compra express.', 8000, null, 'snacks', 18, true),
    ('Chocolates surtidos', 'Arcor', 'Algo dulce para completar el pedido o levantar la noche.', 12000, null, 'snacks', 16, true),
    ('Galletitas dulces', 'Oreo', 'Compra simple para sumar a bebidas, energeticas o farmacia.', 10000, null, 'snacks', 18, true),
    ('Paracetamol 500 mg', 'Generico', 'Solo venta libre. Opcion basica para tener a mano de noche.', 7000, null, 'farmacia-basica', 20, true),
    ('Ibuprofeno 400 mg', 'Generico', 'Producto OTC para acompanar un pedido urgente.', 9000, null, 'farmacia-basica', 18, true),
    ('Antiacido masticable', 'Generico', 'Solo venta libre. Practico para la madrugada.', 8000, null, 'farmacia-basica', 15, true),
    ('Suero oral', 'Generico', 'Hidratacion rapida para tenerlo listo en casa.', 12000, null, 'farmacia-basica', 14, true),
    ('Curitas x20', 'Nexcare', 'Basico de botiquin para resolver pequenos imprevistos.', 9500, null, 'farmacia-basica', 12, true),
    ('Preservativos x3', 'Prime', 'Producto de venta libre para sumar al pedido de forma discreta.', 14000, null, 'farmacia-basica', 18, true),
    ('Combo Previa', 'Luna Roja', 'Cerveza lata, hielo 2 kg y papitas. Combo rapido para arrancar.', 29000, 35000, 'combos', 12, true),
    ('Combo Fiesta', 'Luna Roja', 'Whisky, Coca-Cola 1.5 L y hielo 5 kg para pedir en un solo paso.', 148000, 165000, 'combos', 8, true),
    ('Combo Madrugada', 'Luna Roja', 'Energeticas y snacks para seguir la noche con compra simple.', 36000, 42000, 'combos', 10, true),
    ('Combo Resaca', 'Luna Roja', 'Paracetamol, suero oral y antiacido. Solo productos de venta libre.', 24000, 28000, 'combos', 16, true)
)
insert into products (name, brand, description, price, old_price, category_id, stock, is_active)
select
  seed.name,
  seed.brand,
  seed.description,
  seed.price,
  seed.old_price,
  categories.id,
  seed.stock,
  seed.is_active
from seed_products as seed
left join categories on categories.slug = seed.category_slug
where not exists (
  select 1
  from products
  where products.name = seed.name
);

insert into store_settings (key, value)
values (
  'delivery',
  '{
    "enabled": true,
    "origin": {
      "address": "",
      "mapsLink": "",
      "latitude": null,
      "longitude": null
    },
    "pricing": {
      "pricePerKm": 2500,
      "distanceMultiplier": 1,
      "minFee": 0,
      "maxFee": 30000,
      "roundingStep": 500
    },
    "amountFactors": [
      { "minSubtotal": 0, "maxSubtotal": 100000, "factor": 1 },
      { "minSubtotal": 100001, "maxSubtotal": 200000, "factor": 0.5 },
      { "minSubtotal": 200001, "maxSubtotal": null, "factor": 0 }
    ]
  }'::jsonb
)
on conflict (key) do nothing;
