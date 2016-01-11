drop table if exists photos;
create table photos (
  id integer primary key autoincrement,
  photopath text not null,
  price integer not null
);

drop table if exists purchased;
create table purchased (
  id integer primary key autoincrement,
  photopath text not null
);
