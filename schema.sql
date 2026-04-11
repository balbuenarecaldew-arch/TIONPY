create extension if not exists "pgcrypto";

create table if not exists categories (
  id serial primary key,
  name text not null,
  slug text not null unique,
  emoji text not null default '📦'
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
  stock integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

  new.order_number := 'TION-' || today_text || '-' || lpad(seq::text, 4, '0');
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
  ('Celulares', 'telefonia', '📱'),
  ('Audio', 'audio', '🎧'),
  ('Gaming', 'gaming', '🎮'),
  ('Accesorios', 'accesorios', '🔌'),
  ('Smart Home', 'smart-home', '🏠'),
  ('Computacion', 'computacion', '💻')
on conflict (slug) do update
set
  name = excluded.name,
  emoji = excluded.emoji;
