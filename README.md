# NORTHLINE GARAGE — демонстрационный сайт автосервиса

Одностраничный сайт на Vite и Three.js.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # сборка в dist/
```

## Структура

- `index.html` — разметка всех секций: Hero, о сервисе, услуги, диагностика, преимущества, галерея, этапы, калькулятор, запись, FAQ, контакты, подвал.
- `src/style.css` — дизайн-токены и стили. Цвета задаются в `:root`.
- `src/data.js` — услуги, категории фильтра, условия калькулятора, информационные точки 3D-сцены и ID фотографий.
- `src/main.js` — меню, фильтр, табы, слайдер ТО, галерея и лайтбокс, калькулятор, валидация формы.
- `src/garage3d.js` — 3D-сцена (грузится отдельным чанком): поворотный круг со шкалой, свет, отражения, вращение, информационные точки, облегчённый режим для мобильных.

## 3D-модель

Сайт ищет `/public/models/auto-car.glb`. Если файла нет, строится процедурная концепт-модель без брендинга. Подробности в `public/models/README.md`.

Без WebGL вместо сцены показывается фотография. При включённом «уменьшении движения» отключаются автоповорот и вступительная анимация.

## Что условно

- Название, адрес, телефон, почта и режим работы — демонстрационные.
- Калькулятор работает на демонстрационных коэффициентах из `src/data.js` (`calc`) и прямо называет себя не прайс-листом.
- Форма записи ничего не отправляет. Для подключения замените обработчик `submit` в `src/main.js` на отправку в CRM, Telegram-бота или почту.
- Отзывов, сертификатов, партнёрств и статистики на сайте нет намеренно.

## Фотографии

Все снимки взяты с Unsplash (бесплатная лицензия Unsplash) и загружаются с `images.unsplash.com`. Снимки с хорошо видимыми логотипами марок исключены. Страницы снимков:

- https://unsplash.com/photos/mechanic-working-on-car-engine-UZUzvJEvKnI
- https://unsplash.com/photos/close-up-of-a-car-engine-with-many-wires-VZcQi2ZS2TU
- https://unsplash.com/photos/a-man-working-on-a-car-under-a-vehicle-K5624F8cipE
- https://unsplash.com/photos/close-up-of-a-cars-performance-brake-system-EpT-ZetoKm8
- https://unsplash.com/photos/a-close-up-of-a-brake-on-a-vehicle-ii4XEyJEm_I
- https://unsplash.com/photos/person-cleaning-car-tire-with-brush-8k_T1EwTySs
- https://unsplash.com/photos/person-polishing-a-blue-cars-hood-with-an-orbital-buffer-iXpjQNP__EQ
- https://unsplash.com/photos/a-man-sitting-in-a-car-using-a-laptop-computer-sEu9cAn7QLA
- https://unsplash.com/photos/mechanic-inspecting-car-engine-bEGTsOCnHro
- https://unsplash.com/photos/mechanic-using-a-wrench-on-a-car-engine-9gB7APNSquE
- https://unsplash.com/photos/a-man-working-on-a-tire-in-a-garage-9uHal2Dd9aE
- https://unsplash.com/photos/a-black-sports-car-in-a-dark-room-0xySZZ8OK1o
- https://unsplash.com/photos/the-back-end-of-a-car-in-a-dark-garage-Rgqw0tDbORw
- https://unsplash.com/photos/a-black-sports-car-parked-in-a-parking-garage-zDYAIPHH-0k
- https://unsplash.com/photos/black-cars-in-auto-repair-shop-JrC5BK-kWYE
- https://unsplash.com/photos/detailer-cleaning-the-dashboard-of-a-classic-car-5SmPnmCjwcU
- https://unsplash.com/photos/a-bunch-of-wrenches-and-other-tools-in-a-box-OegFhZfw6Ok

Перед коммерческим использованием фото стоит заменить снимками реальной мастерской клиента.
