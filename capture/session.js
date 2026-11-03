// Capture session: the model, the raw measurements behind it, undo and export.
// Storage is injected, so this file has no browser dependency.

import {
    emptyModel, cloneModel, pixelsToShape, placeFirstFace, computePlacement, commitPlacement,
    closeLoop, closeLoopTriangulated, modelToExport, computePlacementFromChain, flattenIfWarped,
    stitchSides,
} from './geometry.js';

export const FORMAT_VERSION = 1;

export class Session {
    constructor(store = null) {
        this.store = store;
        this.reset();
    }

    reset() {
        this.name = 'Captured polyhedron';
        this.model = emptyModel();
        // One record per step, in order. Keeping raw measurements lets card
        // photos or a global fit be added later without changing the format.
        this.records = [];
        this.undoStack = [];
        this.nextSide = null; // {face, side}
    }

    get faceCount() { return this.model.f.length; }
    get isEmpty() { return this.model.f.length === 0; }

    _snapshot() {
        this.undoStack.push({
            model: cloneModel(this.model),
            records: this.records.slice(),
            nextSide: this.nextSide,
        });
    }

    undo() {
        const s = this.undoStack.pop();
        if (!s) return false;
        this.model = s.model;
        this.records = s.records;
        this.nextSide = s.nextSide;
        this.save();
        return true;
    }

    addFirstFace({ corners, image, side, lengthCm }) {
        if (!this.isEmpty) throw new Error('The first face is already captured');
        const shape = pixelsToShape(corners);
        this._snapshot();
        this.model = placeFirstFace(shape, side, lengthCm);
        this.records.push({ type: 'first', method: 'parallel', corners, image, side, lengthCm, face: 0 });
        this.nextSide = null;
        this.save();
        return 0;
    }

    // Computes where a face lands, without changing anything.
    previewFace({ corners, side, existing, angleDeg }) {
        return computePlacement(this.model, pixelsToShape(corners), side, existing, angleDeg);
    }

    addFace({ corners, image, side, existing, angleDeg, measuredAngle, concave, placement, acceptedMerges }) {
        const { model, faceIndex } = commitPlacement(this.model, placement, acceptedMerges);
        this._snapshot();
        this.model = model;
        this.records.push({
            type: 'face', method: 'parallel', corners, image, side, existing,
            angleDeg, measuredAngle, concave,
            merges: acceptedMerges.map(m => ({ corner: m.corner, vertex: m.vertex, gap: m.gap })),
            face: faceIndex,
        });
        this.nextSide = null;
        this.save();
        return faceIndex;
    }

    // Where a photographed face lands when fitted to selected sides, without changing anything.
    previewFaceFromChain({ corners, side, chain }) {
        return computePlacementFromChain(this.model, pixelsToShape(corners), side, chain);
    }

    // The known corners rarely lie exactly in one plane, so this flattens the
    // new face afterwards, and returns how far that moved any corner.
    addFaceFromChain({ corners, image, side, chain, placement, acceptedMerges }) {
        const { model, faceIndex } = commitPlacement(this.model, placement, acceptedMerges);
        const flat = flattenIfWarped(model, faceIndex);
        this._snapshot();
        this.model = flat.model;
        this.records.push({
            type: 'faceFromSides', method: 'parallel', corners, image, side, chain,
            check: placement.check,
            merges: acceptedMerges.map(m => ({ corner: m.corner, vertex: m.vertex, gap: m.gap })),
            maxMove: flat.maxMove,
            face: faceIndex,
        });
        this.nextSide = null;
        this.save();
        return flat;
    }

    // Makes two free sides into one. Faces stay in place in the list, so earlier
    // records' face numbers still hold, but vertex numbers change from here on.
    stitch(s1, s2) {
        const res = stitchSides(this.model, s1, s2);
        this._snapshot();
        this.model = res.model;
        this.records.push({ type: 'stitch', sides: [s1, s2], gap: res.gap, maxMove: res.maxMove });
        this.nextSide = null;
        this.save();
        return res;
    }

    // Adds one face across a hole, or across a chain of sides with no measurements.
    close(loop) {
        const res = closeLoop(this.model, loop);
        this._snapshot();
        this.model = res.model;
        this.records.push({
            type: 'close', loop, maxMove: res.maxMove, maxFlatness: res.maxFlatness,
            face: res.model.f.length - 1,
        });
        this.nextSide = null;
        this.save();
        return res;
    }

    closeTriangulated(loop) {
        const model = closeLoopTriangulated(this.model, loop);
        this._snapshot();
        this.model = model;
        this.records.push({ type: 'close', loop, triangulated: true, maxMove: 0, face: model.f.length - 1 });
        this.nextSide = null;
        this.save();
    }

    setNextSide(next) {
        this.nextSide = next;
        this.save();
    }

    toJSON() {
        return {
            version: FORMAT_VERSION,
            name: this.name,
            model: this.model,
            records: this.records,
            nextSide: this.nextSide,
        };
    }

    // What the desktop app imports. It ignores the extra measurements field.
    exportText() {
        return JSON.stringify({ ...modelToExport(this.model, this.name), capture: this.records });
    }

    save() {
        if (this.store) return this.store.save(this.toJSON());
        return undefined;
    }

    async load() {
        if (!this.store) return false;
        const data = await this.store.load();
        if (!data || data.version !== FORMAT_VERSION) return false;
        this.name = data.name;
        this.model = data.model;
        this.records = data.records;
        this.nextSide = data.nextSide;
        this.undoStack = [];
        return true;
    }
}

// Share attempts in the order to try them: .json, then .txt, then message text.
// Browsers restrict shareable file types, so each must be checked on the device.
export function shareAttempts(text, name, FileCtor = globalThis.File) {
    const base = (name || 'polyhedron').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'polyhedron';
    return [
        { files: [new FileCtor([text], `${base}.json`, { type: 'application/json' })], title: name },
        { files: [new FileCtor([text], `${base}.txt`, { type: 'text/plain' })], title: name },
        { text, title: name },
    ];
}

// Tries each attempt the browser accepts. Stops if the user cancels.
export async function shareWithFallback(nav, attempts) {
    if (!nav.share) return 'unsupported';
    for (const data of attempts) {
        if (nav.canShare && !nav.canShare(data)) continue;
        try {
            await nav.share(data);
            return 'shared';
        } catch (e) {
            if (e && e.name === 'AbortError') return 'cancelled';
            // Otherwise, try the next format.
        }
    }
    return 'unsupported';
}

// IndexedDB storage for the session, used in the browser.
export class IdbStore {
    constructor(dbName = 'polyhedron-capture') { this.dbName = dbName; }

    _open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = () => req.result.createObjectStore('session');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async save(value) {
        try {
            const db = await this._open();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('session', 'readwrite');
                tx.objectStore('session').put(value, 'current');
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        } catch (e) {
            console.warn('Could not autosave the capture session', e);
        }
    }

    async load() {
        try {
            const db = await this._open();
            const value = await new Promise((resolve, reject) => {
                const req = db.transaction('session').objectStore('session').get('current');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            db.close();
            return value;
        } catch (e) {
            console.warn('Could not restore the capture session', e);
            return null;
        }
    }
}
