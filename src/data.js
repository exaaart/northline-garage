// Фото — Unsplash (бесплатная лицензия Unsplash). Страницы снимков перечислены в README.md.
export const img = (id, w = 1200, h) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=72`;

export const photos = {
  engineWork: 'photo-1615906655593-ad0386982a0f',
  engineWires: 'photo-1775285157647-73f29f910216',
  sportsLift: 'photo-1791425318454-bd945c35c8af',
  shopLifts: 'photo-1792793176006-a7b35e29c7e1',
  underCar: 'photo-1702146713858-8e7d1cc29fe8',
  brake: 'photo-1760317890322-364a810cd4da',
  brakeDisc: 'photo-1696494561430-de087dd0bd69',
  tireClean: 'photo-1708805282683-50a060eba80f',
  polishing: 'photo-1780558852670-3f49298ecc1f',
  laptopDiag: 'photo-1727893380169-4dda123e19f7',
  inspect: 'photo-1625047509248-ec889cbff17f',
  oil: 'photo-1775590766345-c117265f0c1b',
  wheelWrench: 'photo-1645445522156-9ac06bc7a767',
  darkCar: 'photo-1645400379459-f6fd3d963fd4',
  darkRear: 'photo-1698533189220-77a5eb6751bc',
  garageCar: 'photo-1720080829677-4a3156adddbd',
  shopCars: 'photo-1792326103553-4e4e8964279e',
  interior: 'photo-1771491237218-cbd4a707497e',
  tools: 'photo-1637640125496-31852f042a60',
};

export const categories = [
  { id: 'all', label: 'Все работы' },
  { id: 'diag', label: 'Диагностика' },
  { id: 'service', label: 'Плановое ТО' },
  { id: 'chassis', label: 'Ходовая и тормоза' },
  { id: 'wheels', label: 'Шины и колёса' },
  { id: 'electric', label: 'Электрика' },
  { id: 'detail', label: 'Детейлинг' },
];

// size: управляет местом карточки в bento-сетке
export const services = [
  {
    id: 'computer-diag', cat: 'diag', size: 'wide', photo: photos.laptopDiag,
    title: 'Компьютерная диагностика',
    text: 'Чтение ошибок всех блоков управления, живые параметры двигателя и коробки, отчёт с расшифровкой.',
  },
  {
    id: 'to-oil', cat: 'service', size: 'tall', photo: photos.oil,
    title: 'ТО по регламенту',
    text: 'Масло, фильтры, жидкости и контрольный осмотр по списку производителя для вашего пробега.',
  },
  {
    id: 'brakes', cat: 'chassis', size: 'std', photo: photos.brake,
    title: 'Тормозная система',
    text: 'Колодки, диски, суппорты, замена тормозной жидкости и проверка эффективности.',
  },
  {
    id: 'suspension', cat: 'chassis', size: 'std', photo: photos.underCar,
    title: 'Подвеска и рулевое',
    text: 'Поиск стуков и люфтов на подъёмнике, замена амортизаторов, рычагов и сайлентблоков.',
  },
  {
    id: 'alignment', cat: 'wheels', size: 'std', photo: photos.wheelWrench,
    title: 'Развал-схождение',
    text: 'Регулировка углов установки колёс с распечаткой значений до и после.',
  },
  {
    id: 'tires', cat: 'wheels', size: 'std', photo: photos.tireClean,
    title: 'Шиномонтаж и хранение',
    text: 'Сезонная смена, балансировка, ремонт проколов. Комплект можно оставить на хранение.',
  },
  {
    id: 'electric', cat: 'electric', size: 'wide', photo: photos.engineWires,
    title: 'Автоэлектрика',
    text: 'Утечки тока, проводка, стартер и генератор, свет, датчики и дополнительное оборудование.',
  },
  {
    id: 'engine-diag', cat: 'diag', size: 'std', photo: photos.inspect,
    title: 'Диагностика двигателя',
    text: 'Компрессия, эндоскопия цилиндров, дымогенератор для поиска подсосов воздуха.',
  },
  {
    id: 'polish', cat: 'detail', size: 'tall', photo: photos.polishing,
    title: 'Полировка и защита кузова',
    text: 'Восстановительная полировка, керамика, плёнка на зоны риска.',
  },
  {
    id: 'interior', cat: 'detail', size: 'std', photo: photos.interior,
    title: 'Химчистка салона',
    text: 'Сиденья, потолок, пластик и кожа: чистка и защитные составы.',
  },
];

// Демонстрационные условия калькулятора. Это не прайс-лист.
export const calc = {
  classes: [
    { id: 'compact', label: 'Компактный', hint: 'хэтчбек, малый седан', k: 1 },
    { id: 'mid', label: 'Средний', hint: 'седан, универсал, кроссовер', k: 1.2 },
    { id: 'large', label: 'Крупный', hint: 'внедорожник, минивэн', k: 1.45 },
  ],
  services: [
    { id: 'computer-diag', label: 'Компьютерная диагностика', base: 2500 },
    { id: 'to-oil', label: 'ТО: масло и фильтры', base: 4500, note: 'работа, без стоимости материалов' },
    { id: 'brakes', label: 'Тормозные колодки, одна ось', base: 3000, note: 'работа, без стоимости запчастей' },
    { id: 'suspension', label: 'Диагностика подвески', base: 1800 },
    { id: 'alignment', label: 'Развал-схождение', base: 3500 },
    { id: 'tires', label: 'Шиномонтаж, 4 колеса', base: 3200 },
    { id: 'electric', label: 'Поиск неисправности электрики', base: 3000, note: 'первый час работы' },
    { id: 'engine-diag', label: 'Диагностика двигателя', base: 3800 },
    { id: 'polish', label: 'Полировка кузова', base: 18000 },
    { id: 'interior', label: 'Химчистка салона', base: 12000 },
  ],
  extras: [
    { id: 'report', label: 'Подробный фото- и видеоотчёт', add: 0 },
    { id: 'wash', label: 'Мойка после работ', add: 900 },
    { id: 'urgent', label: 'Срочно, в день обращения', mul: 1.2 },
  ],
  spread: 0.15,
};

export const hotspots = [
  {
    id: 'engine', cat: 'service',
    title: 'Двигатель и ТО',
    text: 'Регламентное обслуживание, жидкости, ремни и фильтры. Проверяем и то, что обычно пропускают.',
  },
  {
    id: 'wheel', cat: 'chassis',
    title: 'Тормоза и подвеска',
    text: 'Колодки, диски, амортизаторы и рычаги. Осмотр на подъёмнике с фото каждого узла.',
  },
  {
    id: 'cabin', cat: 'electric',
    title: 'Электроника',
    text: 'Блоки управления, датчики, проводка. Мультимарочный сканер и осциллограф.',
  },
  {
    id: 'body', cat: 'detail',
    title: 'Кузов и детейлинг',
    text: 'Полировка, керамика, защитная плёнка и химчистка салона.',
  },
];
