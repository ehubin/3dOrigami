// Geometry for phone capture. No DOM or Babylon dependency.
//
// Model: { pt: [[x,y,z],...], f: [[vertexIdx,...],...] }, in cm, with faces
// wound counter-clockwise seen from outside (same convention as Origami).
//
// Shape: a face's 2D corners [[x,y],...], y up, counter-clockwise, so the
// viewer of the photo is outside the face. Side i runs corner i -> i+1.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
export const length = a => Math.sqrt(dot(a, a));
export const normalize = a => scale(a, 1 / length(a));
export const dist = (a, b) => length(sub(a, b));

const mod = (i, n) => ((i % n) + n) % n;

export function emptyModel() { return { pt: [], f: [] }; }
export function cloneModel(m) {
    return { pt: m.pt.map(p => p.slice()), f: m.f.map(f => f.slice()) };
}

// ---------------------------------------------------------------- 2D shapes

export function signedArea2D(poly) {
    let a = 0;
    poly.forEach((p, i) => {
        const q = poly[(i + 1) % poly.length];
        a += p[0] * q[1] - q[0] * p[1];
    });
    return a / 2;
}

// Puts image corners (y down) in the order that is counter-clockwise on
// screen, which is counter-clockwise from outside the face. Kept separate from
// pixelsToShape so side numbers shown on the photo never change afterwards.
export function orderPixelCorners(pixels) {
    // In y-down coordinates, counter-clockwise on screen has negative area.
    return signedArea2D(pixels) > 0 ? pixels.slice().reverse() : pixels.slice();
}

export function pixelsToShape(pixels) {
    const shape = pixels.map(([x, y]) => [x, -y]);
    if (signedArea2D(shape) <= 0) throw new Error('Corners must be counter-clockwise on screen');
    return shape;
}

// True if no two non-adjacent sides cross.
export function isSimplePolygon(poly) {
    const n = poly.length;
    const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        for (let j = i + 1; j < n; j++) {
            if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
            const c = poly[j], d = poly[(j + 1) % n];
            if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return false;
        }
    }
    return true;
}

export function sideLength2D(shape, side) {
    const p = shape[side], q = shape[(side + 1) % shape.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
}

// ------------------------------------------------------------- 3D face tools

// Newell's method: robust for non-planar and concave polygons.
export function faceNormal(model, face) {
    const n = [0, 0, 0];
    face.forEach((vi, i) => {
        const p = model.pt[vi], q = model.pt[face[(i + 1) % face.length]];
        n[0] += (p[1] - q[1]) * (p[2] + q[2]);
        n[1] += (p[2] - q[2]) * (p[0] + q[0]);
        n[2] += (p[0] - q[0]) * (p[1] + q[1]);
    });
    return normalize(n);
}

export function faceCentroid(model, face) {
    let c = [0, 0, 0];
    face.forEach(vi => { c = add(c, model.pt[vi]); });
    return scale(c, 1 / face.length);
}

// Largest distance of a corner from the face's best-fit plane.
export function faceFlatness(model, face) {
    if (face.length < 4) return 0;
    const n = faceNormal(model, face), c = faceCentroid(model, face);
    return Math.max(...face.map(vi => Math.abs(dot(n, sub(model.pt[vi], c)))));
}

// Origami.getNorm uses only f[0..2], so those three must form a convex corner
// or a concave face gets a flipped normal. Rotating keeps the winding.
export function rotateToConvexStart(points, face) {
    const pts = { pt: points };
    const n = faceNormal(pts, face);
    const N = face.length;
    let best = 0, bestArea = -Infinity;
    for (let i = 0; i < N; i++) {
        const a = points[face[i]], b = points[face[(i + 1) % N]], c = points[face[(i + 2) % N]];
        const area = dot(cross(sub(b, a), sub(c, a)), n);
        if (area > bestArea) { bestArea = area; best = i; }
    }
    return face.map((_, i) => face[(i + best) % N]);
}

// Interior (material-side) angle in degrees across the edge shared by two
// faces. 90 for a cube, over 180 for a concave edge.
export function interiorAngle(model, fa, fb) {
    const faceA = model.f[fa], faceB = model.f[fb];
    for (let i = 0; i < faceA.length; i++) {
        const a = faceA[i], b = faceA[(i + 1) % faceA.length];
        const k = faceB.indexOf(b);
        if (k >= 0 && faceB[(k + 1) % faceB.length] === a) {
            const n1 = faceNormal(model, faceA), n2 = faceNormal(model, faceB);
            const e = normalize(sub(model.pt[b], model.pt[a]));
            const d = Math.max(-1, Math.min(1, dot(n1, n2)));
            const between = Math.acos(d) * 180 / Math.PI;
            // Right-handed here, so this sign is the opposite of Origami's,
            // which sees the same edge through the mirrored export below.
            return dot(cross(n1, n2), e) < -1e-12 ? 180 + between : 180 - between;
        }
    }
    throw new Error('Faces do not share an edge');
}

// A side is free if no face runs along it in the opposite direction.
export function freeSides(model) {
    const present = new Set();
    model.f.forEach(f => f.forEach((a, i) => present.add(`${a},${f[(i + 1) % f.length]}`)));
    const res = [];
    model.f.forEach((f, face) => f.forEach((a, side) => {
        const b = f[(side + 1) % f.length];
        if (!present.has(`${b},${a}`)) res.push({ face, side, a, b });
    }));
    return res;
}

// Mirrors Origami.checkClosure: closed means every edge has exactly two faces.
export function isClosed(model) {
    if (model.f.length === 0) return false;
    const count = new Map();
    model.f.forEach(f => f.forEach((a, i) => {
        const b = f[(i + 1) % f.length];
        const k = a < b ? `${a},${b}` : `${b},${a}`;
        count.set(k, (count.get(k) || 0) + 1);
    }));
    return [...count.values()].every(c => c === 2);
}

// ----------------------------------------------------------- placing a face

export function placeFirstFace(shape, side, lengthCm) {
    if (!(lengthCm > 0)) throw new Error('Side length must be positive');
    const s = lengthCm / sideLength2D(shape, side);
    let cx = 0, cy = 0;
    shape.forEach(p => { cx += p[0]; cy += p[1]; });
    cx /= shape.length; cy /= shape.length;
    const pt = shape.map(p => [(p[0] - cx) * s, (p[1] - cy) * s, 0]);
    return { pt, f: [rotateToConvexStart(pt, shape.map((_, i) => i))] };
}

// Computes where a new face lands, without changing the model.
//   existing: {face, side}, a free side of the model
//   side:     the side of `shape` that joins it
//   angleDeg: interior angle (over 180 for a concave edge)
// Returns corner positions, plus nearby free vertices that corners could merge
// with: [{corner, vertex, gap}].
export function computePlacement(model, shape, side, existing, angleDeg, opts = {}) {
    const N = shape.length;
    const f = model.f[existing.face];
    const aIdx = f[existing.side], bIdx = f[(existing.side + 1) % f.length];
    if (!freeSides(model).some(s => s.a === aIdx && s.b === bIdx)) {
        throw new Error('That side already has two faces');
    }
    if (!(angleDeg > 0 && angleDeg < 360)) throw new Error('Angle must be between 0 and 360');

    const A = model.pt[aIdx], B = model.pt[bIdx];
    const e = normalize(sub(B, A));
    const n = faceNormal(model, f);
    const u = cross(n, e); // in the existing face, pointing away from the edge
    const th = angleDeg * Math.PI / 180;
    const uNew = sub(scale(u, Math.cos(th)), scale(n, Math.sin(th)));

    // The new face runs along the shared edge in the opposite direction.
    const c0 = shape[side], c1 = shape[(side + 1) % N];
    const L = sideLength2D(shape, side);
    const s = dist(A, B) / L;
    const xh = [(c1[0] - c0[0]) / L, (c1[1] - c0[1]) / L];
    const yh = [-xh[1], xh[0]];
    const xDir = scale(e, -1);

    const positions = shape.map(p => {
        const dx = p[0] - c0[0], dy = p[1] - c0[1];
        const px = dx * xh[0] + dy * xh[1], py = dx * yh[0] + dy * yh[1];
        return add(add(B, scale(xDir, s * px)), scale(uNew, s * py));
    });
    const c0i = side, c1i = (side + 1) % N;
    const vertex = positions.map(() => null);
    vertex[c0i] = bIdx;
    vertex[c1i] = aIdx;
    positions[c0i] = B.slice();
    positions[c1i] = A.slice();

    // Merge candidates: closest free vertex within tolerance of each corner.
    const minSide = Math.min(...positions.map((p, i) => dist(p, positions[(i + 1) % N])));
    const tol = opts.mergeTolerance ?? 0.15 * minSide;
    const freeV = new Set();
    freeSides(model).forEach(fs => { freeV.add(fs.a); freeV.add(fs.b); });
    const merges = [];
    positions.forEach((p, corner) => {
        if (vertex[corner] !== null) return;
        let best = -1, bestD = tol;
        freeV.forEach(v => {
            if (v === aIdx || v === bIdx) return;
            const d = dist(p, model.pt[v]);
            if (d <= bestD) { bestD = d; best = v; }
        });
        if (best >= 0) merges.push({ corner, vertex: best, gap: bestD });
    });
    return { positions, vertex, merges, shapeScale: s };
}

// Adds the face, merging the chosen candidates. Existing corners keep their
// positions. Returns the new model and new face index.
export function commitPlacement(model, placement, acceptedMerges = placement.merges) {
    const out = cloneModel(model);
    const vertex = placement.vertex.slice();
    const used = new Set();
    acceptedMerges.forEach(m => {
        if (used.has(m.vertex)) throw new Error('Two corners cannot merge with one vertex');
        used.add(m.vertex);
        vertex[m.corner] = m.vertex;
    });
    const face = placement.positions.map((p, i) => {
        if (vertex[i] !== null) return vertex[i];
        out.pt.push(p.slice());
        return out.pt.length - 1;
    });
    // A directed edge can appear once, or the surface would fold over itself.
    const present = new Set();
    out.f.forEach(f => f.forEach((a, i) => present.add(`${a},${f[(i + 1) % f.length]}`)));
    face.forEach((a, i) => {
        const b = face[(i + 1) % face.length];
        if (present.has(`${a},${b}`)) {
            throw new Error('Merging these corners would give an edge three faces, or a face turned inside out');
        }
    });
    out.f.push(rotateToConvexStart(out.pt, face));
    return { model: out, faceIndex: out.f.length - 1 };
}

// ------------------------------------------------------------------- closing

// Loops of free sides, each a vertex list running along the free sides. The
// face that fills a loop runs through it in reverse.
export function freeLoops(model) {
    const next = new Map();
    freeSides(model).forEach(({ a, b }) => {
        if (!next.has(a)) next.set(a, []);
        next.get(a).push(b);
    });
    const loops = [];
    for (const start of [...next.keys()]) {
        while (next.get(start)?.length) {
            const path = [start];
            let cur = next.get(start).shift();
            let guard = 0;
            while (cur !== start && next.get(cur)?.length && guard++ < 100000) {
                // At a vertex visited twice, split off the inner loop.
                const seen = path.indexOf(cur);
                if (seen >= 0) {
                    loops.push(path.splice(seen));
                    path.push(cur);
                } else {
                    path.push(cur);
                }
                cur = next.get(cur).shift();
            }
            if (cur === start && path.length >= 3) loops.push(path);
        }
    }
    return loops;
}

// Each pass projects each non-triangular face onto its best-fit plane, then
// averages each corner's projected positions. Triangles impose nothing.
export function flattenFaces(model, passes = 50) {
    const out = cloneModel(model);
    const start = out.pt.map(p => p.slice());
    for (let pass = 0; pass < passes; pass++) {
        const sum = out.pt.map(() => [0, 0, 0]);
        const cnt = out.pt.map(() => 0);
        out.f.forEach(f => {
            if (f.length < 4) return;
            const n = faceNormal(out, f), c = faceCentroid(out, f);
            f.forEach(vi => {
                const p = out.pt[vi];
                sum[vi] = add(sum[vi], sub(p, scale(n, dot(n, sub(p, c)))));
                cnt[vi]++;
            });
        });
        out.pt = out.pt.map((p, i) => (cnt[i] ? scale(sum[i], 1 / cnt[i]) : p));
    }
    const maxMove = Math.max(0, ...out.pt.map((p, i) => dist(p, start[i])));
    const maxFlatness = Math.max(0, ...out.f.map(f => faceFlatness(out, f)));
    return { model: out, maxMove, maxFlatness };
}

// Adds one face across a loop, flattening if it isn't already flat.
export function closeLoop(model, loop, opts = {}) {
    const flatTol = opts.flatTolerance ?? 1e-6;
    const base = cloneModel(model);
    const face = loop.slice().reverse();
    base.f.push(rotateToConvexStart(base.pt, face));
    const before = Math.max(...base.f.map(f => faceFlatness(base, f)));
    if (before <= flatTol) return { model: base, maxMove: 0, maxFlatness: before };
    return flattenFaces(base);
}

// Fills a loop with triangles, moving no corners (ear clipping).
export function closeLoopTriangulated(model, loop) {
    const out = cloneModel(model);
    const face = loop.slice().reverse();
    const n = faceNormal(out, face);
    const seed = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const ex = normalize(cross(seed, n)), ey = cross(n, ex);
    const p2 = new Map(face.map(v => [v, [dot(out.pt[v], ex), dot(out.pt[v], ey)]]));
    const turn = (a, b, c) => {
        const A = p2.get(a), B = p2.get(b), C = p2.get(c);
        return (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    };
    const remaining = face.slice();
    let guard = remaining.length * remaining.length + 8;
    while (remaining.length > 3 && guard-- > 0) {
        let clipped = false;
        for (let i = 0; i < remaining.length; i++) {
            const a = remaining[mod(i - 1, remaining.length)], b = remaining[i], c = remaining[(i + 1) % remaining.length];
            if (turn(a, b, c) <= 1e-12) continue;
            const blocked = remaining.some(v => v !== a && v !== b && v !== c
                && turn(a, b, v) >= 0 && turn(b, c, v) >= 0 && turn(c, a, v) >= 0);
            if (blocked) continue;
            out.f.push([a, b, c]);
            remaining.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped) break;
    }
    if (remaining.length !== 3) throw new Error('Could not split this hole into triangles');
    out.f.push(remaining);
    return out;
}

// ---------------------------------------------------------------------- export

// Capture works in right-handed coordinates, but the app runs on Babylon's
// left-handed default: its faces are counter-clockwise from outside on screen,
// which is numerically a negative signed volume, and its mold code relies on
// that sign (origami.js:1199). Mirroring x converts between the two: the winding
// stays the same and the shape keeps its real-world handedness on screen.
export function modelToExport(model, name) {
    const round = v => (Math.round(v * 1e4) / 1e4) + 0; // + 0 turns -0 into 0
    return {
        name,
        pt: model.pt.map(([x, y, z]) => [round(-x), round(y), round(z)]),
        f: model.f.map(f => f.slice()),
    };
}
