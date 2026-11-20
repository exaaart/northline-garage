// 3D-сцена Hero: автомобиль на калиброванном поворотном круге.
// Сначала пытается загрузить /models/auto-car.glb; если файла нет — строит
// процедурный концепт-кар без брендинга (визуальная заглушка).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const ACCENT = 0xff5f1f;
const CAR_LEN = 4.6;
const DECK_Y = 0.06;

export function initGarage({ canvas, stage, modelUrl, hotspotEls = {}, getShift, onAzimuth, onHover, onSource, onFail }) {
  const lite =
    matchMedia('(max-width: 820px)').matches ||
    matchMedia('(pointer: coarse)').matches ||
    (navigator.hardwareConcurrency || 8) <= 4;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'high-performance' });
  } catch (e) {
    onFail?.(e);
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, lite ? 1.25 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 10, 22);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0.62, 0);
  const viewDir = new THREE.Vector3(0.66, 0.3, 0.69).normalize();
  let camDist = 11;

  // --- Свет ---
  scene.add(new THREE.HemisphereLight(0xc4ccd4, 0x050505, 0.35));
  const key = new THREE.SpotLight(0xffffff, 140, 0, 0.55, 0.85, 2);
  key.position.set(2.5, 7.5, 4);
  key.target.position.set(0, 0.4, 0);
  key.castShadow = !lite;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  key.shadow.radius = 6;
  scene.add(key, key.target);
  const rim = new THREE.PointLight(ACCENT, 20, 12, 2);
  rim.position.set(-4.2, 1.3, -3.2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.7);
  fill.position.set(-5, 3, 5);
  scene.add(fill);

  // --- Пол и шкалы ---
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, lite ? 48 : 96),
    new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.55, metalness: 0.3 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = !lite;
  scene.add(floor);

  // Радиальные технические линии на полу (неподвижные)
  scene.add(radialLines(3.6, 10, 24, 0x2a2e33));
  // Внешняя неподвижная шкала + индекс
  scene.add(tickRing(3.42, 3.52, 3.62, 72, 6, 0x5b6269, 0.0012));
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
  index.position.set(0, 0.004, 3.76);
  index.rotation.z = Math.PI;
  indexHolder.rotation.y = azDeg;
  scene.add(indexHolder);

  // Поворотный круг (вращается вместе с машиной)
  const table = new THREE.Group();
  scene.add(table);
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(3.25, 3.3, DECK_Y, lite ? 64 : 128),
    new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.3, metalness: 0.75 })
  );
  deck.position.y = DECK_Y / 2;
  deck.receiveShadow = !lite;
  table.add(deck);
  const deckTicks = tickRing(2.95, 3.05, 3.15, 180, 10, 0x6b737b, DECK_Y + 0.002);
  table.add(deckTicks);
  const zeroMark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.035, 0.34),
    new THREE.MeshBasicMaterial({ color: ACCENT })
  );
  zeroMark.rotation.x = -Math.PI / 2;
  zeroMark.position.set(3.05, DECK_Y + 0.003, 0);
  zeroMark.rotation.z = Math.PI / 2;
  table.add(zeroMark);
  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(3.28, 0.012, 6, lite ? 96 : 192),
    new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 1, roughness: 0.2 })
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = DECK_Y;
  table.add(edge);

  // Мягкая контактная тень для облегчённого режима
  if (lite) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({
      map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.85,
    }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = DECK_Y + 0.004;
    table.add(sh);
  }

  const carSlot = new THREE.Group();
  carSlot.position.y = DECK_Y;
  table.add(carSlot);

  const anchors = {};
  let carBox = new THREE.Box3();
  let carMeshes = [];

  function mountCar(obj, anchorDefs) {
    carSlot.clear();
    carSlot.add(obj);
    carMeshes = [];
    obj.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = !lite;
        m.receiveShadow = false;
        carMeshes.push(m);
      }
    });
    carBox.setFromObject(carSlot);
    for (const [id, def] of Object.entries(anchorDefs)) {
      const a = new THREE.Object3D();
      a.position.copy(def.pos);
      a.userData.normal = def.normal.clone();
      carSlot.add(a);
      anchors[id] = a;
    }
  }

  // --- Модель: GLB или заглушка ---
  loadModel(modelUrl, lite)
    .then((gltfScene) => {
      const { obj, size } = normalizeModel(gltfScene);
      mountCar(obj, anchorsFromSize(size));
      onSource?.('model');
    })
    .catch(() => {
      const car = buildConceptCar(lite);
      mountCar(car.group, car.anchors);
      onSource?.('placeholder');
    });

  // --- Взаимодействие ---
  let rotY = reduced ? 0 : -0.95;
  let vel = 0;
  let dragging = false;
  let lastX = 0;
  let lastInteract = performance.now();
  const pointer = new THREE.Vector2(9, 9);
  const parallax = new THREE.Vector2();
  const parallaxT = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  let hoverZone = null;

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
  });

  const api = {
    nudge(dir) {
      vel = dir * 0.09;
      lastInteract = performance.now();
    },
    lite,
  };

  // --- Размер ---
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const shift = getShift ? getShift() : 0;
    const effAspect = camera.aspect * (1 - shift * 1.6);
    camDist = THREE.MathUtils.clamp(14.8 / Math.min(Math.max(effAspect, 0.6), 1.5), 10, 20);
    if (shift) camera.setViewOffset(w, h, -w * shift, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    requestAnimationFrame(() => loop());
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // --- Цикл ---
  let visible = true;
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) loop();
  }).observe(stage);
  document.addEventListener('visibilitychange', () => !document.hidden && loop());

  const clock = new THREE.Clock();
  const t0 = performance.now();
  let running = false;
  let lastAz = -1;
  const tmpV = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const nm = new THREE.Matrix3();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    const intro = reduced ? 1 : Math.min((now - t0) / 2200, 1);
    const ease = 1 - Math.pow(1 - intro, 3);

    if (!dragging) {
      if (intro < 1) {
        rotY = -0.95 * (1 - ease);
      } else {
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
    camera.position.y += parallax.y * -0.25 + 0.0;
    camera.lookAt(target);

    // Наведение: определяем зону автомобиля под курсором
    let zone = null;
    if (!dragging && carMeshes.length && Math.abs(pointer.x) <= 1) {
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(carMeshes, false)[0];
      if (hit) zone = zoneFor(carSlot.worldToLocal(hit.point.clone()), carBox, carSlot);
    }
    if (zone !== hoverZone) {
      hoverZone = zone;
      stage.classList.toggle('is-over-car', !!zone);
      onHover?.(zone);
    }

    renderer.render(scene, camera);

    // Позиции информационных точек
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    camera.getWorldPosition(tmpC);
    for (const [id, el] of Object.entries(hotspotEls)) {
      const a = anchors[id];
      if (!a) continue;
      a.getWorldPosition(tmpV);
      nm.getNormalMatrix(a.matrixWorld);
      tmpN.copy(a.userData.normal).applyMatrix3(nm).normalize();
      const facing = tmpN.dot(tmpC.clone().sub(tmpV).normalize());
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
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  loop();
  return api;
}

// ---------- helpers ----------

function zoneFor(p, box) {
  const size = box.getSize(new THREE.Vector3());
  const min = box.min;
  const fy = (p.y - (min.y - DECK_Y)) / size.y;
  const fx = p.x / (size.x / 2);
  if (fy < 0.36) return 'wheel';
  if (fx > 0.42) return 'engine';
  if (fy > 0.7) return 'cabin';
  return 'body';
}

async function loadModel(url, lite) {
  if (!url) throw new Error('no url');
  const head = await fetch(url, { method: 'HEAD' });
  const type = head.headers.get('content-type') || '';
  if (!head.ok || type.includes('text/html')) throw new Error('model missing');
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync(url);
  gltf.scene.traverse((m) => {
    if (m.isMesh && m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if ('envMapIntensity' in mat) mat.envMapIntensity = 1.2;
        if (lite && mat.normalMap) mat.normalScale?.multiplyScalar(0.6);
      });
    }
  });
  return gltf.scene;
}

function normalizeModel(root) {
  const holder = new THREE.Group();
  holder.add(root);
  let box = new THREE.Box3().setFromObject(root);
  let size = box.getSize(new THREE.Vector3());
  if (size.z > size.x) {
    root.rotation.y = Math.PI / 2;
    box = new THREE.Box3().setFromObject(holder);
    size = box.getSize(new THREE.Vector3());
  }
  const s = CAR_LEN / size.x;
  root.scale.multiplyScalar(s);
  box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y;
  size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  return { obj: holder, size };
}

function anchorsFromSize(size) {
  const L = size.x, H = size.y, W = size.z;
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(0, 0, 1);
  return {
    engine: { pos: new THREE.Vector3(L * 0.33, H * 0.72, 0), normal: up },
    wheel: { pos: new THREE.Vector3(L * 0.3, H * 0.26, W / 2), normal: side },
    cabin: { pos: new THREE.Vector3(L * 0.04, H * 0.96, 0), normal: up },
    body: { pos: new THREE.Vector3(-L * 0.36, H * 0.62, W / 2), normal: side },
  };
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
  // Концентрические окружности
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

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 64, 8, 128, 64, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.95)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  return new THREE.CanvasTexture(c);
}

// ---------- процедурный концепт-кар ----------

function buildConceptCar(lite) {
  const g = new THREE.Group();
  const seg = lite ? 24 : 48;

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x30353b, metalness: 0.8, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x07090b, metalness: 0.3, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.6, metalness: 0.3 });
  const tireM = new THREE.MeshStandardMaterial({ color: 0x101113, roughness: 0.88 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0xb8bfc6, metalness: 1, roughness: 0.22 });
  const rimDark = new THREE.MeshStandardMaterial({ color: 0x1c1f23, metalness: 0.8, roughness: 0.35 });
  const discM = new THREE.MeshStandardMaterial({ color: 0x6d737a, metalness: 0.9, roughness: 0.45 });
  const caliperM = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.35, metalness: 0.2 });
  const ledW = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.4 });
  const ledR = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2414, emissiveIntensity: 2.2 });
  const accentLine = new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.8 });

  const R = 0.4;
  const rwX = -1.38;
  const fwX = 1.42;
  const wy = R;
  const archR = R + 0.07;

  // Боковой профиль кузова
  const s = new THREE.Shape();
  s.moveTo(-2.2, 0.32);
  s.lineTo(rwX - archR, 0.32);
  s.absarc(rwX, wy, archR, Math.PI, 0, true);
  s.lineTo(fwX - archR, 0.32);
  s.absarc(fwX, wy, archR, Math.PI, 0, true);
  s.lineTo(2.12, 0.3);
  s.quadraticCurveTo(2.36, 0.32, 2.38, 0.5);
  s.quadraticCurveTo(2.36, 0.64, 2.16, 0.68);
  s.quadraticCurveTo(1.5, 0.78, 0.9, 0.93);
  s.lineTo(-1.9, 1.0);
  s.quadraticCurveTo(-2.3, 1.0, -2.34, 0.84);
  s.quadraticCurveTo(-2.38, 0.5, -2.2, 0.32);

  const depth = 1.78;
  const bodyG = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: 0.11, bevelSize: 0.07,
    bevelSegments: lite ? 3 : 6, curveSegments: lite ? 16 : 40,
  });
  bodyG.translate(0, 0, -depth / 2);
  taper(bodyG, 0.62, 1.08, 0.88);
  bodyG.computeVertexNormals();
  const body = new THREE.Mesh(bodyG, paint);
  g.add(body);

  // Остекление (панорамная крыша)
  const c = new THREE.Shape();
  c.moveTo(0.98, 0.9);
  c.quadraticCurveTo(0.3, 1.26, -0.15, 1.33);
  c.lineTo(-0.95, 1.35);
  c.quadraticCurveTo(-1.6, 1.32, -2.02, 0.99);
  c.lineTo(-1.98, 0.94);
  c.lineTo(0.98, 0.86);
  const cd = 1.38;
  const cabG = new THREE.ExtrudeGeometry(c, {
    depth: cd, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05,
    bevelSegments: lite ? 3 : 5, curveSegments: lite ? 14 : 32,
  });
  cabG.translate(0, 0, -cd / 2);
  taper(cabG, 0.9, 1.4, 0.78);
  cabG.computeVertexNormals();
  g.add(new THREE.Mesh(cabG, glass));

  // Днище, решётка, оптика, зеркала
  const under = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.16, 1.32), trim);
  under.position.set(0, 0.32, 0);
  g.add(under);
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 1.3), trim);
  intake.position.set(2.43, 0.4, 0);
  g.add(intake);
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.028, 1.74), ledW);
  front.position.set(2.39, 0.62, 0);
  front.rotation.z = -0.45;
  g.add(front);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 1.82), ledR);
  rear.position.set(-2.38, 0.88, 0);
  rear.rotation.z = -0.5;
  g.add(rear);
  for (const z of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.14), paint);
    mirror.position.set(0.72, 0.99, z * 0.96);
    g.add(mirror);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.016, 0.01), accentLine);
    sill.position.set(0.02, 0.44, z * 1.0);
    g.add(sill);
  }

  // Колёса
  const wheelPos = [
    [rwX, 1], [rwX, -1], [fwX, 1], [fwX, -1],
  ];
  for (const [x, side] of wheelPos) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.27, seg, 1), tireM);
    tire.rotation.x = Math.PI / 2;
    w.add(tire);
    const wall = new THREE.Mesh(new THREE.TorusGeometry(R - 0.035, 0.04, 8, seg), tireM);
    wall.position.z = 0.115;
    w.add(wall);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, seg), rimDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.06;
    w.add(barrel);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, seg), discM);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.08;
    w.add(disc);
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.07), caliperM);
    caliper.position.set(-0.13, 0.13, 0.1);
    caliper.rotation.z = 0.75;
    w.add(caliper);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 8, seg), rimM);
    lip.position.z = 0.13;
    w.add(lip);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.27, 0.025), rimM);
      const a = (i / 5) * Math.PI * 2;
      spoke.position.set(Math.sin(a) * 0.14, Math.cos(a) * 0.14, 0.13);
      spoke.rotation.z = -a;
      w.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), rimDark);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.14;
    w.add(hub);
    w.position.set(x, wy, side * 0.82);
    if (side < 0) w.rotation.y = Math.PI;
    g.add(w);
  }

  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(0, 0, 1);
  return {
    group: g,
    anchors: {
      engine: { pos: new THREE.Vector3(1.55, 0.86, 0), normal: up },
      wheel: { pos: new THREE.Vector3(fwX, 0.42, 1.0), normal: side },
      cabin: { pos: new THREE.Vector3(-0.4, 1.38, 0), normal: up },
      body: { pos: new THREE.Vector3(-1.75, 0.78, 1.0), normal: side },
    },
  };
}

// Сужение кузова к верху (завал боковин)
function taper(geo, y0, y1, minScale) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > y0) {
      const t = Math.min((y - y0) / (y1 - y0), 1);
      p.setZ(i, p.getZ(i) * (1 - (1 - minScale) * t * t));
    }
  }
  p.needsUpdate = true;
}
