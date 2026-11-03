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

    const merges = findMerges(model, positions, vertex, opts);
    return { positions, vertex, merges, shapeScale: s };
}

// Merge candidates: closest free vertex within tolerance of each new corner.
function findMerges(model, positions, vertex, opts) {
    const N = positions.length;
    const minSide = Math.min(...positions.map((p, i) => dist(p, positions[(i + 1) % N])));
    const tol = opts.mergeTolerance ?? 0.15 * minSide;
    const taken = new Set(vertex.filter(v => v !== null));
    const freeV = new Set();
    freeSides(model).forEach(fs => { freeV.add(fs.a); freeV.add(fs.b); });
    const merges = [];
    positions.forEach((p, corner) => {
        if (vertex[corner] !== null) return;
        let best = -1, bestD = tol;
        freeV.forEach(v => {
            if (taken.has(v)) return;
            const d = dist(p, model.pt[v]);
            if (d <= bestD) { bestD = d; best = v; }
        });
        if (best >= 0) merges.push({ corner, vertex: best, gap: bestD });
    });
    return merges;
}

// ----------------------------------------- a face from a chain of selected sides

const MIN_CORNER_SIN = 0.1; // about 6 degrees from straight: too unstable to fit a photo to

// Free sides that join end to end, as { vertices: [v0, ..., vk], closed }, with
// the free sides running v0 -> v1 -> ... -> vk. If they form a complete hole,
// closed is true and vertices holds each corner once. Null if they don't form
// one unbroken chain.
export function chainFromSides(model, sides) {
    if (sides.length < 2) return null;
    const free = freeSides(model);
    const next = new Map();
    for (const s of sides) {
        const f = model.f[s.face];
        if (!f) return null;
        const a = f[s.side], b = f[(s.side + 1) % f.length];
        if (!free.some(e => e.a === a && e.b === b)) return null;
        if (next.has(a)) return null; // the same side twice, or a fork
        next.set(a, b);
    }
    const targets = new Set(next.values());
    if (targets.size !== next.size) return null;
    const starts = [...next.keys()].filter(a => !targets.has(a));
    if (starts.length > 1) return null;
    const closed = starts.length === 0;
    const start = closed ? [...next.keys()][0] : starts[0];
    const vertices = [start];
    for (let v = next.get(start); v !== undefined && v !== start; v = next.get(v)) vertices.push(v);
    const visited = closed ? vertices.length : vertices.length - 1;
    if (visited !== sides.length) return null; // a separate loop was also selected
    return { vertices, closed };
}

const sinBetween = (u, v) => length(cross(u, v)) / (length(u) * length(v));

// Solves a small square system by Gaussian elimination with pivoting.
function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
        [M[c], M[p]] = [M[p], M[c]];
        if (Math.abs(M[c][c]) < 1e-12) return null;
        for (let r = 0; r < n; r++) {
            if (r === c) continue;
            const f = M[r][c] / M[c][c];
            for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
        }
    }
    return M.map((r, i) => r[n] / r[i]);
}

// Least-squares affine map from 2D points to 2D points, exact for three points.
function fitAffine2D(src, dst) {
    const cx = src.reduce((s, p) => s + p[0], 0) / src.length;
    const cy = src.reduce((s, p) => s + p[1], 0) / src.length;
    const size = Math.max(...src.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
    const norm = p => [(p[0] - cx) / size, (p[1] - cy) / size, 1];
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const bx = [0, 0, 0], by = [0, 0, 0];
    src.forEach((p, k) => {
        const r = norm(p);
        for (let i = 0; i < 3; i++) {
            bx[i] += r[i] * dst[k][0];
            by[i] += r[i] * dst[k][1];
            for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j];
        }
    });
    const ax = solveLinear(A, bx), ay = solveLinear(A, by);
    if (!ax || !ay) return null;
    return p => {
        const r = norm(p);
        return [ax[0] * r[0] + ax[1] * r[1] + ax[2], ay[0] * r[0] + ay[1] * r[1] + ay[2]];
    };
}

// Places a photographed face using a chain of selected sides, instead of an angle.
//   side: the side of `shape` that joins the chain's last side, so corners
//         side, side+1, ... match the chain's vertices from last to first.
// The known corners fix the plane, and an affine fit maps the photo onto it,
// which also removes most of the error from a photo that wasn't square-on. A
// full perspective fit was tested and rejected: on near-square-on photos it
// amplifies corner noise more than perspective costs.
// `check` compares the photo with the known sides, to reveal a bad photo.
export function computePlacementFromChain(model, shape, side, chain, opts = {}) {
    const N = shape.length, k = chain.vertices.length - 1;
    if (N < k + 1) throw new Error('This outline has too few corners for that many selected sides');
    const known = chain.vertices.slice().reverse();
    const cornerOf = j => (side + j) % N;
    const src = known.map((_, j) => shape[cornerOf(j)]);
    const pts = known.map(v => model.pt[v]);

    let photoStraight = true, modelStraight = true;
    for (let j = 1; j < k; j++) {
        const u = [src[j - 1][0] - src[j][0], src[j - 1][1] - src[j][1], 0];
        const v = [src[j + 1][0] - src[j][0], src[j + 1][1] - src[j][1], 0];
        if (sinBetween(u, v) >= MIN_CORNER_SIN) photoStraight = false;
        if (sinBetween(sub(pts[j - 1], pts[j]), sub(pts[j + 1], pts[j])) >= MIN_CORNER_SIN) modelStraight = false;
    }
    if (photoStraight) throw new Error('The corners between those sides are too close to a straight line to fit the photo to them');
    if (modelStraight) throw new Error('The selected sides are too close to a straight line to fit the photo to them');

    const pm = { pt: pts };
    const nrm = faceNormal(pm, pts.map((_, i) => i));
    const origin = faceCentroid(pm, pts.map((_, i) => i));
    const ex = normalize(sub(pts[1], pts[0])), ey = cross(nrm, ex);
    const toPlane = p => {
        const d = sub(p, origin);
        return [dot(d, ex), dot(d, ey)];
    };
    const fit = fitAffine2D(src, pts.map(toPlane));
    if (!fit) throw new Error('Could not fit the photo to the selected sides');

    const positions = shape.map(p => {
        const [x, y] = fit(p);
        return add(add(origin, scale(ex, x)), scale(ey, y));
    });
    const vertex = positions.map(() => null);
    known.forEach((v, j) => {
        vertex[cornerOf(j)] = v;
        positions[cornerOf(j)] = model.pt[v].slice();
    });

    // Photo against model: side length ratios, and the corner angles between them.
    const hypot2 = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
    const ratios = [];
    for (let j = 0; j < k; j++) ratios.push(hypot2(src[j], src[j + 1]) / dist(pts[j], pts[j + 1]));
    const angleAt = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (length(u) * length(v))))) * 180 / Math.PI;
    let angleDiff = 0;
    for (let j = 1; j < k; j++) {
        const pa = angleAt([src[j - 1][0] - src[j][0], src[j - 1][1] - src[j][1], 0], [src[j + 1][0] - src[j][0], src[j + 1][1] - src[j][1], 0]);
        const ma = angleAt(sub(pts[j - 1], pts[j]), sub(pts[j + 1], pts[j]));
        angleDiff = Math.max(angleDiff, Math.abs(pa - ma));
    }
    // How far new corners lie from known ones, in multiples of the shortest known side.
    const shortest = Math.min(...ratios.map((_, j) => hypot2(src[j], src[j + 1])));
    let reach = 0;
    shape.forEach((p, i) => {
        if (vertex[i] !== null) return;
        reach = Math.max(reach, Math.min(...src.map(q => hypot2(p, q))) / shortest);
    });
    const check = {
        ratioDiff: Math.max(...ratios) / Math.min(...ratios) - 1,
        angleDiff,
        reach,
        knownFlatness: faceFlatness(pm, pts.map((_, i) => i)),
    };
    return { positions, vertex, merges: findMerges(model, positions, vertex, opts), check };
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

// Whether a vertex list can become one new face, running through it in reverse.
// It may be a whole hole, or a chain of sides whose ends the new face joins.
function assertFillable(model, loop) {
    const face = loop.slice().reverse();
    const pts = { pt: model.pt };
    // Newell's vector has length of twice the area, so zero means no real shape.
    let nx = 0, ny = 0, nz = 0, perimeter = 0;
    face.forEach((vi, i) => {
        const p = pts.pt[vi], q = pts.pt[face[(i + 1) % face.length]];
        nx += (p[1] - q[1]) * (p[2] + q[2]);
        ny += (p[2] - q[2]) * (p[0] + q[0]);
        nz += (p[0] - q[0]) * (p[1] + q[1]);
        perimeter += dist(p, q);
    });
    if (Math.hypot(nx, ny, nz) < 1e-3 * perimeter * perimeter) {
        throw new Error('These sides are in a straight line, so they cannot form a face');
    }
    const present = new Set();
    model.f.forEach(f => f.forEach((a, i) => present.add(`${a},${f[(i + 1) % f.length]}`)));
    face.forEach((a, i) => {
        if (present.has(`${a},${face[(i + 1) % face.length]}`)) {
            throw new Error('A face across these sides would give an edge three faces, or a face turned inside out');
        }
    });
}

// Flattens after adding a face at `faceIndex`. Only the new face triggers it
// until the shape is closed, so adding a triangle never moves a corner.
export function flattenIfWarped(model, faceIndex, flatTol = 1e-6) {
    const worst = isClosed(model)
        ? Math.max(...model.f.map(f => faceFlatness(model, f)))
        : faceFlatness(model, model.f[faceIndex]);
    if (worst <= flatTol) return { model, maxMove: 0, maxFlatness: worst };
    return flattenFaces(model);
}

// Adds one face across a hole or a chain of sides, flattening if needed.
export function closeLoop(model, loop, opts = {}) {
    assertFillable(model, loop);
    const base = cloneModel(model);
    base.f.push(rotateToConvexStart(base.pt, loop.slice().reverse()));
    return flattenIfWarped(base, base.f.length - 1, opts.flatTolerance);
}

// Fills a hole or chain with triangles, moving no corners (ear clipping).
export function closeLoopTriangulated(model, loop) {
    assertFillable(model, loop);
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
