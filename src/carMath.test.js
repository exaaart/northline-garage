import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_SPEC,
  buildLongitudinalStations,
  sampleLowerBodyRing,
  buildLoftedMeshData,
  getLowerBodyProfile,
  getCabinProfile,
  getCaliperPlacement,
  classifyCarZone,
} from './carMath.js';

test('longitudinal stations are strictly increasing and span car length', () => {
  const stations = buildLongitudinalStations(false);
  assert.ok(stations.length > 40, 'should have rich sampling on desktop');
  assert.equal(stations[0], CAR_SPEC.xMin);
  assert.equal(stations[stations.length - 1], CAR_SPEC.xMax);
  for (let i = 1; i < stations.length; i++) {
    assert.ok(stations[i] > stations[i - 1], `station ${i} must strictly increase`);
  }
});

test('lower body rings stay symmetric across Z=0 and leave clearance above wheel arches', () => {
  const stations = buildLongitudinalStations(false);
  for (const x of stations) {
    const p = getLowerBodyProfile(x);
    assert.ok(p.yShoulder > p.yBottom + 0.04, `fender clearance violated at x=${x}`);
    const ring = sampleLowerBodyRing(x);
    const n = ring.length;
    assert.equal(n % 2, 1, 'ring should have odd count with exact centerline vertex');
    const mid = (n - 1) / 2;
    assert.ok(Math.abs(ring[mid][2]) < 1e-9, 'centerline vertex must have z=0');
    for (let k = 0; k < mid; k++) {
      const left = ring[k];
      const right = ring[n - 1 - k];
      assert.ok(Math.abs(left[0] - right[0]) < 1e-9);
      assert.ok(Math.abs(left[1] - right[1]) < 1e-9);
      assert.ok(Math.abs(left[2] + right[2]) < 1e-9, 'Z must mirror symmetrically');
    }
  }
});

test('lofted mesh produces valid indices and strictly outward-facing normals on top and flanks', () => {
  const stations = buildLongitudinalStations(true);
  const rings = stations.map((x) => sampleLowerBodyRing(x));
  const { positions, indices } = buildLoftedMeshData(rings);

  assert.ok(positions.length > 0);
  assert.ok(indices.length > 0);
  for (let i = 0; i < positions.length; i++) {
    assert.ok(Number.isFinite(positions[i]), 'all coordinates must be finite');
  }

  // Проверяем направление нормалей треугольников на крышке капота (x ≈ 1.4, z ≈ 0) и правом борту (z > 0.8)
  let topChecks = 0;
  let rightChecks = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t] * 3;
    const ib = indices[t + 1] * 3;
    const ic = indices[t + 2] * 3;

    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
    const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-7) continue;

    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const mz = (az + bz + cz) / 3;

    if (Math.abs(mz) < 0.25 && mx > 1.0 && mx < 1.8) {
      assert.ok(ny > 0, `hood triangle normal must point +Y, got ny=${ny}`);
      topChecks++;
    }
    if (mz > 0.82 && my > 0.35 && my < 0.72 && Math.abs(mx) < 0.6) {
      assert.ok(nz > 0, `right door normal must point +Z, got nz=${nz}`);
      rightChecks++;
    }
  }
  assert.ok(topChecks > 5, 'should check hood normals');
  assert.ok(rightChecks > 5, 'should check right door normals');
});

test('cabin envelope stays smoothly above lower body and narrower than waist', () => {
  for (const x of [-1.4, -0.5, 0.0, 0.44]) {
    const cab = getCabinProfile(x);
    const low = getLowerBodyProfile(x);
    assert.ok(cab.yTop > low.yCenter + 0.1, `cabin roof must sit above lower deck at x=${x}`);
    assert.ok(cab.halfW < low.halfW - 0.15, `cabin must tumblehome inward at x=${x}`);
  }
});

test('brake calipers are strictly symmetric between left and right sides on both axles', () => {
  for (const axle of ['front', 'rear']) {
    const left = getCaliperPlacement(axle, -1);
    const right = getCaliperPlacement(axle, 1);
    assert.equal(left.offsetX, right.offsetX, `${axle} caliper X must match left/right`);
    assert.equal(left.offsetY, right.offsetY, `${axle} caliper Y must match left/right`);
    assert.equal(left.tiltZ, right.tiltZ, `${axle} caliper tilt must match left/right`);
    assert.equal(left.offsetZ, -right.offsetZ, `${axle} caliper Z must mirror across center`);
  }
});

test('zone classification maps key car regions accurately', () => {
  assert.equal(classifyCarZone({ x: 1.4, y: 0.25, z: 0.8 }, 0.06, 4.64, 1.31), 'wheel');
  assert.equal(classifyCarZone({ x: 1.5, y: 0.82, z: 0.0 }, 0.06, 4.64, 1.31), 'engine');
  assert.equal(classifyCarZone({ x: -0.2, y: 1.25, z: 0.0 }, 0.06, 4.64, 1.31), 'cabin');
  assert.equal(classifyCarZone({ x: -1.6, y: 0.78, z: 0.9 }, 0.06, 4.64, 1.31), 'body');
});
