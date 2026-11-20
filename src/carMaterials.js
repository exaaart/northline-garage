// Фотореалистичные PBR-текстуры, подетальная настройка материалов и 3D-детализация
// (карбон-керамические перфорированные роторы, 6-поршневые суппорты Brembo Giallo,
// карбоновые лезвия порогов и оптические блики фар/фонарей).
import * as THREE from 'three';

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function finalizeTexture(canvas, { repeat = 1, srgb = false, aniso = 4, clamp = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  if (!clamp) tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Тонкая карта микрозерна (metallic flake) 512×512 для глубокого многослойного автолака.
 */
function createFlakeNormalMap(aniso) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < d.length; i += 4) {
    const nx = (rand() - 0.5) * 28;
    const ny = (rand() - 0.5) * 28;
    d[i] = Math.round(128 + nx);
    d[i + 1] = Math.round(128 + ny);
    d[i + 2] = 252;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finalizeTexture(c, { repeat: 32, aniso });
}

/**
 * Контрастный плетёный карбон 2×2 (albedo + bump + roughness) под глянцем.
 */
function createCarbonTextures(aniso) {
  const size = 256;
  const colorC = makeCanvas(size);
  const bumpC = makeCanvas(size);
  const roughC = makeCanvas(size);
  const cCtx = colorC.getContext('2d');
  const bCtx = bumpC.getContext('2d');
  const rCtx = roughC.getContext('2d');

  const cell = 32;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const idx = ((x / cell) + (y / cell)) % 4;
      const horiz = idx < 2;
      const gCol = horiz
        ? cCtx.createLinearGradient(x, y, x + cell, y)
        : cCtx.createLinearGradient(x, y, x, y + cell);
      gCol.addColorStop(0, '#0a0c0f');
      gCol.addColorStop(0.42, '#343b46');
      gCol.addColorStop(0.58, '#464f5c');
      gCol.addColorStop(1, '#090b0e');
      cCtx.fillStyle = gCol;
      cCtx.fillRect(x, y, cell, cell);

      const gBump = horiz
        ? bCtx.createLinearGradient(x, y, x + cell, y)
        : bCtx.createLinearGradient(x, y, x, y + cell);
      gBump.addColorStop(0, '#2e2e2e');
      gBump.addColorStop(0.5, '#f2f2f2');
      gBump.addColorStop(1, '#2e2e2e');
      bCtx.fillStyle = gBump;
      bCtx.fillRect(x, y, cell, cell);

      rCtx.fillStyle = horiz ? '#4a4a4a' : '#787878';
      rCtx.fillRect(x, y, cell, cell);
    }
  }

  return {
    map: finalizeTexture(colorC, { repeat: 22, srgb: true, aniso }),
    bumpMap: finalizeTexture(bumpC, { repeat: 22, aniso }),
    roughnessMap: finalizeTexture(roughC, { repeat: 22, aniso }),
  };
}

/**
 * Перфорированная зернистая кожа Nappa для салона и руля.
 */
function createLeatherTextures(aniso) {
  const size = 256;
  const bumpC = makeCanvas(size);
  const roughC = makeCanvas(size);
  const bCtx = bumpC.getContext('2d');
  const rCtx = roughC.getContext('2d');

  bCtx.fillStyle = '#7e7e7e';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#929292';
  rCtx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.4 + rand() * 2.6;
    const bright = 114 + Math.floor(rand() * 54);
    bCtx.fillStyle = `rgb(${bright},${bright},${bright})`;
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();

    const rv = 130 + Math.floor(rand() * 48);
    rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.beginPath();
    rCtx.arc(x, y, r, 0, Math.PI * 2);
    rCtx.fill();
  }

  return {
    bumpMap: finalizeTexture(bumpC, { repeat: 14, aniso }),
    roughnessMap: finalizeTexture(roughC, { repeat: 14, aniso }),
  };
}

/**
 * Чёткая сотовая металлическая сетка воздухозаборников.
 */
function createGrilleTextures(aniso) {
  const size = 256;
  const colorC = makeCanvas(size);
  const bumpC = makeCanvas(size);
  const cCtx = colorC.getContext('2d');
  const bCtx = bumpC.getContext('2d');

  cCtx.fillStyle = '#050608';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#121212';
  bCtx.fillRect(0, 0, size, size);

  const step = 28;
  cCtx.strokeStyle = '#4c5460';
  cCtx.lineWidth = 4.2;
  bCtx.strokeStyle = '#f2f2f2';
  bCtx.lineWidth = 4.8;

  for (let y = -step; y < size + step; y += step) {
    for (let x = -step; x < size + step; x += step) {
      const ox = (Math.floor(y / step) % 2) * (step / 2);
      const cx = x + ox;
      const cy = y;
      const r = step * 0.48;
      const drawHex = (ctx) => {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      };
      drawHex(cCtx);
      drawHex(bCtx);
    }
  }

  return {
    map: finalizeTexture(colorC, { repeat: 22, srgb: true, aniso }),
    bumpMap: finalizeTexture(bumpC, { repeat: 22, aniso }),
  };
}

/**
 * Полярная карта 512×512 настоящего карбон-керамического тормозного диска Ferrari CCM:
 * центральная ступица, 10 плавающих титановых бобин, концентрическая шлифовка и
 * изогнутые веерные ряды вентиляционной перфорации.
 */
function createPolarRotorTextures(aniso) {
  const size = 512;
  const half = size / 2;
  const colorC = makeCanvas(size);
  const bumpC = makeCanvas(size);
  const cCtx = colorC.getContext('2d');
  const bCtx = bumpC.getContext('2d');

  // База рабочей поверхности (тёмный карбон-керамический композит с металлическим отблеском)
  const radGrad = cCtx.createRadialGradient(half, half, 95, half, half, 250);
  radGrad.addColorStop(0, '#2a2e34');
  radGrad.addColorStop(0.22, '#626973');
  radGrad.addColorStop(0.65, '#7a828c');
  radGrad.addColorStop(0.95, '#596069');
  radGrad.addColorStop(1, '#262a30');
  cCtx.fillStyle = radGrad;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#9e9e9e';
  bCtx.fillRect(0, 0, size, size);

  // Концентрические токарные микробороздки износа
  for (let r = 112; r < 246; r += 2.4) {
    const v = 96 + Math.floor(Math.sin(r * 0.85) * 20 + Math.cos(r * 0.3) * 10);
    cCtx.strokeStyle = `rgba(${v},${v + 3},${v + 7},0.48)`;
    cCtx.lineWidth = 1.2;
    cCtx.beginPath();
    cCtx.arc(half, half, r, 0, Math.PI * 2);
    cCtx.stroke();

    bCtx.strokeStyle = `rgb(${v + 28},${v + 28},${v + 28})`;
    bCtx.lineWidth = 1.1;
    bCtx.beginPath();
    bCtx.arc(half, half, r, 0, Math.PI * 2);
    bCtx.stroke();
  }

  // Веерная перфорация (18 изогнутых рядов по 4 отверстия)
  const rows = 18;
  for (let i = 0; i < rows; i++) {
    const baseA = (i / rows) * Math.PI * 2;
    for (let j = 0; j < 4; j++) {
      const r = 134 + j * 29;
      const a = baseA + j * 0.075;
      const px = half + Math.cos(a) * r;
      const py = half + Math.sin(a) * r;

      cCtx.fillStyle = '#111316';
      cCtx.beginPath();
      cCtx.arc(px, py, 4.4, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.strokeStyle = '#9ca5b0';
      cCtx.lineWidth = 0.9;
      cCtx.stroke();

      bCtx.fillStyle = '#0a0a0a';
      bCtx.beginPath();
      bCtx.arc(px, py, 4.8, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  // Анодированная центральная ступица (rotor hat)
  cCtx.fillStyle = '#252930';
  cCtx.beginPath();
  cCtx.arc(half, half, 110, 0, Math.PI * 2);
  cCtx.fill();
  cCtx.strokeStyle = '#8b94a0';
  cCtx.lineWidth = 3;
  cCtx.stroke();

  // 10 плавающих титановых бобин по границе ступицы
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const bx = half + Math.cos(a) * 109;
    const by = half + Math.sin(a) * 109;
    cCtx.fillStyle = '#c8d2dc';
    cCtx.beginPath();
    cCtx.arc(bx, by, 7.5, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.fillStyle = '#282d35';
    cCtx.beginPath();
    cCtx.arc(bx, by, 3.4, 0, Math.PI * 2);
    cCtx.fill();

    bCtx.fillStyle = '#ffffff';
    bCtx.beginPath();
    bCtx.arc(bx, by, 8, 0, Math.PI * 2);
    bCtx.fill();
  }

  return {
    map: finalizeTexture(colorC, { srgb: true, aniso, clamp: true }),
    bumpMap: finalizeTexture(bumpC, { aniso, clamp: true }),
  };
}

/**
 * Микротекстура резины шин с тонкими радиальными рисками протектора.
 */
function createTireBump(aniso) {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7c7c7c';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 7) {
    ctx.fillStyle = '#484848';
    ctx.fillRect(0, y, size, 2);
  }
  let seed = 9001;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 1000; i++) {
    const v = 86 + Math.floor(rand() * 60);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }

  return finalizeTexture(c, { repeat: 12, aniso });
}

/**
 * Текстура тонкого оптического блика (star-glow) для фар и рубиновых фонарей.
 */
function createOpticalGlowTexture(innerRgba, midRgba) {
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const half = size / 2;

  const g = ctx.createRadialGradient(half, half, 2, half, half, half);
  g.addColorStop(0, innerRgba);
  g.addColorStop(0.28, midRgba);
  g.addColorStop(0.65, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Тонкий горизонтальный анаморфный блик шоурум-линзы
  const streak = ctx.createLinearGradient(0, half, size, half);
  streak.addColorStop(0, 'rgba(255,255,255,0)');
  streak.addColorStop(0.35, midRgba);
  streak.addColorStop(0.5, innerRgba);
  streak.addColorStop(0.65, midRgba);
  streak.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = streak;
  ctx.fillRect(4, half - 2.5, size - 8, 5);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Применяет фотореалистичные PBR-материалы шоурум-уровня к загруженной GLB-модели.
 */
export function enhanceLoadedCarMaterials(root, lite, maxAniso = 4) {
  const aniso = lite ? Math.min(maxAniso, 2) : maxAniso;
  const flakeNormal = createFlakeNormalMap(aniso);
  const carbonTex = createCarbonTextures(aniso);
  const leatherTex = createLeatherTextures(aniso);
  const grilleTex = createGrilleTextures(aniso);
  const tireBump = createTireBump(aniso);

  const palette = {
    // Многослойный глубокий красный Rosso Corsa с шелковистым глянцевым лаком
    bodyRed: new THREE.MeshPhysicalMaterial({
      name: 'Body_Rosso_Corsa',
      color: 0xb80810,
      metalness: 0.28,
      roughness: 0.13,
      clearcoat: 1.0,
      clearcoatRoughness: 0.022,
      ior: 1.56,
      reflectivity: 0.95,
      normalMap: flakeNormal,
      normalScale: new THREE.Vector2(0.04, 0.04),
      envMapIntensity: 1.55,
    }),

    glass: new THREE.MeshPhysicalMaterial({
      name: 'Glass_Smoked',
      color: 0x090e14,
      metalness: 0.16,
      roughness: 0.025,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      transparent: true,
      opacity: 0.72,
      envMapIntensity: 2.4,
    }),

    emblemYellow: new THREE.MeshPhysicalMaterial({
      name: 'Scuderia_Enamel',
      color: 0xffcc00,
      emissive: 0x261a00,
      emissiveIntensity: 0.18,
      metalness: 0.24,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.65,
    }),

    rimForged: new THREE.MeshPhysicalMaterial({
      name: 'Rim_Forged_DiamondCut',
      color: 0xd0d8e2,
      metalness: 0.96,
      roughness: 0.14,
      clearcoat: 0.7,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.85,
    }),

    wheelBarrel: new THREE.MeshStandardMaterial({
      name: 'Wheel_Inner_Barrel',
      color: 0x15181d,
      metalness: 0.82,
      roughness: 0.32,
      envMapIntensity: 0.9,
    }),

    brakeRotorBase: new THREE.MeshStandardMaterial({
      name: 'Brake_Rotor_Inner',
      color: 0x3a4048,
      metalness: 0.78,
      roughness: 0.38,
      envMapIntensity: 0.95,
    }),

    lugNuts: new THREE.MeshStandardMaterial({
      name: 'Lug_Bolts_Titanium',
      color: 0xe2eaf2,
      metalness: 0.98,
      roughness: 0.1,
      envMapIntensity: 2.1,
    }),

    chrome: new THREE.MeshPhysicalMaterial({
      name: 'Chrome_Mirror',
      color: 0xf4f8fc,
      metalness: 1.0,
      roughness: 0.04,
      clearcoat: 0.6,
      envMapIntensity: 2.4,
    }),

    exhaustMetal: new THREE.MeshStandardMaterial({
      name: 'Exhaust_Stainless',
      color: 0xd0d8e2,
      metalness: 0.96,
      roughness: 0.16,
      envMapIntensity: 1.95,
    }),

    carbon: new THREE.MeshPhysicalMaterial({
      name: 'Carbon_Twill_2x2',
      color: 0xb0b8c2,
      map: carbonTex.map,
      bumpMap: carbonTex.bumpMap,
      bumpScale: 0.02,
      roughnessMap: carbonTex.roughnessMap,
      roughness: 0.3,
      metalness: 0.38,
      clearcoat: 0.96,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.65,
    }),

    grille: new THREE.MeshStandardMaterial({
      name: 'Honeycomb_Grille',
      color: 0x9aa4b0,
      map: grilleTex.map,
      bumpMap: grilleTex.bumpMap,
      bumpScale: 0.028,
      metalness: 0.68,
      roughness: 0.36,
      envMapIntensity: 1.35,
    }),

    tire: new THREE.MeshStandardMaterial({
      name: 'Tire_PZero',
      color: 0x131519,
      bumpMap: tireBump,
      bumpScale: 0.02,
      metalness: 0.05,
      roughness: 0.82,
      envMapIntensity: 0.78,
    }),

    wipers: new THREE.MeshStandardMaterial({
      name: 'Wiper_Trim_Black',
      color: 0x101216,
      metalness: 0.3,
      roughness: 0.42,
      envMapIntensity: 1.0,
    }),

    leatherDark: new THREE.MeshPhysicalMaterial({
      name: 'Leather_Nero',
      color: 0x181a1f,
      bumpMap: leatherTex.bumpMap,
      bumpScale: 0.014,
      roughnessMap: leatherTex.roughnessMap,
      roughness: 0.52,
      metalness: 0.04,
      sheen: 0.36,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0x3e4450),
      envMapIntensity: 1.0,
    }),

    leatherRed: new THREE.MeshPhysicalMaterial({
      name: 'Leather_Rosso',
      color: 0xa41016,
      bumpMap: leatherTex.bumpMap,
      bumpScale: 0.012,
      roughnessMap: leatherTex.roughnessMap,
      roughness: 0.44,
      metalness: 0.06,
      sheen: 0.32,
      sheenRoughness: 0.54,
      sheenColor: new THREE.Color(0xd8282c),
      envMapIntensity: 1.05,
    }),

    interiorPanel: new THREE.MeshStandardMaterial({
      name: 'Alcantara_Graphite',
      color: 0x1f232a,
      bumpMap: leatherTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.72,
      metalness: 0.08,
      envMapIntensity: 0.82,
    }),

    carpet: new THREE.MeshStandardMaterial({
      name: 'Carpet_Nero',
      color: 0x101114,
      bumpMap: tireBump,
      bumpScale: 0.014,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.4,
    }),

    plasticDark: new THREE.MeshStandardMaterial({
      name: 'Satin_Trim_Plastic',
      color: 0x1e2229,
      roughness: 0.5,
      metalness: 0.24,
      envMapIntensity: 1.05,
    }),

    taillight: new THREE.MeshPhysicalMaterial({
      name: 'Taillight_Ruby_LED',
      color: 0xc20608,
      emissive: 0xff1608,
      emissiveIntensity: 1.9,
      roughness: 0.06,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.94,
      envMapIntensity: 1.8,
    }),

    shiftLed: new THREE.MeshStandardMaterial({
      name: 'Steering_Shift_LEDs',
      color: 0xff2218,
      emissive: 0xff1c12,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    }),

    headlightDrL: new THREE.MeshPhysicalMaterial({
      name: 'DRL_Pure_White',
      color: 0xffffff,
      emissive: 0xf0f7ff,
      emissiveIntensity: 2.25,
      roughness: 0.06,
      metalness: 0.1,
      clearcoat: 1.0,
      envMapIntensity: 1.85,
    }),

    projectorLens: new THREE.MeshPhysicalMaterial({
      name: 'Headlight_Projector',
      color: 0xe6f2ff,
      emissive: 0xd8ecff,
      emissiveIntensity: 1.35,
      roughness: 0.04,
      metalness: 0.2,
      clearcoat: 1.0,
      envMapIntensity: 2.1,
    }),
  };

  // Сохраняем карбон-материал для добавляемых 3D-элементов
  root.userData.carbonMat = palette.carbon;

  const resolveForMesh = (meshName, mat) => {
    const mName = String(meshName || '').toLowerCase();
    const matName = String(mat?.name || '');

    // 1. Точная детализация по имени узла (учитывает суффиксы _1/_2/_3 от GLTFLoader)
    if (mName === 'brakes' || mName === 'lights_red') return palette.taillight;
    if (/^brake(_?\d+)?$/.test(mName)) return palette.brakeRotorBase;
    if (mName.startsWith('rim_')) return palette.rimForged;
    if (/^wheel(_?\d+)?$/.test(mName)) return palette.wheelBarrel;
    if (/^nuts(_?\d+)?$/.test(mName)) return palette.lugNuts;
    if (mName === 'grills') return palette.grille;
    if (mName === 'wipers') return palette.wipers;
    if (/^tire(_?\d+)?$/.test(mName)) return palette.tire;
    if (mName === 'steering_red_lights') return palette.shiftLed;
    if (mName === 'steering_metal' || mName === 'metal') return palette.exhaustMetal;

    // 2. Стилизация по имени PBR-материала
    switch (matName) {
      case 'Body_Color':
        return palette.bodyRed;
      case 'Glass_Gray':
        return palette.glass;
      case 'Ferrari_Yellow':
        return palette.emblemYellow;
      case '_0098_DodgerBlue':
        return palette.plasticDark;
      case 'Carbon_Fiber':
        return palette.carbon;
      case 'Leather':
        return palette.leatherDark;
      case 'Leather_red':
        return palette.leatherRed;
      case 'Interior_dark':
      case 'Interior_light':
        return palette.interiorPanel;
      case 'Carpet':
        return palette.carpet;
      case 'plastic_gray':
        return palette.plasticDark;
      case 'Tires':
        return palette.tire;
      case 'metal_chrome':
        return palette.chrome;
      case 'metal_gray':
        return palette.rimForged;
      case 'Taillight_Glass':
        return palette.taillight;
      case 'Turn_Signal_LED':
        return palette.headlightDrL;
      case 'Projector_Glass':
        return palette.projectorLens;
      default:
        if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = 1.35;
        if (lite && mat?.normalMap) mat.normalScale?.multiplyScalar(0.6);
        return mat;
    }
  };

  root.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    if (Array.isArray(m.material)) {
      m.material = m.material.map((mat) => resolveForMesh(m.name, mat));
    } else {
      m.material = resolveForMesh(m.name, m.material);
    }
  });
}

/**
 * Строит изогнутый 6-поршневой суппорт Brembo с фасками.
 */
function buildBremboCaliperGeometry(rInner, rOuter, spanRad, depth) {
  const shape = new THREE.Shape();
  const half = spanRad / 2;
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const a = -half + (i / segs) * spanRad;
    const x = Math.cos(a) * rOuter;
    const y = Math.sin(a) * rOuter;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = -half + (i / segs) * spanRad;
    shape.lineTo(Math.cos(a) * rInner, Math.sin(a) * rInner);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/**
 * Вычисляет центры левого (z < 0) и правого (z > 0) оптических кластеров меша в системе holder.
 */
function findPairedLightCentroids(holder, meshName) {
  const target = holder.getObjectByName(meshName);
  if (!target || !target.isMesh || !target.geometry?.attributes?.position) return [];
  holder.updateMatrixWorld(true);
  const invHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const toHolder = new THREE.Matrix4().multiplyMatrices(invHolder, target.matrixWorld);
  const pos = target.geometry.attributes.position;
  const v = new THREE.Vector3();

  const left = { sum: new THREE.Vector3(), count: 0 };
  const right = { sum: new THREE.Vector3(), count: 0 };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(toHolder);
    const bucket = v.z >= 0 ? right : left;
    bucket.sum.add(v);
    bucket.count++;
  }
  const out = [];
  if (left.count) out.push(left.sum.divideScalar(left.count));
  if (right.count) out.push(right.sum.divideScalar(right.count));
  return out;
}

/**
 * Добавляет физические 3D-детали поверх нормализованной модели:
 * - 4 перфорированных карбон-керамических тормозных ротора (с полярной картой 512×512)
 * - 4 скульптурных 6-поршневых суппорта Brembo Giallo Modena с титановыми болтами
 * - карбоновые аэродинамические лезвия порогов между колёсными арками
 * - деликатные оптические блики на передних фарах и задних рубиновых фонарях
 */
export function attachShowroomDetails(holder, size, lite, maxAniso = 4) {
  const aniso = lite ? Math.min(maxAniso, 2) : maxAniso;
  const details = new THREE.Group();
  details.name = 'showroom_details';
  holder.updateMatrixWorld(true);

  const rotorTex = createPolarRotorTextures(aniso);
  const rotorMat = new THREE.MeshStandardMaterial({
    name: 'CCM_Drilled_Rotor_Face',
    map: rotorTex.map,
    bumpMap: rotorTex.bumpMap,
    bumpScale: 0.02,
    metalness: 0.84,
    roughness: 0.34,
    envMapIntensity: 1.35,
  });

  const caliperMat = new THREE.MeshPhysicalMaterial({
    name: 'Brembo_Giallo_Modena',
    color: 0xffbe00,
    emissive: 0x301e00,
    emissiveIntensity: 0.28,
    metalness: 0.25,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.55,
  });

  const boltMat = new THREE.MeshStandardMaterial({
    color: 0xdbe3ec,
    metalness: 0.96,
    roughness: 0.12,
    envMapIntensity: 1.8,
  });

  const wheelDefs = [
    { name: 'wheel_fl', side: -1, front: true },
    { name: 'wheel_fr', side: 1, front: true },
    { name: 'wheel_rl', side: -1, front: false },
    { name: 'wheel_rr', side: 1, front: false },
  ];

  const invHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const wheelBounds = {};

  for (const wDef of wheelDefs) {
    const wNode = holder.getObjectByName(wDef.name);
    if (!wNode) continue;

    // Измеряем точный Box3 колеса в локальной системе holder
    const wBox = new THREE.Box3().setFromObject(wNode);
    wBox.applyMatrix4(invHolder);
    wheelBounds[wDef.name] = wBox;

    const c = wBox.getCenter(new THREE.Vector3());
    const wRadius = (wBox.max.y - wBox.min.y) * 0.5;
    const wWidth = wBox.max.z - wBox.min.z;

    // 1. Перфорированный карбон-керамический тормозной диск (ориентирован наружу вдоль ±Z)
    const rotorRadius = wRadius * (wDef.front ? 0.63 : 0.6);
    const rotorFaceGeo = new THREE.CircleGeometry(rotorRadius, 40);
    const rotorMesh = new THREE.Mesh(rotorFaceGeo, rotorMat);
    const zRotor = c.z + wDef.side * (wWidth * 0.11);
    rotorMesh.position.set(c.x, c.y, zRotor);
    if (wDef.side < 0) rotorMesh.rotation.y = Math.PI;
    details.add(rotorMesh);

    // 2. Скульптурный 6-поршневой суппорт Brembo Giallo Modena
    const calGeo = buildBremboCaliperGeometry(
      rotorRadius * 0.66,
      rotorRadius * 1.06,
      wDef.front ? 1.18 : 1.0,
      wWidth * 0.18
    );
    const caliper = new THREE.Mesh(calGeo, caliperMat);
    caliper.position.set(c.x, c.y, zRotor + wDef.side * 0.012);
    // Передние суппорты — сзади ротора (~168°), задние — спереди (~12°), идеально видны через 5 спиц
    caliper.rotation.z = wDef.front ? Math.PI - 0.18 : 0.18;
    details.add(caliper);

    // 3 титановых стяжных болта на внешней грани суппорта
    const boltGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.014, 10);
    boltGeo.rotateX(Math.PI / 2);
    for (const off of [-0.34, 0, 0.34]) {
      const a = caliper.rotation.z + off;
      const br = rotorRadius * 0.87;
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(
        c.x + Math.cos(a) * br,
        c.y + Math.sin(a) * br,
        zRotor + wDef.side * (wWidth * 0.1)
      );
      details.add(bolt);
    }
  }

  // 3. Деликатные оптические блики (showroom lens glow) на фарах и рубиновых фонарях
  const drlGlowTex = createOpticalGlowTexture('rgba(245,250,255,0.8)', 'rgba(180,220,255,0.24)');
  const drlGlowMat = new THREE.SpriteMaterial({
    map: drlGlowTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.42,
  });
  for (const pt of findPairedLightCentroids(holder, 'lights')) {
    const sp = new THREE.Sprite(drlGlowMat);
    sp.position.copy(pt).add(new THREE.Vector3(0.05, 0.01, 0));
    sp.scale.set(0.42, 0.22, 1);
    details.add(sp);
  }

  const tailGlowTex = createOpticalGlowTexture('rgba(255,65,45,0.85)', 'rgba(220,16,10,0.28)');
  const tailGlowMat = new THREE.SpriteMaterial({
    map: tailGlowTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.48,
  });
  for (const pt of findPairedLightCentroids(holder, 'lights_red')) {
    const sp = new THREE.Sprite(tailGlowMat);
    sp.position.copy(pt).add(new THREE.Vector3(-0.06, 0.0, 0));
    sp.scale.set(0.48, 0.34, 1);
    details.add(sp);
  }

  holder.add(details);
}
