// Процедурная высокодетализированная 3D-модель спорт-купе GT без брендинга.
// Параметрическая индексированная сетка со сглаженными нормалями, раздельной кабиной,
// силуэтным салоном, закрытыми арками, оптикой и симметричной тормозной системой.
import * as THREE from 'three';
import {
  CAR_SPEC,
  buildLongitudinalStations,
  sampleLowerBodyRing,
  buildLoftedMeshData,
  getLowerBodyProfile,
  getCabinProfile,
  getCaliperPlacement,
} from './carMath.js';

const ACCENT = 0xff5f1f;

function createLoftGeometry(rings) {
  const { positions, indices, uvs } = buildLoftedMeshData(rings);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

// ---------- Процедурные PBR-текстуры ----------

function createCarTextures(maxAniso = 4) {
  // 1. Микрозерно металлика для автоэмали (тонкая bump/roughness карта)
  const flakeC = document.createElement('canvas');
  flakeC.width = 256;
  flakeC.height = 256;
  const fCtx = flakeC.getContext('2d');
  const fImg = fCtx.createImageData(256, 256);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < fImg.data.length; i += 4) {
    const v = 112 + Math.floor(rand() * 34);
    fImg.data[i] = v;
    fImg.data[i + 1] = v;
    fImg.data[i + 2] = v;
    fImg.data[i + 3] = 255;
  }
  fCtx.putImageData(fImg, 0, 0);
  const paintFlake = new THREE.CanvasTexture(flakeC);
  paintFlake.wrapS = THREE.RepeatWrapping;
  paintFlake.wrapT = THREE.RepeatWrapping;
  paintFlake.repeat.set(16, 16);
  paintFlake.anisotropy = maxAniso;

  // 2. Протектор и боковина шины (карта рельефа + шероховатости)
  const tireC = document.createElement('canvas');
  tireC.width = 512;
  tireC.height = 256;
  const tCtx = tireC.getContext('2d');
  tCtx.fillStyle = '#808080';
  tCtx.fillRect(0, 0, 512, 256);
  // 4 продольные водоотводные канавки в зоне протектора (y: 74..182)
  tCtx.fillStyle = '#222222';
  for (const gy of [96, 118, 138, 160]) {
    tCtx.fillRect(0, gy, 512, 5);
  }
  // Диагональные блоки протектора
  tCtx.strokeStyle = '#2e2e2e';
  tCtx.lineWidth = 4;
  for (let x = -32; x < 544; x += 24) {
    tCtx.beginPath();
    tCtx.moveTo(x, 74);
    tCtx.lineTo(x + 18, 118);
    tCtx.stroke();
    tCtx.beginPath();
    tCtx.moveTo(x + 18, 138);
    tCtx.lineTo(x, 182);
    tCtx.stroke();
  }
  // Тонкие кольцевые рёбра боковины
  tCtx.strokeStyle = '#9a9a9a';
  tCtx.lineWidth = 2;
  for (const sy of [36, 48, 208, 220]) {
    tCtx.beginPath();
    tCtx.moveTo(0, sy);
    tCtx.lineTo(512, sy);
    tCtx.stroke();
  }
  const tireBump = new THREE.CanvasTexture(tireC);
  tireBump.wrapS = THREE.RepeatWrapping;
  tireBump.wrapT = THREE.ClampToEdgeWrapping;
  tireBump.repeat.set(8, 1);
  tireBump.anisotropy = maxAniso;

  // 3. Перфорированный тормозной диск (цвет + радиальная шлифовка)
  const rotorC = document.createElement('canvas');
  rotorC.width = 512;
  rotorC.height = 512;
  const rCtx = rotorC.getContext('2d');
  rCtx.fillStyle = '#8b929a';
  rCtx.fillRect(0, 0, 512, 512);
  const cx = 256;
  const cy = 256;
  // Концентрические следы проточки диска
  for (let r = 90; r < 248; r += 2) {
    const tone = 122 + Math.floor(Math.sin(r * 0.7) * 22 + (r % 6 === 0 ? 14 : 0));
    rCtx.strokeStyle = `rgb(${tone},${tone + 3},${tone + 6})`;
    rCtx.lineWidth = 1.5;
    rCtx.beginPath();
    rCtx.arc(cx, cy, r, 0, Math.PI * 2);
    rCtx.stroke();
  }
  // Тёмная ступичная чашка
  rCtx.fillStyle = '#25292e';
  rCtx.beginPath();
  rCtx.arc(cx, cy, 102, 0, Math.PI * 2);
  rCtx.fill();
  // Криволинейные вентиляционные отверстия (cross-drilled)
  rCtx.fillStyle = '#14171a';
  for (let i = 0; i < 16; i++) {
    const baseA = (i / 16) * Math.PI * 2;
    for (let j = 0; j < 4; j++) {
      const rr = 128 + j * 30;
      const aa = baseA + j * 0.085;
      rCtx.beginPath();
      rCtx.arc(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, 4.2, 0, Math.PI * 2);
      rCtx.fill();
    }
  }
  const rotorMap = new THREE.CanvasTexture(rotorC);
  rotorMap.colorSpace = THREE.SRGBColorSpace;
  rotorMap.anisotropy = maxAniso;

  // 4. Сотовая решётка радиатора (hex honeycomb)
  const gridC = document.createElement('canvas');
  gridC.width = 256;
  gridC.height = 128;
  const gCtx = gridC.getContext('2d');
  gCtx.fillStyle = '#070809';
  gCtx.fillRect(0, 0, 256, 128);
  gCtx.strokeStyle = '#3a4048';
  gCtx.lineWidth = 2.2;
  const rad = 10;
  const dx = rad * 1.5;
  const dy = rad * Math.sqrt(3);
  for (let col = -1; col < 20; col++) {
    for (let row = -1; row < 10; row++) {
      const hx = col * dx;
      const hy = row * dy + (col % 2 ? dy / 2 : 0);
      gCtx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const px = hx + Math.cos(a) * rad;
        const py = hy + Math.sin(a) * rad;
        if (k === 0) gCtx.moveTo(px, py);
        else gCtx.lineTo(px, py);
      }
      gCtx.closePath();
      gCtx.stroke();
    }
  }
  const grilleMap = new THREE.CanvasTexture(gridC);
  grilleMap.colorSpace = THREE.SRGBColorSpace;
  grilleMap.wrapS = THREE.RepeatWrapping;
  grilleMap.wrapT = THREE.RepeatWrapping;
  grilleMap.repeat.set(3.5, 1.4);
  grilleMap.anisotropy = maxAniso;

  return {
    paintFlake,
    tireBump,
    rotorMap,
    grilleMap,
    dispose() {
      paintFlake.dispose();
      tireBump.dispose();
      rotorMap.dispose();
      grilleMap.dispose();
    },
  };
}

// ---------- Вспомогательные узлы кузова ----------

function buildFrontAndRearCaps(rings, paintMat, lite) {
  const group = new THREE.Group();
  const cols = lite ? 12 : 20;

  // Class-A горизонтально-профилированная фасция (без радиального стягивания и заломов в центре)
  const makeSmoothFascia = (edgeRing, bulgeX, isFront) => {
    const n = edgeRing.length;
    const mid = (n - 1) >> 1; // индекс центральной точки (верхний край, z=0)
    // Берём правую половину кольца от низа (k = n-1) до центра верха (k = mid)
    // Построим горизонтальные полосы от низа до верха
    const rows = 9;
    const xBase = edgeRing[mid][0];
    const yTopCenter = edgeRing[mid][1];
    const yBotOuter = edgeRing[n - 1][1];
    const zBotOuter = edgeRing[n - 1][2];

    // Сэмплируем край полукольца по высоте (снизу вверх)
    const rightHalf = [];
    for (let k = n - 1; k >= mid; k--) {
      rightHalf.push(edgeRing[k]);
    }

    const sampleEdgeAt = (v) => {
      // v = 0 (низ) .. 1 (верхняя кромка капота/крышки багажника)
      const f = v * (rightHalf.length - 1);
      const i0 = Math.min(Math.floor(f), rightHalf.length - 2);
      const t = f - i0;
      const a = rightHalf[i0];
      const b = rightHalf[i0 + 1];
      return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
    };

    // Строим сетку [col][row] так, чтобы createLoftGeometry дал внешние нормали
    const strips = [];
    for (let c = 0; c <= cols; c++) {
      const u = -1 + (2 * c) / cols; // -1 (левый борт) .. +1 (правый борт)
      const absU = Math.abs(u);
      const strip = [];
      for (let r = 0; r <= rows; r++) {
        const v = r / rows; // 0 (низ) .. 1 (верх)
        const edgePt = sampleEdgeAt(v);
        // Ширина на данной высоте (внизу берём внешнюю ширину, наверху плавно сужаем к капоту)
        const maxZ = Math.max(edgePt[2], zBotOuter * (1 - v * 0.25));
        const z = u * maxZ;
        // Плавная горизонтальная и вертикальная выпуклость бампера (Class-A)
        const horizCurve = Math.cos(absU * Math.PI * 0.5);
        const vertCurve = Math.sin(v * Math.PI);
        const x = xBase + bulgeX * (0.35 + 0.65 * horizCurve) * (0.35 + 0.65 * vertCurve);
        // По высоте — плавный купол к центру на верхней кромке
        const y =
          yBotOuter * (1 - v) +
          (edgePt[1] * absU + yTopCenter * (1 - absU)) * v;
        strip.push([x, y, z]);
      }
      strips.push(strip);
    }

    // Проверка ориентации: для +X (перед) при u: -1->+1 (+Z) и v: 0->1 (+Y):
    // T_strip = +Y, T_station = +Z => T_strip × T_station = (+Y) × (+Z) = +X (НАРУЖУ!)
    // Для -X (зад) разворачиваем порядок станций, чтобы нормаль смотрела в -X!
    if (!isFront) strips.reverse();
    const geo = createLoftGeometry(strips);
    return new THREE.Mesh(geo, paintMat);
  };

  group.add(makeSmoothFascia(rings[rings.length - 1], 0.085, true));
  group.add(makeSmoothFascia(rings[0], -0.065, false));

  return group;
}

function buildWheelWells(wellMat, paintMat, lite) {
  const g = new THREE.Group();
  const seg = lite ? 20 : 34;
  const { wheelR, archR, frontAxleX, rearAxleX } = CAR_SPEC;

  // Полуцилиндрический свод арки: ось вдоль Z, полудуга строго ВВЕРХ (+Y) от -X до +X!
  const wellDepth = 0.42;
  const linerGeo = new THREE.CylinderGeometry(
    archR - 0.004,
    archR - 0.004,
    wellDepth,
    seg,
    1,
    true,
    0,
    Math.PI
  );
  // Сначала поворачиваем ось цилиндра на Z, затем поворачиваем полудугу из +X в +Y (вверх!)
  linerGeo.rotateX(Math.PI / 2);
  linerGeo.rotateZ(Math.PI / 2);

  // Глухая внутренняя стенка арки (в плоскости X-Y, y >= 0)
  const backGeo = new THREE.CircleGeometry(archR, seg, 0, Math.PI);
  // Тонкая окрашенная отбортовка арки, утопленная вровень с крылом
  const lipGeo = new THREE.TorusGeometry(archR - 0.003, 0.014, 8, seg, Math.PI);

  const wellMatInner = wellMat.clone();
  wellMatInner.side = THREE.DoubleSide;

  const axles = [
    { x: frontAxleX, zOuter: 0.936 },
    { x: rearAxleX, zOuter: 0.956 },
  ];

  for (const { x, zOuter } of axles) {
    for (const side of [-1, 1]) {
      const well = new THREE.Group();
      well.position.set(x, wheelR, 0);

      const liner = new THREE.Mesh(linerGeo, wellMatInner);
      liner.position.z = side * (zOuter - wellDepth * 0.5 - 0.015);
      well.add(liner);

      const back = new THREE.Mesh(backGeo, wellMatInner);
      back.position.z = side * (zOuter - wellDepth - 0.012);
      well.add(back);

      const lip = new THREE.Mesh(lipGeo, paintMat);
      lip.position.z = side * (zOuter - 0.012);
      well.add(lip);

      g.add(well);
    }
  }
  return { group: g, disposables: [linerGeo, backGeo, lipGeo, wellMatInner] };
}

function buildGreenhouseAndInterior(mats, lite) {
  const g = new THREE.Group();
  const disposables = [];

  // 1. Внутренний силуэт салона (виден через тонированное стекло для объёма и глубины)
  const interior = new THREE.Group();
  const cabinTubGeo = new THREE.BoxGeometry(1.72, 0.34, 1.24);
  const cabinTub = new THREE.Mesh(cabinTubGeo, mats.interior);
  cabinTub.position.set(-0.22, 0.72, 0);
  interior.add(cabinTub);

  const dashGeo = new THREE.BoxGeometry(0.46, 0.24, 1.28);
  const dash = new THREE.Mesh(dashGeo, mats.interior);
  dash.position.set(0.56, 0.88, 0);
  dash.rotation.z = -0.18;
  interior.add(dash);

  const consoleGeo = new THREE.BoxGeometry(1.38, 0.24, 0.22);
  const consoleMesh = new THREE.Mesh(consoleGeo, mats.trim);
  consoleMesh.position.set(-0.08, 0.82, 0);
  interior.add(consoleMesh);

  // Руль (левосторонний, z = -0.34)
  const wheelRimGeo = new THREE.TorusGeometry(0.145, 0.017, 10, 24);
  const steering = new THREE.Mesh(wheelRimGeo, mats.trim);
  steering.position.set(0.32, 0.96, -0.33);
  steering.rotation.y = Math.PI / 2;
  steering.rotation.x = 0.36;
  interior.add(steering);

  // Два спортивных кресла-ковша
  const seatBackGeo = new THREE.BoxGeometry(0.12, 0.56, 0.42);
  const seatHeadGeo = new THREE.BoxGeometry(0.11, 0.20, 0.24);
  for (const sz of [-0.34, 0.34]) {
    const back = new THREE.Mesh(seatBackGeo, mats.interior);
    back.position.set(-0.34, 0.96, sz);
    back.rotation.z = 0.28;
    interior.add(back);

    const head = new THREE.Mesh(seatHeadGeo, mats.interior);
    head.position.set(-0.43, 1.20, sz);
    head.rotation.z = 0.14;
    interior.add(head);
  }
  disposables.push(cabinTubGeo, dashGeo, consoleGeo, wheelRimGeo, seatBackGeo, seatHeadGeo);
  g.add(interior);

  // 2. Единый обтекаемый купол тонированного остекления (чуть утоплен под стойки и крышу)
  const glassXs = [];
  const gSteps = lite ? 18 : 30;
  for (let i = 0; i <= gSteps; i++) {
    glassXs.push(-1.84 + ((0.94 - -1.84) * i) / gSteps);
  }
  const glassRings = glassXs.map((x) => {
    const cp = getCabinProfile(x);
    const lp = getLowerBodyProfile(x);
    const yBase = Math.min(lp.yShoulder - 0.02, cp.yEdge - 0.02);
    const baseW = Math.min(lp.halfW * 0.88, cp.halfW + 0.16);
    const topW = cp.halfW - 0.014;
    const yEdge = cp.yEdge - 0.012;
    const yTop = cp.yTop - 0.012;

    const half = [
      [x, yBase, baseW],
      [x, yBase + (yEdge - yBase) * 0.35, baseW + (topW - baseW) * 0.32],
      [x, yBase + (yEdge - yBase) * 0.72, baseW + (topW - baseW) * 0.70],
      [x, yEdge, topW],
      [x, yEdge + (yTop - yEdge) * 0.55, topW * 0.62],
      [x, yEdge + (yTop - yEdge) * 0.90, topW * 0.28],
      [x, yTop, 0],
    ];
    const ring = [];
    for (let i = 0; i < half.length; i++) ring.push([half[i][0], half[i][1], -half[i][2]]);
    for (let i = half.length - 2; i >= 0; i--) ring.push([half[i][0], half[i][1], half[i][2]]);
    return ring;
  });
  const glassGeo = createLoftGeometry(glassRings);
  disposables.push(glassGeo);
  const glassMesh = new THREE.Mesh(glassGeo, mats.glass);
  glassMesh.renderOrder = 2;
  g.add(glassMesh);

  // 3. Окрашенные стойки A, продольные рейлинги крыши и фастбэк-стойки C (левая и правая)
  const buildRoofRailCurve = (side) => {
    const pts = [];
    const railXs = [-1.85, -1.55, -1.20, -0.82, -0.35, 0.12, 0.44, 0.70, 0.93];
    for (const x of railXs) {
      const cp = getCabinProfile(x);
      pts.push(new THREE.Vector3(x, cp.yEdge + 0.004, side * (cp.halfW + 0.002)));
    }
    return new THREE.CatmullRomCurve3(pts);
  };

  for (const side of [-1, 1]) {
    const railCurve = buildRoofRailCurve(side);
    const railGeo = new THREE.TubeGeometry(railCurve, lite ? 24 : 42, 0.028, 10, false);
    disposables.push(railGeo);
    g.add(new THREE.Mesh(railGeo, mats.paint));

    // Тёмно-титановый молдинг подоконной линии (DLO)
    const dloPts = [];
    for (const x of [-1.42, -1.05, -0.55, 0.0, 0.45, 0.85]) {
      const lp = getLowerBodyProfile(x);
      dloPts.push(new THREE.Vector3(x, lp.yShoulder + 0.012, side * (lp.halfW * 0.90)));
    }
    const dloGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dloPts), 20, 0.008, 6, false);
    disposables.push(dloGeo);
    g.add(new THREE.Mesh(dloGeo, mats.darkChrome));

    // Стойка B (глянцево-чёрная, вровень со стеклом)
    const bLow = getLowerBodyProfile(-0.16);
    const bTop = getCabinProfile(-0.22);
    const bPts = [
      new THREE.Vector3(-0.14, bLow.yShoulder, side * (bLow.halfW * 0.875)),
      new THREE.Vector3(-0.19, (bLow.yShoulder + bTop.yEdge) * 0.5, side * ((bLow.halfW * 0.875 + bTop.halfW) * 0.502)),
      new THREE.Vector3(-0.24, bTop.yEdge, side * (bTop.halfW - 0.004)),
    ];
    const bPillarGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bPts), 8, 0.022, 6, false);
    disposables.push(bPillarGeo);
    g.add(new THREE.Mesh(bPillarGeo, mats.glossBlack));

    // Широкая мускулистая задняя стойка C (fastback flying buttress)
    const cRings = [];
    for (const x of [-1.85, -1.62, -1.36, -1.10, -0.88]) {
      const cp = getCabinProfile(x);
      const lp = getLowerBodyProfile(x);
      const t = (x - -1.85) / (-0.88 - -1.85);
      const lowerY = lp.yShoulder + 0.01 + t * (cp.yEdge - lp.yShoulder) * 0.42;
      const lowerZ = side * (lp.halfW * 0.885 - t * 0.10);
      const upperY = cp.yEdge + 0.008;
      const upperZ = side * (cp.halfW + 0.006);
      const innerZ = side * (cp.halfW - 0.055);
      const ring = side > 0
        ? [[x, lowerY, lowerZ], [x, upperY, upperZ], [x, upperY + 0.005, innerZ]]
        : [[x, upperY + 0.005, innerZ], [x, upperY, upperZ], [x, lowerY, lowerZ]];
      cRings.push(ring);
    }
    const cPillarGeo = createLoftGeometry(cRings);
    disposables.push(cPillarGeo);
    g.add(new THREE.Mesh(cPillarGeo, mats.paint));
  }

  // 4. Металлическая крыша + панорамная вставка
  const roofXs = [-1.06, -0.82, -0.52, -0.20, 0.14, 0.44];
  const roofRings = roofXs.map((x) => {
    const cp = getCabinProfile(x);
    const w = cp.halfW + 0.004;
    const pts = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const u = -1 + (2 * i) / steps;
      const z = u * w;
      const y = cp.yTop + 0.006 - (cp.yTop - cp.yEdge) * (u * u);
      pts.push([x, y, z]);
    }
    return pts;
  });
  const roofGeo = createLoftGeometry(roofRings);
  disposables.push(roofGeo);
  g.add(new THREE.Mesh(roofGeo, mats.paint));

  const panRings = [-0.92, -0.60, -0.24, 0.08, 0.34].map((x) => {
    const cp = getCabinProfile(x);
    const w = cp.halfW * 0.72;
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const u = -1 + (2 * i) / 6;
      const z = u * w;
      const y = cp.yTop + 0.009 - (cp.yTop - cp.yEdge) * (u * u * 0.52);
      pts.push([x, y, z]);
    }
    return pts;
  });
  const panGeo = createLoftGeometry(panRings);
  disposables.push(panGeo);
  g.add(new THREE.Mesh(panGeo, mats.panoramicRoof));

  return { group: g, disposables };
}

function buildAeroOpticsAndTrim(mats, lite) {
  const g = new THREE.Group();
  const disposables = [];

  // 1. Плоское закрытое днище
  const underGeo = new THREE.BoxGeometry(4.30, 0.14, 1.46);
  const under = new THREE.Mesh(underGeo, mats.underbody);
  under.position.set(0.0, 0.22, 0);
  g.add(under);
  disposables.push(underGeo);

  // 2. Передний карбоновый/сатиновый сплиттер
  const splitterShape = new THREE.Shape();
  splitterShape.moveTo(1.78, -0.84);
  splitterShape.quadraticCurveTo(2.26, -0.74, 2.38, -0.44);
  splitterShape.quadraticCurveTo(2.44, 0.0, 2.38, 0.44);
  splitterShape.quadraticCurveTo(2.26, 0.74, 1.78, 0.84);
  splitterShape.lineTo(1.78, -0.84);
  const splitterGeo = new THREE.ExtrudeGeometry(splitterShape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelThickness: 0.007,
    bevelSize: 0.007,
    bevelSegments: 2,
    curveSegments: lite ? 12 : 24,
  });
  splitterGeo.rotateX(-Math.PI / 2);
  const splitter = new THREE.Mesh(splitterGeo, mats.carbon);
  splitter.position.set(0, 0.145, 0);
  g.add(splitter);
  disposables.push(splitterGeo);

  // 3. Передняя нижняя решётка радиатора (соты) + рамка + аэропланка
  const grilleGeo = new THREE.BoxGeometry(0.06, 0.18, 1.02);
  const grille = new THREE.Mesh(grilleGeo, mats.grille);
  grille.position.set(2.355, 0.295, 0);
  g.add(grille);

  const grilleFrameGeo = new THREE.BoxGeometry(0.07, 0.022, 1.08);
  const grilleTop = new THREE.Mesh(grilleFrameGeo, mats.glossBlack);
  grilleTop.position.set(2.362, 0.392, 0);
  g.add(grilleTop);

  const grilleBladeGeo = new THREE.BoxGeometry(0.08, 0.013, 0.98);
  const grilleBlade = new THREE.Mesh(grilleBladeGeo, mats.darkChrome);
  grilleBlade.position.set(2.37, 0.305, 0);
  g.add(grilleBlade);
  disposables.push(grilleGeo, grilleFrameGeo, grilleBladeGeo);

  // Боковые воздухозаборники переднего бампера
  const intakeGeo = new THREE.BoxGeometry(0.08, 0.15, 0.22);
  const intakeFinGeo = new THREE.BoxGeometry(0.10, 0.013, 0.23);
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(intakeGeo, mats.grille);
    intake.position.set(2.26, 0.295, side * 0.64);
    intake.rotation.y = side * -0.46;
    g.add(intake);

    const fin = new THREE.Mesh(intakeFinGeo, mats.carbon);
    fin.position.set(2.27, 0.295, side * 0.65);
    fin.rotation.y = side * -0.46;
    g.add(fin);
  }
  disposables.push(intakeGeo, intakeFinGeo);

  // 4. Обтекаемые утопленные передние фары (без торчащих углов!)
  // Профилированный корпус-капля, повторяющий наклон крыла и капота
  const hlPodGeo = new THREE.SphereGeometry(0.16, 18, 12);
  hlPodGeo.scale(1.65, 0.28, 0.85);
  const hlLensGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.035, 16);
  hlLensGeo.rotateZ(Math.PI / 2);

  for (const side of [-1, 1]) {
    const hl = new THREE.Group();
    hl.position.set(2.07, 0.612, side * 0.625);
    hl.rotation.set(side * 0.14, side * -0.34, -0.33);

    // Глянцево-чёрная обтекаемая ниша фары (утоплена в крыло)
    const pod = new THREE.Mesh(hlPodGeo, mats.glossBlack);
    hl.add(pod);

    // Две чёткие LED-линзы
    for (const [lx, lz] of [[0.14, -0.042], [0.09, 0.038]]) {
      const lens = new THREE.Mesh(hlLensGeo, mats.ledWhite);
      lens.position.set(lx, 0.018, side * lz);
      hl.add(lens);
    }

    // Изогнутый световод ДХО (TubeGeometry по обводу фары)
    const drlCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.20, 0.005, side * -0.085),
      new THREE.Vector3(0.16, 0.014, side * 0.02),
      new THREE.Vector3(0.04, 0.024, side * 0.098),
      new THREE.Vector3(-0.11, 0.026, side * 0.085),
    ]);
    const drlGeo = new THREE.TubeGeometry(drlCurve, 16, 0.0085, 8, false);
    disposables.push(drlGeo);
    hl.add(new THREE.Mesh(drlGeo, mats.ledWhite));

    g.add(hl);
  }
  disposables.push(hlPodGeo, hlLensGeo);

  // 5. Задний монофонарь-лезвие + 3D-секции габаритов в утопленной нише
  const tailCoveGeo = new THREE.BoxGeometry(0.08, 0.105, 1.40);
  const tailCove = new THREE.Mesh(tailCoveGeo, mats.glossBlack);
  tailCove.position.set(-2.33, 0.815, 0);
  g.add(tailCove);

  const tailBarGeo = new THREE.BoxGeometry(0.045, 0.020, 1.34);
  const tailBar = new THREE.Mesh(tailBarGeo, mats.ledRed);
  tailBar.position.set(-2.362, 0.822, 0);
  g.add(tailBar);

  const tailFinGeo = new THREE.BoxGeometry(0.052, 0.064, 0.016);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(tailFinGeo, mats.ledRed);
      fin.position.set(-2.356 + i * 0.007, 0.818, side * (0.48 + i * 0.075));
      fin.rotation.y = side * 0.18;
      g.add(fin);
    }
  }
  disposables.push(tailCoveGeo, tailBarGeo, tailFinGeo);

  // 6. Задний диффузор с 4 вертикальными аэродинамическими килями и сдвоенным выхлопом (2+2)
  const diffBaseGeo = new THREE.BoxGeometry(0.32, 0.19, 1.42);
  const diffBase = new THREE.Mesh(diffBaseGeo, mats.carbon);
  diffBase.position.set(-2.21, 0.255, 0);
  diffBase.rotation.z = 0.16;
  g.add(diffBase);

  const diffFinGeo = new THREE.BoxGeometry(0.24, 0.17, 0.018);
  for (const fz of [-0.30, -0.10, 0.10, 0.30]) {
    const fin = new THREE.Mesh(diffFinGeo, mats.glossBlack);
    fin.position.set(-2.29, 0.235, fz);
    fin.rotation.z = 0.14;
    g.add(fin);
  }

  // Четыре полых металлических патрубка выхлопа
  const pipeOuterGeo = new THREE.CylinderGeometry(0.045, 0.047, 0.14, 20, 1, true);
  pipeOuterGeo.rotateZ(Math.PI / 2);
  const pipeRimGeo = new THREE.TorusGeometry(0.045, 0.0055, 8, 20);
  pipeRimGeo.rotateY(Math.PI / 2);
  const pipeInnerGeo = new THREE.CircleGeometry(0.041, 16);
  pipeInnerGeo.rotateY(-Math.PI / 2);

  for (const pz of [-0.56, -0.44, 0.44, 0.56]) {
    const pipe = new THREE.Group();
    pipe.position.set(-2.325, 0.235, pz);
    pipe.add(new THREE.Mesh(pipeOuterGeo, mats.darkChrome));
    const rim = new THREE.Mesh(pipeRimGeo, mats.chrome);
    rim.position.x = -0.07;
    pipe.add(rim);
    const inner = new THREE.Mesh(pipeInnerGeo, mats.underbody);
    inner.position.x = -0.05;
    pipe.add(inner);
    g.add(pipe);
  }
  disposables.push(diffBaseGeo, diffFinGeo, pipeOuterGeo, pipeRimGeo, pipeInnerGeo);

  // 7. Боковые юбки (пороги) с тонким анодированным кантом #ff5f1f
  const skirtGeo = new THREE.BoxGeometry(1.94, 0.040, 0.11);
  const accentStripGeo = new THREE.BoxGeometry(1.74, 0.008, 0.012);
  const stalkGeo = new THREE.BoxGeometry(0.075, 0.092, 0.030);
  const mirrorCapGeo = new THREE.SphereGeometry(0.074, 16, 12);
  mirrorCapGeo.scale(1.45, 0.60, 1.02);
  const mirrorLedGeo = new THREE.BoxGeometry(0.10, 0.007, 0.010);
  const handleGeo = new THREE.BoxGeometry(0.16, 0.020, 0.020);
  const gillGeo = new THREE.BoxGeometry(0.11, 0.23, 0.020);

  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtGeo, mats.carbon);
    skirt.position.set(0.02, 0.158, side * 0.855);
    g.add(skirt);

    const strip = new THREE.Mesh(accentStripGeo, mats.accentStrip);
    strip.position.set(0.02, 0.172, side * 0.908);
    g.add(strip);

    // Зеркало + ножка
    const mir = new THREE.Group();
    mir.position.set(0.54, 0.865, side * 0.84);
    const stalk = new THREE.Mesh(stalkGeo, mats.glossBlack);
    stalk.position.set(0.0, 0.032, side * 0.045);
    stalk.rotation.x = side * 0.58;
    mir.add(stalk);

    const cap = new THREE.Mesh(mirrorCapGeo, mats.paint);
    cap.position.set(-0.02, 0.078, side * 0.118);
    cap.rotation.y = side * -0.18;
    mir.add(cap);

    const mLed = new THREE.Mesh(mirrorLedGeo, mats.ledWhite);
    mLed.position.set(0.02, 0.074, side * 0.170);
    mLed.rotation.y = side * -0.18;
    mir.add(mLed);
    g.add(mir);

    const handle = new THREE.Mesh(handleGeo, mats.darkChrome);
    handle.position.set(-0.34, 0.775, side * 0.890);
    g.add(handle);

    const gill = new THREE.Mesh(gillGeo, mats.glossBlack);
    gill.position.set(0.86, 0.49, side * 0.892);
    gill.rotation.z = -0.24;
    g.add(gill);
  }
  disposables.push(skirtGeo, accentStripGeo, stalkGeo, mirrorCapGeo, mirrorLedGeo, handleGeo, gillGeo);

  return { group: g, disposables };
}

// ---------- Детализированные колёса и симметричные тормоза ----------

function buildWheelAssets(mats, lite) {
  const seg = lite ? 28 : 48;
  const R = CAR_SPEC.wheelR; // 0.37
  const W = CAR_SPEC.frontTireW; // 0.28 (задние масштабируются по Z до 0.31)
  const rimR = 0.268; // 21-дюймовый низкопрофильный диск
  const halfW = W / 2;

  // 1. Симметричный реалистичный профиль шины (LatheGeometry вокруг оси Y, затем поворот на ось Z)
  const tirePts = [
    new THREE.Vector2(rimR - 0.008, -halfW + 0.022),
    new THREE.Vector2(rimR + 0.025, -halfW + 0.006),
    new THREE.Vector2(R - 0.032, -halfW - 0.002),
    new THREE.Vector2(R - 0.008, -halfW + 0.016),
    new THREE.Vector2(R, -halfW + 0.042),
    new THREE.Vector2(R + 0.002, 0),
    new THREE.Vector2(R, halfW - 0.042),
    new THREE.Vector2(R - 0.008, halfW - 0.016),
    new THREE.Vector2(R - 0.032, halfW + 0.002),
    new THREE.Vector2(rimR + 0.025, halfW - 0.006),
    new THREE.Vector2(rimR - 0.008, halfW - 0.022),
  ];
  const tireGeo = new THREE.LatheGeometry(tirePts, seg);
  tireGeo.rotateX(Math.PI / 2);

  // 2. Многоступенчатый обод диска (наружная полка + внутренняя бочка)
  const rimPts = [
    new THREE.Vector2(rimR - 0.026, -halfW + 0.024),
    new THREE.Vector2(rimR + 0.004, -halfW + 0.024),
    new THREE.Vector2(rimR + 0.004, -halfW + 0.040),
    new THREE.Vector2(rimR - 0.018, -halfW + 0.055),
    new THREE.Vector2(rimR - 0.018, halfW - 0.052),
    new THREE.Vector2(rimR + 0.006, halfW - 0.032),
    new THREE.Vector2(rimR + 0.006, halfW - 0.016),
    new THREE.Vector2(rimR - 0.012, halfW - 0.014),
    new THREE.Vector2(rimR - 0.026, halfW - 0.034),
  ];
  const rimGeo = new THREE.LatheGeometry(rimPts, seg);
  rimGeo.rotateX(Math.PI / 2);

  // 3. Y-спицы (5 пар = 10 вогнутых спортивных спиц), общая геометрия
  const spokeGeo = new THREE.BoxGeometry(0.026, rimR - 0.048, 0.022);
  const hubGeo = new THREE.CylinderGeometry(0.068, 0.074, 0.055, 24);
  hubGeo.rotateX(Math.PI / 2);
  const capRingGeo = new THREE.TorusGeometry(0.036, 0.0045, 8, 24);
  const lugGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.026, 8);
  lugGeo.rotateX(Math.PI / 2);

  // 4. Перфорированный тормозной диск
  const rotorGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.026, seg);
  rotorGeo.rotateX(Math.PI / 2);

  // 5. Скульптурный 6-поршневый тормозной суппорт (со скошенными гранями)
  const calShape = new THREE.Shape();
  calShape.moveTo(-0.042, -0.095);
  calShape.quadraticCurveTo(0.055, -0.088, 0.062, 0.0);
  calShape.quadraticCurveTo(0.055, 0.088, -0.042, 0.095);
  calShape.lineTo(-0.058, 0.065);
  calShape.lineTo(-0.058, -0.065);
  calShape.closePath();
  const caliperGeo = new THREE.ExtrudeGeometry(calShape, {
    depth: 0.068,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 12,
  });
  caliperGeo.translate(0, 0, -0.034);

  return {
    tireGeo,
    rimGeo,
    spokeGeo,
    hubGeo,
    capRingGeo,
    lugGeo,
    rotorGeo,
    caliperGeo,
    dispose() {
      tireGeo.dispose();
      rimGeo.dispose();
      spokeGeo.dispose();
      hubGeo.dispose();
      capRingGeo.dispose();
      lugGeo.dispose();
      rotorGeo.dispose();
      caliperGeo.dispose();
    },
  };
}

function buildWheels(mats, lite) {
  const g = new THREE.Group();
  const assets = buildWheelAssets(mats, lite);
  const { frontAxleX, rearAxleX, wheelR, trackHalf, frontTireW, rearTireW } = CAR_SPEC;

  const configs = [
    { axle: 'front', x: frontAxleX, side: 1, zScale: 1.0 },
    { axle: 'front', x: frontAxleX, side: -1, zScale: 1.0 },
    { axle: 'rear', x: rearAxleX, side: 1, zScale: rearTireW / frontTireW },
    { axle: 'rear', x: rearAxleX, side: -1, zScale: rearTireW / frontTireW },
  ];

  for (const cfg of configs) {
    const wheelNode = new THREE.Group();
    wheelNode.position.set(cfg.x, wheelR, cfg.side * trackHalf);

    // Вращающаяся часть (шина + обод + 5 Y-спиц + ступица + 5 болтов)
    // Для левого борта (-1) отражаем по Z через поворот вращающейся части на PI,
    // а тормозной суппорт ставим отдельно в координатах автомобиля — для идеальной симметрии!
    const spinGroup = new THREE.Group();
    spinGroup.scale.z = cfg.zScale;
    if (cfg.side < 0) spinGroup.rotation.y = Math.PI;

    spinGroup.add(new THREE.Mesh(assets.tireGeo, mats.tire));
    spinGroup.add(new THREE.Mesh(assets.rimGeo, mats.rimMachined));

    // 5 пар вогнутых Y-спиц
    const rimR = 0.268;
    const midR = 0.145;
    for (let i = 0; i < 5; i++) {
      const baseA = (i / 5) * Math.PI * 2;
      for (const sgn of [-1, 1]) {
        const spoke = new THREE.Mesh(assets.spokeGeo, mats.rimMachined);
        const a = baseA + sgn * 0.19;
        spoke.position.set(Math.sin(a) * midR, Math.cos(a) * midR, 0.088);
        // Вогнутый наклон к центру ступицы + V-расхождение пары
        spoke.rotation.z = -(baseA + sgn * 0.29);
        spoke.rotation.x = Math.cos(a) * 0.16;
        spoke.rotation.y = -Math.sin(a) * 0.16;
        spinGroup.add(spoke);
      }
    }

    const hub = new THREE.Mesh(assets.hubGeo, mats.rimDark);
    hub.position.z = 0.072;
    spinGroup.add(hub);

    const capRing = new THREE.Mesh(assets.capRingGeo, mats.accentStrip);
    capRing.position.z = 0.101;
    spinGroup.add(capRing);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.31;
      const lug = new THREE.Mesh(assets.lugGeo, mats.chrome);
      lug.position.set(Math.sin(a) * 0.048, Math.cos(a) * 0.048, 0.095);
      spinGroup.add(lug);
    }

    const rotor = new THREE.Mesh(assets.rotorGeo, mats.rotor);
    rotor.position.z = 0.042;
    spinGroup.add(rotor);

    wheelNode.add(spinGroup);

    // Тормозной суппорт — строго симметрично в координатах автомобиля (передние назад, задние вперёд)
    const cal = getCaliperPlacement(cfg.axle, cfg.side);
    const caliper = new THREE.Mesh(assets.caliperGeo, mats.caliper);
    caliper.position.set(cal.offsetX, cal.offsetY, cal.offsetZ);
    caliper.rotation.z = cal.tiltZ;
    if (cfg.axle === 'rear') caliper.rotation.y = Math.PI;
    wheelNode.add(caliper);

    g.add(wheelNode);
  }

  return { group: g, dispose: () => assets.dispose() };
}

// ---------- Главная сборка автомобиля ----------

export function buildRealisticCar(lite = false, maxAnisotropy = 4) {
  const root = new THREE.Group();
  root.name = 'NorthlineGTConcept';
  const textures = createCarTextures(maxAnisotropy);
  const disposables = [];

  // Калиброванная палитра PBR-материалов (глубокий титаново-графитовый металлик + акценты)
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({
      color: 0x3b424b,
      metalness: 0.76,
      roughness: 0.21,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      bumpMap: textures.paintFlake,
      bumpScale: 0.0008,
      envMapIntensity: 1.45,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x090d12,
      metalness: 0.15,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.78,
      depthWrite: true,
      envMapIntensity: 1.9,
    }),
    panoramicRoof: new THREE.MeshPhysicalMaterial({
      color: 0x06080b,
      metalness: 0.25,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.85,
    }),
    clearLens: new THREE.MeshPhysicalMaterial({
      color: 0xdbe6f2,
      metalness: 0.05,
      roughness: 0.06,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      envMapIntensity: 1.8,
    }),
    glossBlack: new THREE.MeshPhysicalMaterial({
      color: 0x0a0b0d,
      metalness: 0.2,
      roughness: 0.14,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.3,
    }),
    carbon: new THREE.MeshStandardMaterial({
      color: 0x16181c,
      metalness: 0.32,
      roughness: 0.42,
      envMapIntensity: 1.0,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: 0x111316,
      metalness: 0.25,
      roughness: 0.58,
    }),
    underbody: new THREE.MeshStandardMaterial({
      color: 0x070809,
      metalness: 0.1,
      roughness: 0.92,
    }),
    interior: new THREE.MeshStandardMaterial({
      color: 0x121418,
      metalness: 0.05,
      roughness: 0.85,
    }),
    grille: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.grilleMap,
      metalness: 0.5,
      roughness: 0.48,
    }),
    tire: new THREE.MeshStandardMaterial({
      color: 0x15171a,
      metalness: 0.05,
      roughness: 0.84,
      bumpMap: textures.tireBump,
      bumpScale: 0.012,
    }),
    rimMachined: new THREE.MeshStandardMaterial({
      color: 0xc8cfd6,
      metalness: 0.96,
      roughness: 0.18,
      envMapIntensity: 1.5,
    }),
    rimDark: new THREE.MeshStandardMaterial({
      color: 0x1c2026,
      metalness: 0.82,
      roughness: 0.3,
      envMapIntensity: 1.2,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xe2e7ec,
      metalness: 1.0,
      roughness: 0.12,
      envMapIntensity: 1.6,
    }),
    darkChrome: new THREE.MeshStandardMaterial({
      color: 0x555c65,
      metalness: 0.95,
      roughness: 0.22,
      envMapIntensity: 1.4,
    }),
    rotor: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.rotorMap,
      bumpMap: textures.rotorMap,
      bumpScale: 0.004,
      metalness: 0.88,
      roughness: 0.36,
      envMapIntensity: 1.25,
    }),
    caliper: new THREE.MeshPhysicalMaterial({
      color: ACCENT,
      metalness: 0.28,
      roughness: 0.26,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    }),
    ledWhite: new THREE.MeshStandardMaterial({
      color: 0xf4f8ff,
      emissive: 0xeef5ff,
      emissiveIntensity: 2.6,
      roughness: 0.1,
    }),
    ledRed: new THREE.MeshStandardMaterial({
      color: 0x450505,
      emissive: 0xff1e10,
      emissiveIntensity: 2.8,
      roughness: 0.15,
    }),
    accentStrip: new THREE.MeshStandardMaterial({
      color: ACCENT,
      emissive: ACCENT,
      emissiveIntensity: 0.2,
      metalness: 0.35,
      roughness: 0.32,
    }),
  };

  // 1. Основная оболочка нижнего кузова (параметрический лофт с точными арками)
  const stations = buildLongitudinalStations(lite);
  const bodyRings = stations.map((x) => sampleLowerBodyRing(x));
  const bodyGeo = createLoftGeometry(bodyRings);
  disposables.push(bodyGeo);
  const bodyMesh = new THREE.Mesh(bodyGeo, mats.paint);
  bodyMesh.name = 'CarBodyShell';
  root.add(bodyMesh);

  // 2. Передняя и задняя замыкающие фасции
  const caps = buildFrontAndRearCaps(bodyRings, mats.paint, lite);
  caps.traverse((m) => m.isMesh && disposables.push(m.geometry));
  root.add(caps);

  // 3. Закрытые колёсные арки и отбортовки крыльев
  const wells = buildWheelWells(mats.underbody, mats.paint, lite);
  disposables.push(...wells.disposables);
  root.add(wells.group);

  // 4. Кабина: салон, тонированное стекло, стойки A/B/C и крыша
  const greenhouse = buildGreenhouseAndInterior(mats, lite);
  disposables.push(...greenhouse.disposables);
  root.add(greenhouse.group);

  // 5. Аэродинамика, оптика, решётка, диффузор, выхлоп, зеркала
  const aero = buildAeroOpticsAndTrim(mats, lite);
  disposables.push(...aero.disposables);
  root.add(aero.group);

  // 6. Колёса и симметричная тормозная система
  const wheels = buildWheels(mats, lite);
  root.add(wheels.group);

  // 7. Лёгкие невидимые proxy-объёмы для быстрого рейкаста зон (4 бокса вместо 50+ мешей)
  const hitProxies = [];
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxyDefs = [
    { zone: 'engine', pos: [1.56, 0.56, 0], size: [1.35, 0.62, 1.82] },
    { zone: 'cabin', pos: [-0.36, 1.06, 0], size: [2.25, 0.56, 1.48] },
    { zone: 'body', pos: [-0.62, 0.62, 0], size: [3.25, 0.58, 1.94] },
    { zone: 'wheel', pos: [CAR_SPEC.frontAxleX, 0.37, 0], size: [0.86, 0.74, 2.02] },
    { zone: 'wheel', pos: [CAR_SPEC.rearAxleX, 0.37, 0], size: [0.86, 0.74, 2.04] },
  ];
  for (const def of proxyDefs) {
    const pGeo = new THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]);
    const pMesh = new THREE.Mesh(pGeo, proxyMat);
    pMesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
    pMesh.userData.zone = def.zone;
    pMesh.castShadow = false;
    pMesh.receiveShadow = false;
    root.add(pMesh);
    hitProxies.push(pMesh);
    disposables.push(pGeo);
  }
  disposables.push(proxyMat);

  // Откалиброванные 3D-якоря хотспотов под геометрию новой модели
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(0, 0, 1);
  const anchors = {
    engine: { pos: new THREE.Vector3(1.52, 0.86, 0), normal: up },
    wheel: { pos: new THREE.Vector3(CAR_SPEC.frontAxleX, 0.40, 0.99), normal: side },
    cabin: { pos: new THREE.Vector3(-0.35, 1.33, 0), normal: up },
    body: { pos: new THREE.Vector3(-1.68, 0.78, 0.99), normal: side },
  };

  return {
    group: root,
    anchors,
    hitProxies,
    dispose() {
      wheels.dispose();
      textures.dispose();
      for (const item of disposables) item.dispose?.();
      for (const mat of Object.values(mats)) mat.dispose?.();
    },
  };
}
