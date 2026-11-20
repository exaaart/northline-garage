// Чистая математика и параметрические профили для процедурного спорт-купе GT.
// Вынесено отдельно от Three.js-рендерера для детерминированного модульного тестирования.

export const CAR_SPEC = {
  xMin: -2.32,
  xMax: 2.32,
  wheelR: 0.37,
  archR: 0.422,
  frontAxleX: 1.42,
  rearAxleX: -1.38,
  trackHalf: 0.805,
  frontTireW: 0.28,
  rearTireW: 0.31,
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const gaussian = (x, mu, sigma) => {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
};

/**
 * Монотонная кубическая интерполяция Эрмита (PCHIP) по отсортированным точкам [[x, y], ...].
 * Гарантирует C1-гладкость без осцилляций и «волн» на кузовных панелях.
 */
export function createPchip(points) {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const h = new Array(n - 1);
  const delta = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    delta[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const m = new Array(n).fill(0);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }
  return function evalPchip(x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    const dx = h[lo];
    const t = (x - xs[lo]) / dx;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * ys[lo] + h10 * dx * m[lo] + h01 * ys[lo + 1] + h11 * dx * m[lo + 1];
  };
}

// Продольные профили кузова GT-фастбэка (X от -2.32 корма до +2.32 нос)
const shoulderSpline = createPchip([
  [-2.32, 0.915],
  [-2.18, 0.935],
  [-1.80, 0.945],
  [-1.38, 0.958], // пик заднего крыла
  [-0.85, 0.920],
  [0.00, 0.878],  // поясная линия двери
  [0.85, 0.855],  // основание стойки A
  [1.42, 0.865],  // пик переднего крыла
  [1.92, 0.765],
  [2.16, 0.655],  // бровь фары
  [2.28, 0.565],
  [2.32, 0.495],  // кромка носа
]);

const centerHoodDeckSpline = createPchip([
  [-2.32, 0.935], // лёгкий дактейл-спойлер
  [-2.16, 0.942],
  [-1.80, 0.955],
  [-1.38, 0.968],
  [-0.85, 0.935],
  [0.00, 0.895],
  [0.92, 0.880],  // основание лобового стекла
  [1.42, 0.818],  // капот чуть ниже передних крыльев — спортивная пластика
  [1.92, 0.715],
  [2.16, 0.610],
  [2.28, 0.530],
  [2.32, 0.470],
]);

const rockerSpline = createPchip([
  [-2.32, 0.355], // вырез под задний диффузор
  [-2.12, 0.285],
  [-1.82, 0.195],
  [-0.95, 0.162],
  [0.00, 0.160],
  [0.99, 0.162],
  [1.84, 0.168],
  [2.14, 0.188],
  [2.32, 0.230],  // над передним сплиттером
]);

// Продольные профили кабины (крыша + остекление): X от -1.86 до +0.94
const roofCenterSpline = createPchip([
  [-1.86, 0.950], // переход заднего стекла в корму
  [-1.50, 1.095],
  [-1.08, 1.225],
  [-0.55, 1.305], // высшая точка крыши
  [0.02, 1.298],
  [0.44, 1.235],  // верхняя кромка лобового стекла
  [0.72, 1.055],
  [0.94, 0.875],  // нижняя кромка лобового стекла
]);

const roofHalfWSpline = createPchip([
  [-1.86, 0.695],
  [-1.45, 0.665],
  [-1.02, 0.625],
  [-0.50, 0.600],
  [0.05, 0.595],
  [0.44, 0.605],
  [0.72, 0.685],
  [0.94, 0.755],
]);

export function getArchCutoutY(x) {
  const { wheelR, archR, frontAxleX, rearAxleX } = CAR_SPEC;
  const dF = Math.abs(x - frontAxleX);
  if (dF < archR) {
    return wheelR + Math.sqrt(Math.max(0, archR * archR - dF * dF));
  }
  const dR = Math.abs(x - rearAxleX);
  if (dR < archR) {
    return wheelR + Math.sqrt(Math.max(0, archR * archR - dR * dR));
  }
  return 0;
}

export function getPlanHalfWidth(x) {
  const { frontAxleX, rearAxleX } = CAR_SPEC;
  // Базовая ширина «талии» по дверям + мускулистые расширители арок
  let w =
    0.892 +
    0.066 * gaussian(x, frontAxleX, 0.40) +
    0.086 * gaussian(x, rearAxleX, 0.47);

  // Плавное закругление носа (суперэллипс)
  if (x > 1.66) {
    const t = clamp((x - 1.66) / (CAR_SPEC.xMax - 1.66), 0, 1);
    const noseFactor = 1 - 0.31 * Math.pow(t, 2.25);
    w *= noseFactor;
  }
  // Плавное сужение кормы
  if (x < -1.72) {
    const t = clamp((-1.72 - x) / (-1.72 - CAR_SPEC.xMin), 0, 1);
    const tailFactor = 1 - 0.21 * Math.pow(t, 2.15);
    w *= tailFactor;
  }
  return w;
}

export function getLowerBodyProfile(x) {
  const yRocker = rockerSpline(x);
  const archY = getArchCutoutY(x);
  const inArch = archY > yRocker;
  const yBottom = inArch ? archY : yRocker;
  const yShoulder = shoulderSpline(x);
  const yCenter = centerHoodDeckSpline(x);
  const halfW = getPlanHalfWidth(x);

  // Деликатный аэродинамический «вырез» нижней части двери за передним колесом
  const doorScallop =
    -0.036 *
    smoothstep(-0.75, -0.15, x) *
    (1 - smoothstep(0.55, 0.98, x));

  // Лёгкий «силовой горб» на капоте
  const hoodDome =
    0.018 *
    smoothstep(0.95, 1.32, x) *
    (1 - smoothstep(1.85, 2.20, x));

  return {
    x,
    yBottom,
    yRocker,
    yShoulder,
    yCenter: yCenter + hoodDome,
    halfW,
    inArch,
    doorScallop,
  };
}

export function getCabinProfile(x) {
  const yTop = roofCenterSpline(x);
  const halfW = roofHalfWSpline(x);
  // Лёгкая поперечная выпуклость крыши/стекла
  const crown = 0.034 * smoothstep(-1.75, -0.9, x) * (1 - smoothstep(0.45, 0.90, x));
  return {
    x,
    yTop,
    yEdge: yTop - crown,
    halfW,
  };
}

/**
 * Генерирует упорядоченный массив продольных станций X с точным огибанием полуокружностей арок.
 */
export function buildLongitudinalStations(lite = false) {
  const { frontAxleX, rearAxleX, archR } = CAR_SPEC;
  const archSteps = lite ? 12 : 20;
  const xs = [];

  const pushRange = (a, b, count) => {
    for (let i = 0; i <= count; i++) {
      xs.push(a + ((b - a) * i) / count);
    }
  };

  // Корма до задней арки
  pushRange(CAR_SPEC.xMin, rearAxleX - archR - 0.015, lite ? 5 : 8);

  // Задняя арка (косинусное распределение для гладкой вертикальной кромки)
  for (let i = 0; i <= archSteps; i++) {
    const theta = Math.PI * (1 - i / archSteps);
    xs.push(rearAxleX + Math.cos(theta) * (archR - 0.0005));
  }

  // Средняя часть (двери)
  pushRange(rearAxleX + archR + 0.015, frontAxleX - archR - 0.015, lite ? 8 : 14);

  // Передняя арка
  for (let i = 0; i <= archSteps; i++) {
    const theta = Math.PI * (1 - i / archSteps);
    xs.push(frontAxleX + Math.cos(theta) * (archR - 0.0005));
  }

  // Передний свес до носа
  pushRange(frontAxleX + archR + 0.015, CAR_SPEC.xMax, lite ? 6 : 10);

  // Сортируем и убираем близкие дубликаты
  xs.sort((a, b) => a - b);
  const clean = [xs[0]];
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - clean[clean.length - 1] > 1e-4) {
      clean.push(xs[i]);
    }
  }
  return clean;
}

/**
 * Строит одно поперечное сечение нижнего кузова от левого нижнего края (-Z) через верх (Z=0)
 * до правого нижнего края (+Z). Возвращает массив точек [x, y, z].
 */
export function sampleLowerBodyRing(x) {
  const p = getLowerBodyProfile(x);
  const { yBottom, yShoulder, yCenter, halfW, inArch, doorScallop } = p;
  const hSpan = Math.max(0.04, yShoulder - yBottom);

  // Профиль правого полусечения от нижней кромки до центральной оси (z >= 0)
  // tSide: 0 = низ порога/арки, 1 = плечевой перелом
  const halfPts = [];
  const sideSamples = [
    // [vy, widthScale, extraScallop]
    [0.00, inArch ? 0.992 : 0.905, 0.0],
    [0.14, inArch ? 1.005 : 0.962, 0.35],
    [0.34, inArch ? 1.002 : 0.990, 1.00],
    [0.58, 1.000, 0.55],
    [0.82, 0.986, 0.10],
    [0.94, 0.956, 0.0],
    [1.00, 0.918, 0.0], // верхняя кромка плеча
  ];

  for (const [vy, wScale, sc] of sideSamples) {
    const y = yBottom + hSpan * vy;
    const z = Math.max(0.05, halfW * wScale + doorScallop * sc);
    halfPts.push([x, y, z]);
  }

  // Верхняя палуба от плеча к центру (z от ~0.918*halfW до 0)
  const topSteps = 5;
  const shoulderZ = halfPts[halfPts.length - 1][2];
  for (let i = 1; i <= topSteps; i++) {
    const u = i / topSteps; // 0 = плечо, 1 = центр (z=0)
    const z = shoulderZ * (1 - u);
    // Плавный профиль капота/крыльев: лёгкая ложбинка у края капота и купол к центру
    const blend = smoothstep(0, 1, u);
    const fenderPeak = 0.024 * Math.sin(u * Math.PI) * (1 - u * 0.55);
    const y = yShoulder + (yCenter - yShoulder) * blend + fenderPeak;
    halfPts.push([x, y, z]);
  }

  // Полное симметричное кольцо: левая сторона (снизу вверх) -> центр -> правая сторона (сверху вниз)
  const ring = [];
  for (let i = 0; i < halfPts.length; i++) {
    const pt = halfPts[i];
    ring.push([pt[0], pt[1], -pt[2]]);
  }
  for (let i = halfPts.length - 2; i >= 0; i--) {
    const pt = halfPts[i];
    ring.push([pt[0], pt[1], pt[2]]);
  }
  return ring;
}

/**
 * Строит индексированную сетку (positions, indices, uvs) из набора колец одинаковой длины.
 * Порядок обхода гарантирует внешние нормали (T_ring × T_station).
 */
export function buildLoftedMeshData(rings) {
  const numStations = rings.length;
  const ringLen = rings[0].length;
  const vertCount = numStations * ringLen;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  for (let i = 0; i < numStations; i++) {
    const u = numStations > 1 ? i / (numStations - 1) : 0;
    const ring = rings[i];
    for (let k = 0; k < ringLen; k++) {
      const idx = i * ringLen + k;
      const pt = ring[k];
      positions[idx * 3] = pt[0];
      positions[idx * 3 + 1] = pt[1];
      positions[idx * 3 + 2] = pt[2];
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = ringLen > 1 ? k / (ringLen - 1) : 0;
    }
  }

  const quadCount = (numStations - 1) * (ringLen - 1);
  const indices = new Uint32Array(quadCount * 6);
  let ptr = 0;
  for (let i = 0; i < numStations - 1; i++) {
    for (let k = 0; k < ringLen - 1; k++) {
      const a = i * ringLen + k;
      const b = (i + 1) * ringLen + k;
      const c = (i + 1) * ringLen + (k + 1);
      const d = i * ringLen + (k + 1);
      // Внешняя нормаль: (d - a) × (b - a)
      indices[ptr++] = a;
      indices[ptr++] = d;
      indices[ptr++] = b;
      indices[ptr++] = b;
      indices[ptr++] = d;
      indices[ptr++] = c;
    }
  }

  return { positions, indices, uvs, numStations, ringLen };
}

/**
 * Вычисляет симметричное положение тормозного суппорта в локальных координатах машины:
 * на передней оси суппорт смещён назад (-X), на задней — вперёд (+X), строго одинаково
 * на левом (-Z) и правом (+Z) бортах.
 */
export function getCaliperPlacement(axle, sideSign) {
  const isFront = axle === 'front';
  // В локальных координатах автомобиля: передний суппорт позади центра (-X), задний — спереди (+X)
  const offsetX = isFront ? -0.145 : 0.145;
  const offsetY = 0.085;
  const tiltZ = isFront ? 0.52 : -0.52;
  const offsetZ = sideSign * 0.055;
  return { offsetX, offsetY, offsetZ, tiltZ };
}

/**
 * Классифицирует локальную точку касания на автомобиле в одну из 4 зон обслуживания.
 */
export function classifyCarZone(localPoint, boxMinY, sizeX, sizeY, deckY = 0.06) {
  const fy = (localPoint.y - (boxMinY - deckY)) / Math.max(sizeY, 1e-4);
  const fx = localPoint.x / Math.max(sizeX / 2, 1e-4);
  if (fy < 0.36) return 'wheel';
  if (fx > 0.38) return 'engine';
  if (fy > 0.68 && fx > -0.68 && fx < 0.45) return 'cabin';
  return 'body';
}
