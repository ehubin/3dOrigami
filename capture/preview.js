// Small wireframe preview: drag to rotate, tap a number to pick a free side.

import { faceNormal, faceCentroid, sub } from './geometry.js';

const TAP_MOVE = 8;  // pixels a pointer can move and still count as a tap
const PICK_RADIUS = 28;

const LABEL_SPACING = 30;

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Where to draw a side's number so it can be tapped: sides lying on top of each
// other would otherwise have numbers in the same place. Moves along the side,
// and two such sides run in opposite directions, so their numbers separate.
export function spreadLabel(x, y, dx, dy, placed) {
    const free = (px, py) => placed.every(l => Math.hypot(l.x - px, l.y - py) >= LABEL_SPACING);
    for (let step = 0; step < 7; step++) {
        const dist = LABEL_SPACING * (step % 2 ? (step + 1) / 2 : -step / 2);
        if (free(x + dx * dist, y + dy * dist)) return [x + dx * dist, y + dy * dist];
    }
    return [x, y];
}

export class Preview {
    constructor(canvas, onPick) {
        this.canvas = canvas;
        this.onPick = onPick;
        this.model = { pt: [], f: [] };
        this.sides = [];
        this.selected = []; // indices into sides
        this.current = -1;
        this.yaw = -0.6;
        this.pitch = 0.75;
        this.labels = [];
        this.drag = null;

        canvas.addEventListener('pointerdown', e => {
            canvas.setPointerCapture(e.pointerId);
            this.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
        });
        canvas.addEventListener('pointermove', e => {
            if (!this.drag) return;
            if (Math.hypot(e.clientX - this.drag.sx, e.clientY - this.drag.sy) > TAP_MOVE) this.drag.moved = true;
            if (this.drag.moved) {
                this.yaw += (e.clientX - this.drag.x) * 0.01;
                this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch + (e.clientY - this.drag.y) * 0.01));
                this.draw();
            }
            this.drag.x = e.clientX;
            this.drag.y = e.clientY;
        });
        const end = e => {
            if (!this.drag) return;
            const wasTap = !this.drag.moved;
            this.drag = null;
            if (wasTap) this._tap(e);
        };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', () => { this.drag = null; });
        new ResizeObserver(() => this.draw()).observe(canvas);
    }

    update(model, sides, selected, current) {
        this.model = model;
        this.sides = sides;
        this.selected = selected;
        this.current = current;
        this.draw();
    }

    _tap(e) {
        const r = this.canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        let best = -1, bestD = PICK_RADIUS;
        this.labels.forEach(l => {
            const d = Math.hypot(l.x - x, l.y - y);
            if (d < bestD) { bestD = d; best = l.index; }
        });
        if (best >= 0) this.onPick(best);
    }

    _rotate([x, y, z]) {
        const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
        return [x1, cp * y - sp * z1, sp * y + cp * z1];
    }

    draw() {
        const { canvas, model } = this;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth, H = canvas.clientHeight;
        if (!W || !H) return;
        if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        this.labels = [];
        if (model.f.length === 0) return;

        const rot = model.pt.map(p => this._rotate(p));
        const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
        rot.forEach(p => {
            min[0] = Math.min(min[0], p[0]); max[0] = Math.max(max[0], p[0]);
            min[1] = Math.min(min[1], p[1]); max[1] = Math.max(max[1], p[1]);
        });
        const margin = 34;
        const k = Math.min((W - 2 * margin) / Math.max(1e-6, max[0] - min[0]), (H - 2 * margin) / Math.max(1e-6, max[1] - min[1]));
        const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
        const scr = p => [W / 2 + (p[0] - cx) * k, H / 2 - (p[1] - cy) * k];

        // Faces from back to front, shaded by how directly they face the viewer.
        const order = model.f.map((f, i) => {
            const c = this._rotate(faceCentroid(model, f));
            return { i, depth: c[2] };
        }).sort((a, b) => a.depth - b.depth);
        const faceColor = css('--face').split(',').map(Number);
        const line = css('--line');
        order.forEach(({ i }) => {
            const f = model.f[i];
            const nrm = this._rotate(faceNormal(model, f));
            const light = 0.55 + 0.45 * Math.abs(nrm[2]);
            const front = nrm[2] > 0;
            ctx.beginPath();
            f.forEach((v, j) => {
                const [x, y] = scr(rot[v]);
                if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
            const c = faceColor.map(v => Math.round(v * light));
            ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${front ? 0.85 : 0.35})`;
            ctx.fill();
            ctx.strokeStyle = line;
            ctx.lineWidth = i === this.current ? 2 : 1;
            ctx.stroke();
        });

        // Free sides, with tappable numbers placed just outside the shape.
        const centre = model.pt.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0])
            .map(v => v / model.pt.length);
        const accent = css('--accent'), free = css('--free');
        canvas.labels = this.labels;
        this.sides.forEach((s, index) => {
            const A = scr(rot[s.a]), B = scr(rot[s.b]);
            const isSel = this.selected.includes(index);
            ctx.beginPath();
            ctx.moveTo(A[0], A[1]);
            ctx.lineTo(B[0], B[1]);
            ctx.strokeStyle = isSel ? accent : free;
            ctx.lineWidth = isSel ? 5 : 2.5;
            ctx.stroke();

            const mid3 = model.pt[s.a].map((v, i) => (v + model.pt[s.b][i]) / 2);
            const out = this._rotate(sub(mid3, centre));
            const len = Math.hypot(out[0], out[1]) || 1;
            const sideLen = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
            const [lx, ly] = spreadLabel(
                (A[0] + B[0]) / 2 + (out[0] / len) * 18,
                (A[1] + B[1]) / 2 - (out[1] / len) * 18,
                (B[0] - A[0]) / sideLen,
                (B[1] - A[1]) / sideLen,
                this.labels,
            );
            this.labels.push({ x: lx, y: ly, index, a: s.a, b: s.b });
            ctx.beginPath();
            ctx.arc(lx, ly, 13, 0, 2 * Math.PI);
            ctx.fillStyle = isSel ? accent : free;
            ctx.fill();
            ctx.fillStyle = css('--on-accent');
            ctx.font = '600 14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(index + 1), lx, ly);
        });
    }
}
