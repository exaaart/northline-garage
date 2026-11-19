import { img, photos, categories, services, calc, hotspots } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rub = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n / 50) * 50) + ' ₽';

/* ---------- Header и меню ---------- */
const hdr = $('#hdr');
const nav = $('#nav');
const burger = $('#burger');
const onScroll = () => hdr.classList.toggle('is-solid', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

function setMenu(open) {
  nav.classList.toggle('is-open', open);
  hdr.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  document.body.style.overflow = open ? 'hidden' : '';
}
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
addEventListener('keydown', (e) => e.key === 'Escape' && nav.classList.contains('is-open') && setMenu(false));
matchMedia('(min-width: 1024px)').addEventListener('change', (e) => e.matches && setMenu(false));

// Подсветка текущего раздела
const navLinks = $$('.nav a[href^="#"]:not(.btn)');
const secObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + en.target.id));
    });
  },
  { rootMargin: '-45% 0px -50% 0px' }
);
navLinks.forEach((a) => {
  const s = $(a.getAttribute('href'));
  if (s) secObs.observe(s);
});

/* ---------- 3D Hero ---------- */
const stage = $('#stage');
const hsEls = Object.fromEntries($$('.hs').map((b) => [b.dataset.hs, b]));
const hsPanel = $('#hs-panel');
let openHs = null;
const desktop = matchMedia('(min-width: 1024px)');

let garage = null;
const showFallback = () => {
  $('#stage-fallback').hidden = false;
  $('#car-canvas').hidden = true;
  $('#hotspots').hidden = true;
  $('.readout').hidden = true;
  $('#stage-src').textContent = 'WebGL недоступен — показано фото';
};
import('./garage3d.js').then(({ initGarage }) => { garage = initGarage({
  canvas: $('#car-canvas'),
  stage,
  modelUrl: '/models/auto-car.glb',
  hotspotEls: hsEls,
  getShift: () => (desktop.matches ? 0.2 : 0),
  onAzimuth: (deg) => ($('#az').textContent = String(deg).padStart(3, '0')),
  onHover: (zone) => Object.entries(hsEls).forEach(([id, el]) => el.classList.toggle('is-hot', id === zone)),
  onSource: (src) => {
    $('#stage-src').textContent =
      src === 'model' ? '3D-модель: auto-car.glb' : 'Концепт-модель. Замените файлом /models/auto-car.glb';
  },
  onFail: showFallback,
}); }).catch(showFallback);

$$('[data-nudge]').forEach((b) => b.addEventListener('click', () => garage?.nudge(Number(b.dataset.nudge))));

function showHotspot(id) {
  const h = hotspots.find((x) => x.id === id);
  if (!h) return;
  openHs = h;
  Object.entries(hsEls).forEach(([k, el]) => {
    el.classList.toggle('is-open', k === id);
    el.setAttribute('aria-expanded', String(k === id));
  });
  $('#hs-title').textContent = h.title;
  $('#hs-text').textContent = h.text;
  hsPanel.hidden = false;
}
function closeHotspot() {
  hsPanel.hidden = true;
  Object.values(hsEls).forEach((el) => {
    el.classList.remove('is-open');
    el.setAttribute('aria-expanded', 'false');
  });
  openHs = null;
}
Object.entries(hsEls).forEach(([id, el]) => {
  el.setAttribute('aria-expanded', 'false');
  el.addEventListener('click', () => (openHs?.id === id ? closeHotspot() : showHotspot(id)));
});
$('#hs-close').addEventListener('click', closeHotspot);
$('#hs-go').addEventListener('click', () => {
  if (!openHs) return;
  setFilter(openHs.cat);
  $('#services').scrollIntoView();
  closeHotspot();
});

/* ---------- Услуги ---------- */
const filterEl = $('#filter');
const bento = $('#bento');
let activeCat = 'all';
const catLabel = Object.fromEntries(categories.map((c) => [c.id, c.label]));

filterEl.innerHTML = categories
  .map((c) => {
    const n = c.id === 'all' ? services.length : services.filter((s) => s.cat === c.id).length;
    return `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === 'all'}">${c.label}<sup>${n}</sup></button>`;
  })
  .join('');
filterEl.addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (b) setFilter(b.dataset.cat);
});

function setFilter(cat) {
  activeCat = cat;
  $$('.chip', filterEl).forEach((b) => {
    const on = b.dataset.cat === cat;
    b.setAttribute('aria-pressed', String(on));
    if (on && filterEl.scrollWidth > filterEl.clientWidth) {
      filterEl.scrollTo({ left: b.offsetLeft - filterEl.offsetLeft - 16, behavior: 'smooth' });
    }
  });
  renderServices();
}

function renderServices() {
  const list = activeCat === 'all' ? services : services.filter((s) => s.cat === activeCat);
  const single = list.length <= 2;
  bento.innerHTML = list
    .map((s, i) => {
      const size = single ? (i === 0 ? 'wide' : 'wide') : s.size;
      return `<article class="card card--${size}" style="animation-delay:${i * 40}ms">
        <div class="card__img"><img loading="lazy" alt="" src="${img(s.photo, size === 'wide' ? 900 : 600)}"></div>
        <div class="card__body">
          <span class="card__cat">${catLabel[s.cat]}</span>
          <h3>${s.title}</h3>
          <p>${s.text}</p>
          <div class="card__acts">
            <button data-calc="${s.id}">Рассчитать</button>
            <button data-book="${s.id}">Записаться</button>
          </div>
        </div>
      </article>`;
    })
    .join('');
  if (activeCat === 'all') {
    bento.insertAdjacentHTML(
      'beforeend',
      `<article class="card card--wide card--note">
        <h3>Не нашли нужную работу?</h3>
        <div>
          <p>Опишите симптомы в заявке: мастер подскажет, с какой диагностики начать, и перезвонит.</p>
          <a class="btn btn--accent" href="#booking">Описать проблему</a>
        </div>
      </article>`
    );
  }
}
renderServices();

bento.addEventListener('click', (e) => {
  const c = e.target.closest('[data-calc]');
  const b = e.target.closest('[data-book]');
  if (c) {
    selectCalcService(c.dataset.calc);
    $('#calculator').scrollIntoView();
  }
  if (b) {
    $('#f-service').value = b.dataset.book;
    $('#booking').scrollIntoView();
  }
});

/* ---------- Табы диагностики ---------- */
const tabs = $$('.tab');
function selectTab(t) {
  tabs.forEach((x) => {
    const on = x === t;
    x.classList.toggle('is-on', on);
    x.setAttribute('aria-selected', String(on));
    x.tabIndex = on ? 0 : -1;
    $('#' + x.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    selectTab(n);
    n.focus();
  });
});

// ТО по пробегу (ориентировочные интервалы)
const toItems = [
  { t: 'Моторное масло и масляный фильтр', every: 15000 },
  { t: 'Салонный фильтр', every: 15000 },
  { t: 'Воздушный фильтр двигателя', every: 30000 },
  { t: 'Тормозная жидкость', every: 45000 },
  { t: 'Свечи зажигания', every: 60000 },
  { t: 'Масло в автоматической коробке', every: 60000 },
  { t: 'Охлаждающая жидкость', every: 90000 },
  { t: 'Ремень или цепь ГРМ: проверка и замена', every: 90000 },
];
const km = $('#km');
const toList = $('#to-list');
function renderTo() {
  const v = Number(km.value);
  $('#km-out').textContent = new Intl.NumberFormat('ru-RU').format(v);
  km.style.setProperty('--p', ((v - km.min) / (km.max - km.min)) * 100 + '%');
  toList.innerHTML = toItems
    .map((it) => {
      const on = v % it.every === 0;
      return `<li class="${on ? 'is-on' : ''}"><span>${it.t}</span><span>${on ? 'входит' : 'каждые ' + it.every / 1000 + ' тыс. км'}</span></li>`;
    })
    .join('');
}
km.addEventListener('input', renderTo);
renderTo();

/* ---------- Галерея ---------- */
const shots = [
  { id: photos.shopCars, w: 'w', cap: 'Автомобили в работе' },
  { id: photos.engineWork, w: 'n', cap: 'Работа с двигателем' },
  { id: photos.darkCar, w: 'm', cap: 'Кузов после полировки' },
  { id: photos.brakeDisc, w: 'n', cap: 'Тормозной механизм' },
  { id: photos.underCar, w: 'w', cap: 'Осмотр подвески снизу' },
  { id: photos.tools, w: 'n', cap: 'Инструмент' },
  { id: photos.polishing, w: 'm', cap: 'Полировка кузова' },
  { id: photos.darkRear, w: 'n', cap: 'Выдача после обслуживания' },
  { id: photos.garageCar, w: 'm', cap: 'Готов к выдаче' },
];
const track = $('#track');
track.innerHTML = shots
  .map(
    (s, i) => `<figure class="shot shot--${s.w}">
      <button data-i="${i}" aria-label="Открыть фото: ${s.cap}"><img loading="lazy" draggable="false" alt="${s.cap}" src="${img(s.id, s.w === 'w' ? 1200 : 800)}"></button>
      <figcaption><b>${String(i + 1).padStart(2, '0')}</b>${s.cap}</figcaption>
    </figure>`
  )
  .join('');
$('#g-total').textContent = String(shots.length).padStart(2, '0');
const shotEls = $$('.shot', track);

function currentShot() {
  const x = track.getBoundingClientRect().left + parseFloat(getComputedStyle(track).paddingLeft);
  let best = 0;
  let bd = Infinity;
  shotEls.forEach((el, i) => {
    const d = Math.abs(el.getBoundingClientRect().left - x);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
track.addEventListener('scroll', () => ($('#g-cur').textContent = String(currentShot() + 1).padStart(2, '0')), { passive: true });
const goShot = (d) => {
  const i = Math.max(0, Math.min(shotEls.length - 1, currentShot() + d));
  track.scrollTo({ left: shotEls[i].offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: 'smooth' });
};
$('#g-prev').addEventListener('click', () => goShot(-1));
$('#g-next').addEventListener('click', () => goShot(1));
track.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { e.preventDefault(); goShot(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); goShot(-1); }
});

// Перетаскивание мышью
let drag = null;
track.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') return;
  drag = { x: e.clientX, left: track.scrollLeft, moved: false };
});
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 5) {
    drag.moved = true;
    track.classList.add('is-drag');
  }
  if (drag.moved) track.scrollLeft = drag.left - dx;
});
addEventListener('pointerup', () => {
  if (!drag) return;
  const moved = drag.moved;
  track.classList.remove('is-drag');
  setTimeout(() => (drag = null), 0);
  if (moved) goShot(0);
});

// Лайтбокс
const lb = $('#lightbox');
track.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]');
  if (!b || drag?.moved) return;
  const s = shots[Number(b.dataset.i)];
  $('#lb-img').src = img(s.id, 1800);
  $('#lb-img').alt = s.cap;
  $('#lb-cap').textContent = s.cap;
  lb.showModal();
});
$('#lb-close').addEventListener('click', () => lb.close());
lb.addEventListener('click', (e) => e.target === lb && lb.close());

/* ---------- Калькулятор ---------- */
const st = { cls: 'mid', svc: 'computer-diag', extras: new Set(['report']) };
$('#calc-class').innerHTML = calc.classes
  .map(
    (c) => `<label class="tile"><input type="radio" name="cls" value="${c.id}" ${c.id === st.cls ? 'checked' : ''}>
      <span><b>${c.label}</b><small>${c.hint}</small></span></label>`
  )
  .join('');
$('#calc-svc').innerHTML = calc.services
  .map(
    (s) => `<label class="tile"><input type="radio" name="svc" value="${s.id}" ${s.id === st.svc ? 'checked' : ''}>
      <span><b>${s.label}</b>${s.note ? `<small>${s.note}</small>` : ''}</span></label>`
  )
  .join('');
$('#calc-extra').innerHTML = calc.extras
  .map(
    (x) => `<label class="check"><input type="checkbox" value="${x.id}" ${st.extras.has(x.id) ? 'checked' : ''}>
      <span>${x.label} ${x.mul ? `<small>×${x.mul}</small>` : x.add ? `<small>+${rub(x.add)}</small>` : '<small>без доплаты</small>'}</span></label>`
  )
  .join('');

$('#calc-form').addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'cls') st.cls = t.value;
  else if (t.name === 'svc') st.svc = t.value;
  else if (t.type === 'checkbox') t.checked ? st.extras.add(t.value) : st.extras.delete(t.value);
  renderCalc();
});

function calcResult() {
  const cls = calc.classes.find((c) => c.id === st.cls);
  const svc = calc.services.find((s) => s.id === st.svc);
  let v = svc.base * cls.k;
  let add = 0;
  let mul = 1;
  calc.extras.forEach((x) => {
    if (!st.extras.has(x.id)) return;
    if (x.add) add += x.add;
    if (x.mul) mul *= x.mul;
  });
  v = v * mul + add;
  return { cls, svc, lo: v * (1 - calc.spread), hi: v * (1 + calc.spread) };
}

function renderCalc() {
  const r = calcResult();
  $('#calc-val').textContent = `${rub(r.lo)} – ${rub(r.hi)}`;
  const ex = calc.extras.filter((x) => st.extras.has(x.id)).map((x) => x.label).join(', ') || 'нет';
  $('#calc-rows').innerHTML = [
    ['Услуга', r.svc.label],
    ['Класс', `${r.cls.label}, коэффициент ×${r.cls.k}`],
    ['Опции', ex],
    ['Что входит', r.svc.note || 'работа'],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');
}
function selectCalcService(id) {
  if (!calc.services.some((s) => s.id === id)) return;
  st.svc = id;
  const input = $(`#calc-svc input[value="${id}"]`);
  if (input) input.checked = true;
  renderCalc();
}
renderCalc();

$('#calc-book').addEventListener('click', () => {
  const r = calcResult();
  $('#f-service').value = r.svc.id;
  const note = $('#f-calc');
  note.hidden = false;
  note.textContent = `Предварительный демо-расчёт: ${r.svc.label}, ${r.cls.label.toLowerCase()} класс — ${rub(r.lo)} – ${rub(r.hi)}.`;
  $('#booking').scrollIntoView();
});

/* ---------- Форма записи ---------- */
const form = $('#booking-form');
const fService = $('#f-service');
fService.insertAdjacentHTML('beforeend', services.map((s) => `<option value="${s.id}">${s.title}</option>`).join(''));
$('#makes').innerHTML = [
  'Audi', 'BMW', 'Chery', 'Geely', 'Haval', 'Honda', 'Hyundai', 'Kia', 'Lada', 'Lexus', 'Mazda',
  'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Renault', 'Skoda', 'Subaru', 'Toyota', 'Volkswagen', 'Volvo',
].map((m) => `<option value="${m}">`).join('');

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const maxDate = new Date();
maxDate.setDate(maxDate.getDate() + 60);
const fDate = $('#f-date');
fDate.min = iso(tomorrow);
fDate.max = iso(maxDate);

const rules = {
  name: (v) => v.trim().length >= 2,
  phone: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 10 && d.length <= 11; },
  make: (v) => v.trim().length >= 2,
  model: (v) => v.trim().length >= 1,
  year: (v) => !v || (Number(v) >= 1980 && Number(v) <= 2027),
  date: (v) => !!v && v >= fDate.min && v <= fDate.max,
  consent: (_, el) => el.checked,
};
function check(el) {
  const fn = rules[el.name];
  if (!fn) return true;
  const ok = fn(el.value, el);
  el.closest('.field, .consent')?.classList.toggle('is-invalid', !ok);
  el.setAttribute('aria-invalid', String(!ok));
  return ok;
}
form.addEventListener('blur', (e) => e.target.name && e.target.value && check(e.target), true);
form.addEventListener('input', (e) => {
  if (e.target.closest('.is-invalid')) check(e.target);
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const els = Object.keys(rules).map((n) => form.elements[n]);
  const bad = els.filter((el) => !check(el));
  if (bad.length) {
    bad[0].focus();
    return;
  }
  const d = new FormData(form);
  const svc = services.find((s) => s.id === d.get('service'));
  const date = new Date(d.get('date') + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
  $('#done-text').textContent =
    `${d.get('name').trim()}, мы бы перезвонили по номеру ${d.get('phone').trim()} и подтвердили запись.\n` +
    `Автомобиль: ${d.get('make').trim()} ${d.get('model').trim()}. Услуга: ${svc ? svc.title.toLowerCase() : 'консультация'}.\n` +
    `Дата: ${date}, ${d.get('slot').toLowerCase()}.\n\n` +
    'Это демонстрационная форма — данные никуда не отправлены.';
  form.hidden = true;
  const done = $('#form-done');
  done.hidden = false;
  done.focus();
});
$('#form-again').addEventListener('click', () => {
  form.reset();
  $('#f-calc').hidden = true;
  $$('.is-invalid', form).forEach((x) => x.classList.remove('is-invalid'));
  $('#form-done').hidden = true;
  form.hidden = false;
  form.elements.name.focus();
});
