// Tap-to-polygon face detection. Plain JS, with no DOM dependency: takes an
// ImageData-like {data, width, height} and returns corners in image pixels.
//
// It is expected to fail where a face and its surroundings have similar
// shading, so callers must always allow corners to be corrected by hand.

const WORK_SIZE = 800;           // longest side of the working copy, in pixels
const TOLERANCES = [6, 9, 13, 18, 24, 32]; // Lab distances tried, smallest first
const PLATEAU_GROWTH = 1.03;     // area growth below this means the face is filled
const LEAK_GROWTH = 1.8;         // area growth above this means it leaked out
const MIN_AREA = 0.0008;         // smallest region, as a fraction of the image
const DP_EPSILON = 0.012;        // polygon simplification, as a fraction of perimeter

function srgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const LIN = new Float32Array(256).map((_, i) => srgbToLinear(i));
const labF = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

function downscaleToLab(image) {
    const { data, width, height } = image;
    const k = Math.max(1, Math.max(width, height) / WORK_SIZE);
    const w = Math.max(1, Math.round(width / k)), h = Math.max(1, Math.round(height / k));
    const lab = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
        const y0 = Math.floor(y * height / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * height / h));
        for (let x = 0; x < w; x++) {
            const x0 = Math.floor(x * width / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * width / w));
            let r = 0, g = 0, b = 0, n = 0;
            for (let yy = y0; yy < y1; yy++) {
                for (let xx = x0; xx < x1; xx++) {
                    const i = (yy * width + xx) * 4;
                    r += LIN[data[i]]; g += LIN[data[i + 1]]; b += LIN[data[i + 2]];
                    n++;
                }
            }
            r /= n; g /= n; b /= n;
            const X = labF((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505);
            const Y = labF(0.2126 * r + 0.7152 * g + 0.0722 * b);
            const Z = labF((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089);
            const o = (y * w + x) * 3;
            lab[o] = 116 * Y - 16;
            lab[o + 1] = 500 * (X - Y);
            lab[o + 2] = 200 * (Y - Z);
        }
    }
    return { lab, w, h, k: width / w, ky: height / h };
}

function seedColour({ lab, w, h }, sx, sy) {
    let L = 0, a = 0, b = 0, n = 0;
    for (let y = Math.max(0, sy - 3); y <= Math.min(h - 1, sy + 3); y++) {
        for (let x = Math.max(0, sx - 3); x <= Math.min(w - 1, sx + 3); x++) {
            const o = (y * w + x) * 3;
            L += lab[o]; a += lab[o + 1]; b += lab[o + 2]; n++;
        }
    }
    return [L / n, a / n, b / n];
}

// Grows from the seed by distance to the seed colour. Returns the mask, area,
// and whether it reached the image border.
function floodFill({ lab, w, h }, sx, sy, seed, tol) {
    const mask = new Uint8Array(w * h);
    const stack = [sy * w + sx];
    const tol2 = tol * tol;
    mask[stack[0]] = 1;
    let area = 0, border = false;
    while (stack.length) {
        const p = stack.pop();
        area++;
        const x = p % w, y = (p - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
            if (q < 0 || mask[q]) continue;
            const o = q * 3;
            const dL = lab[o] - seed[0], da = lab[o + 1] - seed[1], db = lab[o + 2] - seed[2];
            if (dL * dL + da * da + db * db <= tol2) {
                mask[q] = 1;
                stack.push(q);
            }
        }
    }
    return { mask, area, border };
}

// Fills holes such as reflections or marks inside the face.
function fillHoles(mask, w, h) {
    const outside = new Uint8Array(w * h);
    const stack = [];
    const push = p => { if (!mask[p] && !outside[p]) { outside[p] = 1; stack.push(p); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (stack.length) {
        const p = stack.pop();
        const x = p % w, y = (p - x) / w;
        if (x > 0) push(p - 1);
        if (x < w - 1) push(p + 1);
        if (y > 0) push(p - w);
        if (y < h - 1) push(p + w);
    }
    for (let i = 0; i < mask.length; i++) if (!outside[i]) mask[i] = 1;
}

function morph(mask, w, h, r, keepIfAll) {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let all = true, any = false;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const xx = x + dx, yy = y + dy;
                    const v = xx >= 0 && yy >= 0 && xx < w && yy < h ? mask[yy * w + xx] : 0;
                    if (v) any = true; else all = false;
                }
            }
            out[y * w + x] = (keepIfAll ? all : any) ? 1 : 0;
        }
    }
    return out;
}

function keepComponentAt(mask, w, h, seedP) {
    const out = new Uint8Array(w * h);
    if (!mask[seedP]) return out;
    const stack = [seedP];
    out[seedP] = 1;
    while (stack.length) {
        const p = stack.pop();
        const x = p % w, y = (p - x) / w;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
            if (q >= 0 && mask[q] && !out[q]) { out[q] = 1; stack.push(q); }
        }
    }
    return out;
}

// Moore-neighbour boundary tracing.
function traceBoundary(mask, w, h) {
    const start = mask.indexOf(1);
    if (start < 0) return [];
    const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
    const sx = start % w, sy = (start - sx) / w;
    const contour = [[sx, sy]];
    let x = sx, y = sy, dir = 7;
    const limit = (w + h) * 8;
    for (let n = 0; n < limit; n++) {
        let moved = false;
        for (let i = 0; i < 8; i++) {
            const d = (dir + i) % 8;
            if (at(x + DX[d], y + DY[d])) {
                x += DX[d]; y += DY[d];
                dir = (d + 6) % 8;
                moved = true;
                break;
            }
        }
        if (!moved || (x === sx && y === sy)) break;
        contour.push([x, y]);
    }
    return contour;
}

function pointLineDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / L;
}

function douglasPeucker(points, first, last, eps, keep) {
    const stack = [[first, last]];
    while (stack.length) {
        const [i, j] = stack.pop();
        let best = -1, bestD = eps;
        for (let k = i + 1; k < j; k++) {
            const d = pointLineDist(points[k], points[i], points[j]);
            if (d > bestD) { bestD = d; best = k; }
        }
        if (best >= 0) {
            keep.add(best);
            stack.push([i, best], [best, j]);
        }
    }
}

// Returns contour indices of the polygon's corners, in contour order.
function simplifyClosed(contour, eps) {
    const n = contour.length;
    let far = 0, farD = -1;
    for (let i = 1; i < n; i++) {
        const d = Math.hypot(contour[i][0] - contour[0][0], contour[i][1] - contour[0][1]);
        if (d > farD) { farD = d; far = i; }
    }
    const ring = contour.concat([contour[0]]);
    const keep = new Set([0, far]);
    douglasPeucker(ring, 0, far, eps, keep);
    douglasPeucker(ring, far, n, eps, keep);
    keep.delete(n);
    return [...keep].sort((a, b) => a - b);
}

// Bilinear brightness. A pixel's centre is at +0.5 in image coordinates.
function luminanceAt(image, x, y) {
    const { data, width, height } = image;
    const fx = Math.max(0, Math.min(width - 1.001, x - 0.5));
    const fy = Math.max(0, Math.min(height - 1.001, y - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const lum = (xx, yy) => {
        const i = (yy * width + xx) * 4;
        return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    };
    const top = lum(x0, y0) * (1 - tx) + lum(x0 + 1, y0) * tx;
    const bottom = lum(x0, y0 + 1) * (1 - tx) + lum(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
}

// Total least squares line through points, as {c: centre, d: unit direction}.
function fitLine(pts) {
    let cx = 0, cy = 0;
    pts.forEach(p => { cx += p[0]; cy += p[1]; });
    cx /= pts.length; cy /= pts.length;
    let xx = 0, xy = 0, yy = 0;
    pts.forEach(p => {
        const dx = p[0] - cx, dy = p[1] - cy;
        xx += dx * dx; xy += dx * dy; yy += dy * dy;
    });
    const th = 0.5 * Math.atan2(2 * xy, xx - yy);
    return { c: [cx, cy], d: [Math.cos(th), Math.sin(th)] };
}

// Refines a side at full resolution: along the side, finds the strongest
// brightness step across it, then fits a line, dropping outliers once.
function refineSide(image, a, b, searchPx) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 8) return null;
    const t = [dx / L, dy / L], nrm = [-t[1], t[0]];
    const samples = Math.min(60, Math.max(8, Math.round(L / 4)));
    const pts = [];
    for (let s = 0; s < samples; s++) {
        // The middle of the side, avoiding the corners, which may be rounded.
        const u = 0.15 + 0.7 * (s + 0.5) / samples;
        const px = a[0] + dx * u, py = a[1] + dy * u;
        let bestG = 0, bestO = null;
        const profile = [];
        for (let o = -searchPx; o <= searchPx; o++) {
            profile.push(luminanceAt(image, px + nrm[0] * o, py + nrm[1] * o));
        }
        for (let i = 1; i < profile.length - 1; i++) {
            const g = Math.abs(profile[i + 1] - profile[i - 1]);
            if (g > bestG) { bestG = g; bestO = i; }
        }
        if (bestO === null || bestG < 6) continue;
        // Parabolic peak of the gradient, for sub-pixel position.
        let off = bestO;
        if (bestO > 1 && bestO < profile.length - 2) {
            const gm = Math.abs(profile[bestO] - profile[bestO - 2]);
            const gp = Math.abs(profile[bestO + 2] - profile[bestO]);
            const den = gm - 2 * bestG + gp;
            if (den < 0) off += 0.5 * (gm - gp) / den;
        }
        const o = off - searchPx;
        pts.push([px + nrm[0] * o, py + nrm[1] * o]);
    }
    if (pts.length < 5) return null;
    let line = fitLine(pts);
    const residual = p => Math.abs((p[0] - line.c[0]) * line.d[1] - (p[1] - line.c[1]) * line.d[0]);
    const sorted = pts.map(residual).sort((x, y) => x - y);
    const cutoff = Math.max(1, 2.5 * sorted[Math.floor(sorted.length / 2)]);
    const inliers = pts.filter(p => residual(p) <= cutoff);
    if (inliers.length >= 5) line = fitLine(inliers);
    return line;
}

function intersect(l1, l2) {
    const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
    if (Math.abs(den) < 0.05) return null; // nearly parallel
    const dx = l2.c[0] - l1.c[0], dy = l2.c[1] - l1.c[1];
    const t = (dx * l2.d[1] - dy * l2.d[0]) / den;
    return [l1.c[0] + t * l1.d[0], l1.c[1] + t * l1.d[1]];
}

// Grows from the tap with rising tolerance. A face shows up as a plateau: once
// the region fills it, a higher tolerance adds almost nothing, until it jumps
// into the next surface. So this takes the first plateau, or failing that (for
// example on a shaded face) the last region before a large jump.
function growRegion(work, sx, sy) {
    const seed = seedColour(work, sx, sy);
    const minArea = MIN_AREA * work.w * work.h;
    let prev = null;
    for (const tol of TOLERANCES) {
        const r = floodFill(work, sx, sy, seed, tol);
        if (r.border) break;
        if (prev && prev.area >= minArea) {
            if (r.area <= prev.area * PLATEAU_GROWTH) return prev;
            if (r.area > prev.area * LEAK_GROWTH) return prev;
        }
        prev = r;
    }
    return prev && prev.area >= minArea ? prev : null;
}

export function detectPolygon(image, tapX, tapY) {
    const work = downscaleToLab(image);
    const { w, h, k, ky } = work;
    const sx = Math.max(0, Math.min(w - 1, Math.round(tapX / k)));
    const sy = Math.max(0, Math.min(h - 1, Math.round(tapY / ky)));

    const region = growRegion(work, sx, sy);
    if (!region) return null;

    let mask = region.mask;
    fillHoles(mask, w, h);
    mask = morph(morph(mask, w, h, 2, true), w, h, 2, false); // remove thin tendrils
    mask = keepComponentAt(mask, w, h, sy * w + sx);
    const contour = traceBoundary(mask, w, h);
    if (contour.length < 12) return null;

    let perimeter = 0;
    contour.forEach((p, i) => {
        const q = contour[(i + 1) % contour.length];
        perimeter += Math.hypot(q[0] - p[0], q[1] - p[1]);
    });
    const eps = Math.max(2, DP_EPSILON * perimeter);
    const idx = simplifyClosed(contour, eps);
    if (idx.length < 3) return null;

    const coarse = idx.map(i => [(contour[i][0] + 0.5) * k, (contour[i][1] + 0.5) * ky]);
    const n = coarse.length;

    // Sub-pixel corners, by intersecting lines refined at full resolution.
    const searchPx = Math.max(5, Math.ceil(5 * k));
    const lines = coarse.map((a, i) => refineSide(image, a, coarse[(i + 1) % n], searchPx));
    const sideLen = i => {
        const a = coarse[i], b = coarse[(i + 1) % n];
        return Math.hypot(b[0] - a[0], b[1] - a[1]);
    };
    const corners = coarse.map((c, i) => {
        const before = lines[(i + n - 1) % n], after = lines[i];
        if (!before || !after) return c;
        const p = intersect(before, after);
        // Cleaning up the region blunts sharp tips, so a corner may move a fair
        // way out, but never by more than a fraction of its sides.
        const limit = Math.max(4 * k, 0.25 * Math.min(sideLen(i), sideLen((i + n - 1) % n)));
        if (!p || Math.hypot(p[0] - c[0], p[1] - c[1]) > limit) return c;
        return p;
    });
    return { corners };
}
