// 3D-сцена Hero: автомобиль на калиброванном поворотном круге.
// Сначала пытается загрузить /models/auto-car.glb; если файла нет — строит
// процедурное спорт-купе GT без брендинга (src/carModel.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { buildRealisticCar } from './carModel.js';
import { classifyCarZone } from './carMath.js';
import { enhanceLoadedCarMaterials, attachShowroomDetails } from './carMaterials.js';

const ACCENT = 0xff5f1f;
const CAR_LEN = 4.64;
const DECK_Y = 0.06;

function detectSoftwareWebGL(gl) {
  try {
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

/**
 * Генерирует мягкую текстуру студийного софтбокса с плавным затуханием к краям,
 * чтобы блики на лаке кузова ложились шёлковым градиентом без рваных белых пятен.
 */
function createSoftboxTexture(coreColor, edgeColor = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);

  // Горизонтальное мягкое затухание + вертикальный градиент рассеивателя
  const gx = ctx.createLinearGradient(0, 0, 256, 0);
  gx.addColorStop(0, edgeColor);
  gx.addColorStop(0.16, coreColor);
  gx.addColorStop(0.84, coreColor);
  gx.addColorStop(1, edgeColor);
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, 256, 128);

  ctx.globalCompositeOperation = 'destination-in';
  const gy = ctx.createLinearGradient(0, 0, 0, 128);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.24, 'rgba(255,255,255,0.85)');
  gy.addColorStop(0.5, 'rgba(255,255,255,1)');
  gy.addColorStop(0.76, 'rgba(255,255,255,0.85)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, 256, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Автомобильная студия с мягкими градиентными софтбоксами:
 * плавные шелковистые блики вдоль капота, крыльев и поясной линии без пересветов.
 */
function buildStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x040507);

  const softWhite = createSoftboxTexture('rgba(255,255,255,1)');
  const softCool = createSoftboxTexture('rgba(220,234,255,1)');
  const softWarm = createSoftboxTexture('rgba(255,212,186,1)');

  const tempGeo = [];
  const tempMat = [];
  const addSoftbox = (w, h, color, tex, pos, lookTarget) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color,
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(geo, mat);
    panel.position.set(pos[0], pos[1], pos[2]);
    panel.lookAt(lookTarget[0], lookTarget[1], lookTarget[2]);
    envScene.add(panel);
    tempGeo.push(geo);
    tempMat.push(mat);
  };

  // Главный верхний широкий потолочный софтбокс (ровная линия блика по капоту и корме)
  addSoftbox(14, 3.2, new THREE.Color(2.2, 2.25, 2.35), softWhite, [0, 7.6, 0.9], [0, 0.4, 0]);
  // Передний 3/4 мягкий рассеиватель для объёмной проработки капота и переднего бампера
  addSoftbox(8.5, 2.6, new THREE.Color(1.75, 1.82, 1.92), softWhite, [6.8, 4.2, 5.8], [0.4, 0.5, 0]);
  // Длинные боковые студийные полосы для скульптурной поясной линии и арок
  addSoftbox(15, 1.5, new THREE.Color(1.65, 1.75, 1.95), softCool, [0, 2.0, 8.6], [0, 0.65, 0]);
  addSoftbox(15, 1.5, new THREE.Color(1.35, 1.45, 1.65), softCool, [0, 2.0, -8.6], [0, 0.65, 0]);
  // Мягкий задний контровой софтбокс для силуэта задних крыльев
  addSoftbox(9, 2.0, new THREE.Color(1.55, 1.38, 1.28), softWarm, [-7.8, 3.6, -4.4], [-0.4, 0.65, 0]);

  const rt = pmrem.fromScene(envScene, 0.022);
  softWhite.dispose();
  softCool.dispose();
  softWarm.dispose();
  for (const g of tempGeo) g.dispose();
  for (const m of tempMat) m.dispose();
  pmrem.dispose();
  return rt.texture;
}

export function initGarage({ canvas, stage, modelUrl, hotspotEls = {}, getShift, onAzimuth, onHover, onSource, onFail }) {
  const lite =
    matchMedia('(max-width: 820px)').matches ||
    matchMedia('(pointer: coarse)').matches ||
    (navigator.hardwareConcurrency || 8) <= 4;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !lite,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    onFail?.(e);
    return null;
  }

  const isSoftwareGl = detectSoftwareWebGL(renderer.getContext());
  const shadowsOn = true;
  const shadowSize = 1024;

  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(devicePixelRatio, lite ? 1.25 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadowsOn;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 4, 8);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 18, 34);
  scene.environment = buildStudioEnvironment(renderer);
  scene.environmentIntensity = 0.88;

  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0.56, 0);
  const viewDir = new THREE.Vector3(0.69, 0.22, 0.69).normalize();
  let camDist = 9.8;

  // --- Студийный свет с выразительными направленными тенями от силуэта автомобиля ---
  scene.add(new THREE.HemisphereLight(0x9bb2cc, 0x050608, 0.18));

  // 1. Главный тенеобразующий верхне-боковой спот (+X, -Z): отбрасывает чёткую длинную тень
  //    от силуэта автомобиля влево-вперёд по диску подиума и на пол студии (одна быстрая карта 1024²)
  const castKey = new THREE.SpotLight(0xfffaf2, 190, 19, 0.5, 0.82, 2);
  castKey.position.set(4.7, 3.7, -3.7);
  castKey.target.position.set(-0.4, 0.25, 0.4);
  castKey.castShadow = shadowsOn;
  castKey.shadow.mapSize.set(shadowSize, shadowSize);
  castKey.shadow.camera.near = 2.0;
  castKey.shadow.camera.far = 15.5;
  castKey.shadow.bias = -0.0004;
  castKey.shadow.normalBias = 0.02;
  scene.add(castKey, castKey.target);

  // 2. Рисующий передне-правый спот (+X, +Z): раскрывает красный борт, диски и суппорты
  //    без тяжёлой второй карты теней и без засвета основной тени на левой половине диска
  const frontKey = new THREE.SpotLight(0xf6f9ff, 68, 15, 0.42, 0.92, 2);
  frontKey.position.set(4.9, 3.6, 4.4);
  frontKey.target.position.set(0.75, 0.48, 0.3);
  scene.add(frontKey, frontKey.target);

  // 3. Деликатный низовой акцент на переднюю оптику и тормоза (не размывает тень на подиуме)
  const frontFill = new THREE.SpotLight(0xeef5ff, 22, 11, 0.38, 0.96, 2);
  frontFill.position.set(5.2, 1.85, 3.2);
  frontFill.target.position.set(1.2, 0.45, 0.25);
  scene.add(frontFill, frontFill.target);

  // 4. Мягкая прохладная подсветка кормы вне зеркальной оси камеры (без паразитного пятна на диске)
  const sideFill = new THREE.SpotLight(0xaec8e8, 16, 14, 0.48, 1.0, 2);
  sideFill.position.set(-5.6, 4.6, 2.0);
  sideFill.target.position.set(-0.4, 0.6, -0.1);
  scene.add(sideFill, sideFill.target);

  // --- Пол и шкалы ---
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, lite ? 48 : 96),
    new THREE.MeshStandardMaterial({
      color: 0x0e1014,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.1,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = shadowsOn;
  scene.add(floor);

  // Радиальные технические линии на полу (неподвижные)
  scene.add(radialLines(3.6, 10, 24, 0x24282d));
  // Внешняя неподвижная шкала + индекс
  scene.add(tickRing(3.42, 3.52, 3.62, 72, 6, 0x525960, 0.002));
  const azDeg = Math.atan2(viewDir.x, viewDir.z);
  const tri = new THREE.Shape();
  tri.moveTo(0, -0.12);
  tri.lineTo(0.1, 0.12);
  tri.lineTo(-0.1, 0.12);
  tri.closePath();
  const index = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: ACCENT }));
  index.rotation.x = -Math.PI / 2;
  const indexHolder = new THREE.Group();
  indexHolder.add(index);
  index.position.set(0, 0.005, 3.76);
  index.rotation.z = Math.PI;
  indexHolder.rotation.y = azDeg;
  scene.add(indexHolder);

  // Поворотный круг (вращается вместе с машиной)
  const table = new THREE.Group();
  scene.add(table);
  const deckRoughMap = brushedDeckTexture(maxAniso);
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(3.25, 3.3, DECK_Y, lite ? 64 : 128),
    new THREE.MeshStandardMaterial({
      color: 0x262a31,
      roughness: 0.72,
      roughnessMap: deckRoughMap,
      metalness: 0.12,
      envMapIntensity: 0.22,
    })
  );
  deck.position.y = DECK_Y / 2;
  deck.receiveShadow = shadowsOn;
  table.add(deck);

  const deckTicks = tickRing(2.95, 3.05, 3.15, 180, 10, 0x6b737b, DECK_Y + 0.0025);
  table.add(deckTicks);

  const zeroMark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.035, 0.34),
    new THREE.MeshBasicMaterial({
      color: ACCENT,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  zeroMark.rotation.x = -Math.PI / 2;
  zeroMark.position.set(3.05, DECK_Y + 0.0035, 0);
  zeroMark.rotation.z = Math.PI / 2;
  table.add(zeroMark);

  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(3.28, 0.014, 10, lite ? 96 : 192),
    new THREE.MeshStandardMaterial({ color: 0xbcc6d0, metalness: 1, roughness: 0.14 })
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = DECK_Y;
  table.add(edge);

  // Тонкий фирменный световой контур внутри кромки поворотного подиума
  const accentRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.22, 0.006, 8, lite ? 96 : 192),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 })
  );
  accentRing.rotation.x = Math.PI / 2;
  accentRing.position.y = DECK_Y + 0.003;
  table.add(accentRing);

  // Компактная контактная окклюзия строго под днищем и шинами (плавно усиливает живые тени)
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.95, 2.3),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.58,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = DECK_Y + 0.005;
  table.add(contactShadow);

  const carSlot = new THREE.Group();
  carSlot.position.y = DECK_Y;
  table.add(carSlot);

  const anchors = {};
  let carBox = new THREE.Box3();
  let carMeshes = [];
  let carProxies = [];

  function mountCar(obj, anchorDefs, hitProxies = []) {
    carSlot.clear();
    carSlot.add(obj);
    carMeshes = [];
    carProxies = hitProxies.slice();
    obj.traverse((m) => {
      if (m.isMesh && m.material?.visible !== false) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const isTransparent = mats.some((mat) => Boolean(mat?.transparent));
        // Кузов и колёса отбрасывают чёткие тени на подиум и пол, но не перегружают
        // сложные clearcoat/sheen-шейдеры самозатенением (исключает сбои WebGL на части GPU)
        m.castShadow = shadowsOn && !isTransparent;
        m.receiveShadow = false;
        carMeshes.push(m);
      }
    });
    carSlot.updateMatrixWorld(true);
    carBox.setFromObject(carSlot);
    if (!carProxies.length) {
      const boxSize = carBox.getSize(new THREE.Vector3());
      carProxies = createHitProxies(boxSize, carSlot);
    }
    for (const [id, def] of Object.entries(anchorDefs)) {
      const a = new THREE.Object3D();
      a.position.copy(def.pos);
      a.userData.normal = def.normal.clone();
      carSlot.add(a);
      anchors[id] = a;
    }
    if (visible && !document.hidden) loop();
  }

  // --- Модель: GLB или процедурное спорт-купе GT ---
  loadModel(modelUrl, lite, maxAniso)
    .then((gltfScene) => {
      const { obj, size } = normalizeModel(gltfScene);
      attachShowroomDetails(obj, size, lite, maxAniso);
      mountCar(obj, anchorsFromModel(obj, size));
      onSource?.('model');
    })
    .catch((err) => {
      console.warn('3D GLB load fallback:', err?.message || err);
      const car = buildRealisticCar(lite, maxAniso);
      mountCar(car.group, car.anchors, car.hitProxies);
      onSource?.('placeholder');
    });

  // --- Взаимодействие ---
  let rotY = reduced ? 0 : -0.58;
  let introDone = reduced;
  let vel = 0;
  let dragging = false;
  let lastX = 0;
  let lastInteract = performance.now();
  const pointer = new THREE.Vector2(9, 9);
  const parallax = new THREE.Vector2();
  const parallaxT = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  let hoverZone = null;
  let pointerDirty = false;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
    lastInteract = performance.now();
  });
  const endDrag = () => {
    dragging = false;
    stage.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    parallaxT.set(pointer.x, pointer.y);
    pointerDirty = true;
    if (dragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      vel = dx * 0.0085;
      rotY += vel;
      lastInteract = performance.now();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.set(9, 9);
    parallaxT.set(0, 0);
    pointerDirty = true;
  });

  const api = {
    nudge(dir) {
      vel = THREE.MathUtils.clamp(vel + dir * 0.085, -0.26, 0.26);
      lastInteract = performance.now();
    },
    lite,
  };

  // --- Состояние цикла рендера (объявляем до resize(), чтобы избежать TDZ) ---
  let visible = true;
  const clock = new THREE.Clock();
  const t0 = performance.now();
  let running = false;
  let frameTimer = 0;
  let lastAz = -1;

  // --- Размер ---
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const shift = getShift ? getShift() : 0;
    const effAspect = camera.aspect * (1 - shift * 1.6);
    camDist = THREE.MathUtils.clamp(12.2 / Math.min(Math.max(effAspect, 0.62), 1.5), 8.5, 16.2);
    if (shift) camera.setViewOffset(w, h, -w * shift, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    loop();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) loop();
  }).observe(stage);
  document.addEventListener('visibilitychange', () => !document.hidden && loop());

  // Восстановление WebGL-контекста при сбросе драйвера/перезагрузке превью
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    scene.environment = buildStudioEnvironment(renderer);
    loop();
  });

  // Предварительно выделенные рабочие векторы/матрицы (0 GC в frame)
  const tmpV = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpHitLocal = new THREE.Vector3();
  const tmpBoxSize = new THREE.Vector3();
  const nm = new THREE.Matrix3();

  function afterDraw(cb) {
    const gl = renderer.getContext();
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!visible || document.hidden) {
          gl.deleteSync(sync);
          running = false;
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameTimer = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameTimer = window.setTimeout(cb, 80);
        }
      };
      frameTimer = window.setTimeout(poll, 5);
    } else {
      frameTimer = window.setTimeout(cb, 80);
    }
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    const intro = reduced ? 1 : Math.min((now - t0) / 2200, 1);
    const ease = 1 - Math.pow(1 - intro, 3);

    if (!dragging) {
      if (intro < 1) {
        rotY = -0.58 * (1 - ease);
      } else {
        if (!introDone) {
          rotY = 0;
          introDone = true;
        }
        const idle = now - lastInteract > 2600 && !reduced;
        const auto = idle ? 0.16 : 0;
        vel += (auto * dt - vel) * (idle ? 0.02 : 0.06);
        rotY += vel;
      }
    }
    table.rotation.y = rotY;
    deckTicks.material.opacity = 0.25 + 0.75 * ease;

    parallax.lerp(parallaxT, 0.05);
    const dist = camDist * (1 + 0.18 * (1 - ease));
    camera.position.copy(viewDir).multiplyScalar(dist).add(target);
    camera.position.x += parallax.x * -0.35;
    camera.position.y += parallax.y * -0.25;
    camera.lookAt(target);

    // Наведение: быстрый рейкаст по proxy-боксам (или по carMeshes для стороннего GLB)
    if (pointerDirty || Math.abs(vel) > 0.0005) {
      pointerDirty = false;
      let zone = null;
      if (!dragging && Math.abs(pointer.x) <= 1) {
        if (carProxies.length) {
          ray.setFromCamera(pointer, camera);
          const hit = ray.intersectObjects(carProxies, false)[0];
          if (hit) zone = hit.object.userData.zone || null;
        } else if (carMeshes.length) {
          ray.setFromCamera(pointer, camera);
          const hit = ray.intersectObjects(carMeshes, false)[0];
          if (hit) {
            tmpHitLocal.copy(hit.point);
            carSlot.worldToLocal(tmpHitLocal);
            carBox.getSize(tmpBoxSize);
            zone = classifyCarZone(tmpHitLocal, carBox.min.y, tmpBoxSize.x, tmpBoxSize.y, DECK_Y);
          }
        }
      }
      if (zone !== hoverZone) {
        hoverZone = zone;
        stage.classList.toggle('is-over-car', !!zone);
        onHover?.(zone);
      }
    }

    renderer.render(scene, camera);

    // Позиции информационных точек (0 аллокаций)
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    camera.getWorldPosition(tmpC);
    for (const [id, el] of Object.entries(hotspotEls)) {
      const a = anchors[id];
      if (!a) continue;
      a.getWorldPosition(tmpV);
      nm.getNormalMatrix(a.matrixWorld);
      tmpN.copy(a.userData.normal).applyMatrix3(nm).normalize();
      tmpDir.copy(tmpC).sub(tmpV).normalize();
      const facing = tmpN.dot(tmpDir);
      tmpV.project(camera);
      el.style.transform = `translate(${((tmpV.x + 1) / 2) * w}px, ${((1 - tmpV.y) / 2) * h}px)`;
      el.classList.toggle('is-back', facing < -0.05);
      el.classList.toggle('is-ready', intro >= 1);
    }

    const az = Math.round(((((-rotY * 180) / Math.PI) % 360) + 360) % 360);
    if (az !== lastAz) {
      lastAz = az;
      onAzimuth?.(az);
    }
  }

  function loop() {
    if (running) return;
    running = true;
    clock.getDelta();
    const tick = () => {
      if (!visible || document.hidden) {
        running = false;
        return;
      }
      frame();
      if (isSoftwareGl) afterDraw(tick);
      else frameTimer = requestAnimationFrame(tick);
    };
    frameTimer = requestAnimationFrame(tick);
  }
  loop();

  void frameTimer;
  return api;
}

// ---------- helpers ----------

async function loadModel(url, lite, maxAniso = 4) {
  if (!url) throw new Error('no url');

  const tryLoad = async (decoderType) => {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    if (decoderType) draco.setDecoderConfig({ type: decoderType });
    loader.setDRACOLoader(draco);
    try {
      const gltf = await Promise.race([
        loader.loadAsync(url),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('model load timeout')), 12000)),
      ]);
      enhanceLoadedCarMaterials(gltf.scene, lite, maxAniso);
      return gltf.scene;
    } finally {
      draco.dispose();
    }
  };

  try {
    return await tryLoad('wasm');
  } catch {
    // Повтор через JS-декодер Draco на случай ограничений WASM в браузере/iframe
    return await tryLoad('js');
  }
}

function normalizeModel(root) {
  const holder = new THREE.Group();
  holder.add(root);
  holder.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(root);
  let size = box.getSize(new THREE.Vector3());

  if (size.z > size.x) {
    // Определяем, в какую сторону смотрит нос автомобиля (-Z или +Z), чтобы развернуть его строго вдоль +X
    const frontWheel = root.getObjectByName('wheel_fl') || root.getObjectByName('wheel_fr');
    const rearWheel = root.getObjectByName('wheel_rl') || root.getObjectByName('wheel_rr');
    let rotY = -Math.PI / 2; // стандарт glTF: нос вдоль -Z -> поворот -90° переводит нос на +X
    if (frontWheel && rearWheel) {
      const fPos = new THREE.Vector3();
      const rPos = new THREE.Vector3();
      frontWheel.getWorldPosition(fPos);
      rearWheel.getWorldPosition(rPos);
      rotY = fPos.z < rPos.z ? -Math.PI / 2 : Math.PI / 2;
    }
    root.rotation.y = rotY;
    holder.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(holder);
    size = box.getSize(new THREE.Vector3());
  }

  const s = CAR_LEN / size.x;
  root.scale.multiplyScalar(s);
  holder.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y;
  holder.updateMatrixWorld(true);

  size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  return { obj: holder, size };
}

function anchorsFromModel(obj, size) {
  const L = size.x, H = size.y, W = size.z;
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(0, 0, 1);

  let wheelPos = new THREE.Vector3(L * 0.28, H * 0.28, W * 0.5);
  const frontRight = obj.getObjectByName('wheel_fr');
  if (frontRight) {
    obj.updateMatrixWorld(true);
    const wBox = new THREE.Box3().setFromObject(frontRight);
    const wCenter = wBox.getCenter(new THREE.Vector3());
    wheelPos.set(wCenter.x, wCenter.y, Math.max(wBox.max.z, W * 0.48) + 0.03);
  }

  return {
    engine: { pos: new THREE.Vector3(L * 0.31, H * 0.66, 0), normal: up },
    wheel: { pos: wheelPos, normal: side },
    cabin: { pos: new THREE.Vector3(L * 0.02, H * 0.98, 0), normal: up },
    body: { pos: new THREE.Vector3(-L * 0.34, H * 0.62, W * 0.49), normal: side },
  };
}

function createHitProxies(size, parent) {
  const L = size.x, H = size.y, W = size.z;
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const specs = [
    ['engine', L * 0.34, H * 0.52, W * 0.92, L * 0.3, H * 0.42, 0],
    ['cabin', L * 0.36, H * 0.56, W * 0.78, -L * 0.02, H * 0.72, 0],
    ['body', L * 0.34, H * 0.58, W * 0.94, -L * 0.32, H * 0.48, 0],
    ['wheel', L * 0.22, H * 0.52, W * 1.04, L * 0.28, H * 0.26, 0],
    ['wheel', L * 0.22, H * 0.52, W * 1.04, -L * 0.28, H * 0.26, 0],
  ];
  return specs.map(([zone, sx, sy, sz, x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), proxyMat);
    m.position.set(x, y, z);
    m.userData.zone = zone;
    parent.add(m);
    return m;
  });
}

function tickRing(r0, r1, r2, count, majorEvery, color, y) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const outer = i % majorEvery === 0 ? r2 : r1;
    pts.push(Math.cos(a) * r0, y, Math.sin(a) * r0, Math.cos(a) * outer, y, Math.sin(a) * outer);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
}

function radialLines(r0, r1, count, color) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    pts.push(Math.cos(a) * r0, 0.001, Math.sin(a) * r0, Math.cos(a) * r1, 0.001, Math.sin(a) * r1);
  }
  for (const r of [4.6, 6.2]) {
    const n = 160;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      pts.push(Math.cos(a0) * r, 0.001, Math.sin(a0) * r, Math.cos(a1) * r, 0.001, Math.sin(a1) * r);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
}

function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Мягкая общая тень под днищем кузова
  ctx.save();
  ctx.translate(256, 128);
  ctx.scale(1.0, 0.52);
  const bodyGrad = ctx.createRadialGradient(0, 0, 24, 0, 0, 232);
  bodyGrad.addColorStop(0, 'rgba(0,0,0,0.92)');
  bodyGrad.addColorStop(0.55, 'rgba(0,0,0,0.68)');
  bodyGrad.addColorStop(0.82, 'rgba(0,0,0,0.22)');
  bodyGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(-256, -256, 512, 512);
  ctx.restore();

  // 4 плотных контактных пятна под шинами (передняя и задняя оси)
  const patches = [
    [256 + (1.42 / 2.8) * 256, 128 - (0.81 / 1.425) * 128],
    [256 + (1.42 / 2.8) * 256, 128 + (0.81 / 1.425) * 128],
    [256 + (-1.38 / 2.8) * 256, 128 - (0.81 / 1.425) * 128],
    [256 + (-1.38 / 2.8) * 256, 128 + (0.81 / 1.425) * 128],
  ];
  for (const [px, py] of patches) {
    const wg = ctx.createRadialGradient(px, py, 6, px, py, 44);
    wg.addColorStop(0, 'rgba(0,0,0,0.95)');
    wg.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    wg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(px - 48, py - 48, 96, 96);
  }

  return new THREE.CanvasTexture(c);
}

function brushedDeckTexture(maxAniso = 4) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, 512, 512);
  // Концентрическая шлифовка металла диска поворотного круга
  for (let r = 8; r < 256; r += 2) {
    const v = 128 + Math.floor(Math.sin(r * 0.9) * 18 + Math.cos(r * 0.35) * 10);
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = maxAniso;
  return tex;
}
