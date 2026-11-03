// Phone capture screen: the shape so far, then a photo editor for each new face.

import {
    freeSides, freeLoops, closeLoop, isClosed, faceFlatness,
    orderPixelCorners, isSimplePolygon, chainFromSides, stitchSides,
} from './geometry.js';
import { Session, IdbStore, shareAttempts, shareWithFallback } from './session.js';
import { Preview } from './preview.js';
import { detectPolygon } from './detect.js';
import { loadPhoto } from './photo.js';

const $ = id => document.getElementById(id);

const FLATTEN_WARN_CM = 0.1;   // offer triangles if flattening moves a corner further
const HANDLE_RADIUS = 26;      // screen pixels within which a corner can be grabbed
const SIDE_PICK_RADIUS = 30;
const TAP_MOVE = 8;
const CHECK_RATIO_WARN = 0.05; // photo vs selected sides: length ratio difference worth flagging
const CHECK_ANGLE_WARN = 3;    // degrees
const CHECK_RATIO_NOTE = 0.01;
const CHECK_ANGLE_NOTE = 1;
const CHECK_REACH_WARN = 2;    // how far new corners lie from known ones, in shortest known sides

const mm = cm => `${(cm * 10).toFixed(1)} mm`;
const parseNumber = s => parseFloat(String(s).replace(',', '.')); // phones may type a decimal comma

const session = new Session(new IdbStore());

// ------------------------------------------------------------------- dialogs

// Shows a dialog and resolves with the value of the button pressed.
function showDialog({ title, text, body, buttons }) {
    const dlg = $('dialog');
    dlg.replaceChildren();
    const h = document.createElement('h2');
    h.textContent = title;
    dlg.append(h);
    if (text) {
        const p = document.createElement('p');
        p.textContent = text;
        dlg.append(p);
    }
    if (body) dlg.append(body);
    const actions = document.createElement('div');
    actions.className = 'dlgActions';
    dlg.append(actions);
    return new Promise(resolve => {
        const finish = v => {
            dlg.removeEventListener('cancel', onCancel);
            dlg.close();
            resolve(v);
        };
        const onCancel = e => { e.preventDefault(); finish(null); };
        dlg.addEventListener('cancel', onCancel);
        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn' + (b.primary ? ' primary' : '');
            btn.textContent = b.label;
            btn.addEventListener('click', () => {
                if (b.action) b.action(); else finish(b.value);
            });
            actions.append(btn);
        });
        dlg.showModal();
    });
}

const alertDialog = (title, text) => showDialog({ title, text, buttons: [{ label: 'OK', value: true, primary: true }] });

// -------------------------------------------------------------- model screen

// Selecting several sides, to join a new face to all of them at once. The first
// is session.nextSide; these are the others.
let selecting = false;
let extraSides = [];

const sameSide = (p, q) => !!p && !!q && p.face === q.face && p.side === q.side;

function clearSelection() {
    selecting = false;
    extraSides = [];
}

// The selected sides as an unbroken chain, or null.
function selectedChain() {
    if (extraSides.length === 0 || !session.nextSide) return null;
    return chainFromSides(session.model, [session.nextSide, ...extraSides]);
}

function toggleSelected(ref) {
    if (sameSide(ref, session.nextSide)) {
        // The first side can only go if another can take its place.
        if (extraSides.length) session.setNextSide(extraSides.shift());
    } else if (extraSides.some(s => sameSide(s, ref))) {
        extraSides = extraSides.filter(s => !sameSide(s, ref));
    } else {
        extraSides.push(ref);
    }
}

const preview = new Preview($('preview'), index => {
    const s = orderedSides()[index];
    if (!s) return;
    const ref = { face: s.face, side: s.side };
    if (selecting) {
        toggleSelected(ref);
    } else {
        session.setNextSide(ref);
    }
    renderModel();
});

function currentFace() {
    for (let i = session.records.length - 1; i >= 0; i--) {
        if (session.records[i].face !== undefined) return session.records[i].face;
    }
    return -1;
}

// Free sides, with the most recent face's sides first so they get low numbers.
function orderedSides() {
    const cur = currentFace();
    const sides = freeSides(session.model);
    return [...sides.filter(s => s.face === cur), ...sides.filter(s => s.face !== cur)];
}

function setStatus(text, warn = false) {
    const s = $('status');
    s.textContent = text;
    s.classList.toggle('warn', warn);
}

function renderModel(note) {
    const sides = orderedSides();
    let selected = sides.findIndex(s => session.nextSide
        && s.face === session.nextSide.face && s.side === session.nextSide.side);
    if (selected < 0 && sides.length) {
        selected = 0;
        session.setNextSide({ face: sides[0].face, side: sides[0].side });
    }
    extraSides = extraSides.filter(e => sides.some(s => sameSide(s, e)));
    const extras = extraSides.map(e => sides.findIndex(s => sameSide(s, e)));
    const chain = selectedChain();
    const broken = extraSides.length > 0 && !chain;
    const known = extraSides.length + 1;
    const numbers = [selected, ...extras].map(i => i + 1).sort((p, q) => p - q).join(', ');
    preview.update(session.model, sides, [selected, ...extras].filter(i => i >= 0), currentFace());

    const empty = session.isEmpty;
    const closed = isClosed(session.model);
    // A photo needs one side or an open chain: a complete hole has nothing to measure.
    const noPhoto = closed || broken || (selecting && known === 1) || !!(chain && chain.closed);
    $('emptyState').hidden = !empty;
    $('nameInput').value = session.name;
    $('undoBtn').disabled = session.undoStack.length === 0;
    $('closeBtn').disabled = empty || closed;
    $('shareBtn').disabled = empty;
    $('newBtn').disabled = empty;
    $('takeBtn').classList.toggle('disabled', noPhoto);
    $('galleryBtn').classList.toggle('disabled', noPhoto);
    $('fillBtn').hidden = !chain;
    if (chain) {
        const corners = chain.vertices.length;
        $('fillBtn').textContent = chain.closed ? 'Fill hole' : corners === 3 ? 'Add triangle' : `Add ${corners}-sided face`;
    }
    $('stitchBtn').hidden = known !== 2;
    $('selectBtn').disabled = sides.length < 2;
    $('selectBtn').textContent = selecting ? 'Cancel selection' : 'Select sides';

    if (note) {
        setStatus(note.text, note.warn);
    } else if (empty) {
        setStatus('');
    } else if (closed) {
        setStatus(`Closed shape with ${session.faceCount} faces. Ready to export.`);
    } else if (selecting && known === 1) {
        setStatus(`Side ${selected + 1} selected. Tap the other sides of the new face.`);
    } else if (broken && known === 2) {
        setStatus(`Sides ${numbers} selected. Stitch them if they should be one side, or tap another number to add to the selection.`);
    } else if (broken) {
        setStatus(`Sides ${numbers} don't join end to end. Tap a number to add or remove a side.`, true);
    } else if (chain && chain.closed) {
        setStatus(`Sides ${numbers} make a complete hole. Fill it with one face.`);
    } else if (chain) {
        const button = $('fillBtn').textContent;
        const stitch = known === 2 ? ' Or stitch them if they should be one side.' : '';
        setStatus(`Sides ${numbers} selected. Use ${button} if only one side is missing, or take a photo if more are. No angle needed.${stitch}`);
    } else {
        setStatus(`Tap a number to choose where the next face attaches. Selected: side ${selected + 1}.`);
    }
}

$('selectBtn').addEventListener('click', () => {
    if (selecting) clearSelection();
    else selecting = true;
    renderModel();
});

$('fillBtn').addEventListener('click', () => {
    const chain = selectedChain();
    if (chain) fillAcross(chain.vertices);
});

$('stitchBtn').addEventListener('click', async () => {
    if (extraSides.length !== 1 || !session.nextSide) return;
    const [s1, s2] = [session.nextSide, extraSides[0]];
    try {
        const trial = stitchSides(session.model, s1, s2);
        if (trial.maxMove > FLATTEN_WARN_CM) {
            const ok = await showDialog({
                title: 'Stitch these sides?',
                text: `The sides are up to ${mm(trial.gap)} apart, so stitching moves corners by up to ${mm(trial.maxMove)}. If that is more than you expected, check that these are the right sides.`,
                buttons: [
                    { label: 'Stitch', value: true, primary: true },
                    { label: 'Cancel', value: false },
                ],
            });
            if (!ok) return;
        }
        const res = session.stitch(s1, s2);
        clearSelection();
        const moved = res.maxMove > 0.005 ? ` Corners moved by up to ${mm(res.maxMove)}.` : '';
        renderModel({
            text: `Sides stitched.${moved}${flatnessNote()}`,
            warn: res.maxMove > FLATTEN_WARN_CM,
        });
    } catch (err) {
        await alertDialog('Could not stitch these sides', err.message);
    }
});

function flatnessNote() {
    const worst = Math.max(0, ...session.model.f.map(f => faceFlatness(session.model, f)));
    return worst > 0.005 ? ` Least flat face is off by ${mm(worst)}.` : '';
}

$('nameInput').addEventListener('change', e => {
    session.name = e.target.value.trim() || 'Captured polyhedron';
    session.save();
});

$('undoBtn').addEventListener('click', () => {
    session.undo();
    clearSelection();
    renderModel();
});

$('newBtn').addEventListener('click', async () => {
    const ok = await showDialog({
        title: 'Start a new shape?',
        text: 'This discards the current shape. Export it first if you want to keep it.',
        buttons: [{ label: 'Discard and start new', value: true }, { label: 'Keep working', value: false, primary: true }],
    });
    if (ok) {
        session.reset();
        session.save();
        clearSelection();
        renderModel();
    }
});

$('closeBtn').addEventListener('click', async () => {
    const loops = freeLoops(session.model);
    if (loops.length === 0) {
        await alertDialog('Nothing to close', 'There is no hole that a single face can fill yet. Capture more faces, or merge corners when placing them.');
        return;
    }
    let loop = loops[0];
    if (loops.length > 1) {
        const pick = await showDialog({
            title: 'Which hole?',
            buttons: [
                ...loops.map((l, i) => ({ label: `Hole ${i + 1} (${l.length} sides)`, value: i })),
                { label: 'Cancel', value: null },
            ],
        });
        if (pick === null) return;
        loop = loops[pick];
    }
    await fillAcross(loop);
});

// Adds one face across a hole or chain, asking first if that would move corners.
async function fillAcross(loop) {
    try {
        const trial = closeLoop(session.model, loop);
        if (trial.maxMove > FLATTEN_WARN_CM) {
            const how = await showDialog({
                title: 'These sides are not flat',
                text: `Keeping one flat face would move a corner by up to ${mm(trial.maxMove)}. Splitting it into triangles moves nothing, but adds fold lines.`,
                buttons: [
                    { label: 'Keep one face, move corners', value: 'flat', primary: true },
                    { label: 'Split into triangles', value: 'tri' },
                    { label: 'Cancel', value: null },
                ],
            });
            if (!how) return;
            if (how === 'tri') {
                session.closeTriangulated(loop);
                clearSelection();
                renderModel();
                return;
            }
        }
        const res = session.close(loop);
        clearSelection();
        const moved = res.maxMove > 0.001 ? ` Corners moved by up to ${mm(res.maxMove)}.` : '';
        if (isClosed(session.model)) {
            renderModel({ text: `Closed shape with ${session.faceCount} faces.${moved}${flatnessNote()}` });
        } else {
            renderModel(moved ? { text: `Face added.${moved}` } : undefined);
        }
    } catch (err) {
        await alertDialog('Could not add the face', err.message);
    }
}

// Share first, then copy and download, which work everywhere.
$('shareBtn').addEventListener('click', () => {
    const text = session.exportText();
    const open = !isClosed(session.model);
    showDialog({
        title: 'Export shape',
        text: `${session.faceCount} faces${open ? ', not closed yet' : ''}.${flatnessNote()} On the desktop app, paste the content into the Import dialog.`,
        buttons: [
            {
                label: 'Share (WhatsApp and others)', primary: true,
                action: async () => {
                    const r = await shareWithFallback(navigator, shareAttempts(text, session.name));
                    if (r === 'unsupported') {
                        $('dialog').querySelector('p').textContent = 'Sharing is not available here. Use Copy or Download instead.';
                    } else if (r === 'shared') {
                        $('dialog').close();
                    }
                },
            },
            {
                label: 'Copy to clipboard',
                action: async () => {
                    try {
                        await navigator.clipboard.writeText(text);
                        $('dialog').querySelector('p').textContent = 'Copied. Paste it into the desktop Import dialog.';
                    } catch {
                        $('dialog').querySelector('p').textContent = 'Copying was blocked here. Use Share or Download instead.';
                    }
                },
            },
            {
                label: 'Download file',
                action: () => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
                    a.download = shareAttempts(text, session.name)[0].files[0].name;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
                },
            },
            { label: 'Done', value: true },
        ],
    });
});

// -------------------------------------------------------------- photo screen

let ph = null; // state of the photo being worked on

const photoCanvas = $('photo');

for (const id of ['cameraInput', 'galleryInput']) {
    $(id).addEventListener('change', async e => {
        const file = e.target.files[0];
        e.target.value = ''; // lets the same file be picked again
        if (!file) return;
        try {
            startPhoto(await loadPhoto(file));
        } catch (err) {
            await alertDialog('Could not open the photo', err.message);
        }
    });
}

function startPhoto(image) {
    ph = {
        image,
        imageData: null,
        corners: [],
        selectedCorner: -1,
        manual: false,
        stage: 'outline',
        joinSide: null,
        chain: selectedChain(), // set when joining to several sides, so no angle is needed
        joinSides: [],
        view: { k: 1, ox: 0, oy: 0 },
        fitted: false,
        magnify: null,
        message: null,
    };
    $('modelScreen').hidden = true;
    $('photoScreen').hidden = false;
    $('lengthInput').value = '';
    $('angleInput').value = '';
    document.querySelector('input[name=edgeType][value=convex]').checked = true;
    renderPhoto();
}

function leavePhoto() {
    ph = null;
    $('photoScreen').hidden = true;
    $('modelScreen').hidden = false;
    renderModel();
}

function setBar(buttons) {
    const bar = $('photoBar');
    bar.replaceChildren();
    buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn' + (b.primary ? ' primary' : '');
        btn.textContent = b.label;
        btn.disabled = !!b.disabled;
        btn.addEventListener('click', b.onClick);
        bar.append(btn);
    });
}

function setHint(text, warn = false) {
    const h = $('photoHint');
    h.textContent = text;
    h.classList.toggle('warn', warn);
}

function renderPhoto() {
    if (!ph) return;
    if (ph.stage === 'outline') {
        $('joinForm').hidden = true;
        const n = ph.corners.length;
        if (ph.message) setHint(ph.message.text, ph.message.warn);
        else if (ph.manual) setHint(n < 3 ? 'Tap each corner of the face.' : 'Tap to add a corner, or drag one to adjust it. Pinch to zoom.');
        else if (n === 0) setHint('Tap the face. Pinch to zoom.');
        else setHint('Check the outline: drag any corner that is wrong. Pinch to zoom.');
        setBar([
            { label: 'Cancel', onClick: leavePhoto },
            n > 0
                ? { label: 'Clear', onClick: () => { Object.assign(ph, { corners: [], selectedCorner: -1, message: null }); renderPhoto(); } }
                : { label: ph.manual ? 'Auto-detect' : 'Place by hand', onClick: () => { ph.manual = !ph.manual; ph.message = null; renderPhoto(); } },
            n > 0 && !ph.manual ? { label: 'Add corner', onClick: () => { ph.manual = true; ph.message = null; renderPhoto(); } } : null,
            ph.selectedCorner >= 0 ? { label: 'Delete corner', onClick: deleteCorner } : null,
            { label: 'Next', primary: true, disabled: n < 3, onClick: outlineDone },
        ].filter(Boolean));
    } else {
        renderJoin();
    }
    drawPhoto();
}

function deleteCorner() {
    ph.corners.splice(ph.selectedCorner, 1);
    ph.selectedCorner = -1;
    renderPhoto();
}

function outlineDone() {
    if (!isSimplePolygon(ph.corners)) {
        ph.message = { text: 'The outline crosses itself. Move the corners so that it does not.', warn: true };
        renderPhoto();
        return;
    }
    ph.corners = orderPixelCorners(ph.corners);
    ph.stage = 'join';
    ph.manual = false;
    ph.selectedCorner = -1;
    ph.message = null;
    ph.joinSide = null;
    ph.joinSides = [];
    renderPhoto();
}

const isJoinSide = i => (ph.chain ? ph.joinSides.includes(i) : ph.joinSide === i);
const chainSideCount = () => ph.chain.vertices.length - 1;

function pickJoinSide(i) {
    ph.message = null;
    if (!ph.chain) {
        ph.joinSide = i;
    } else if (ph.joinSides.includes(i)) {
        ph.joinSides = ph.joinSides.filter(s => s !== i);
    } else {
        ph.joinSides.push(i);
        if (ph.joinSides.length > chainSideCount()) ph.joinSides.shift();
    }
    renderPhoto();
}

// The first of the picked photo sides, if they run in an unbroken row, or null.
// Winding then decides which photo side matches which selected side.
function firstOfPickedSides() {
    const k = chainSideCount();
    const n = ph.corners.length;
    if (ph.joinSides.length !== k || k >= n) return null;
    for (const start of ph.joinSides) {
        let inRow = true;
        for (let j = 1; j < k; j++) {
            if (!ph.joinSides.includes((start + j) % n)) inRow = false;
        }
        if (inRow) return start;
    }
    return null;
}

function renderJoin() {
    const first = session.isEmpty;
    $('joinForm').hidden = false;
    $('lengthRow').hidden = !first;
    $('angleRow').hidden = first || !!ph.chain;
    $('joinLabel').textContent = ph.chain ? 'Shared sides' : 'Shared side';
    const pairTogether = ph.chain ? firstOfPickedSides() !== null : false;
    if (ph.message) {
        setHint(ph.message.text, ph.message.warn);
    } else if (ph.chain) {
        const k = chainSideCount();
        if (k >= ph.corners.length) {
            setHint(`This outline has ${ph.corners.length} sides, too few to join ${k} selected sides and leave one open. Go back and check it.`, true);
        } else if (ph.joinSides.length === k && !pairTogether) {
            setHint(`Those sides aren't next to each other. Pick ${k} sides in a row.`, true);
        } else {
            setHint(`Pick the ${k} sides of this face that join the selected sides, in a row.`);
        }
    } else if (first) {
        setHint('Pick a side you can measure, then type its real length.');
    } else {
        setHint(`Pick the side of this face that joins side ${selectedSideNumber()} of the shape.`);
    }

    const chips = $('sideChips');
    chips.replaceChildren();
    ph.corners.forEach((_, i) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'chip' + (isJoinSide(i) ? ' on' : '');
        c.textContent = String(i + 1);
        c.addEventListener('click', () => pickJoinSide(i));
        chips.append(c);
    });

    setBar([
        { label: 'Back', onClick: () => { ph.stage = 'outline'; ph.message = null; renderPhoto(); } },
        {
            label: first ? 'Add first face' : 'Place face',
            primary: true,
            disabled: ph.chain ? !pairTogether : ph.joinSide === null,
            onClick: placeFace,
        },
    ]);
}

// What the comparison between the photo and the selected sides found, if notable.
function checkNote(check) {
    const parts = [];
    const warnMatch = check.ratioDiff > CHECK_RATIO_WARN || check.angleDiff > CHECK_ANGLE_WARN;
    if (check.ratioDiff > CHECK_RATIO_NOTE || check.angleDiff > CHECK_ANGLE_NOTE) {
        parts.push(`The photo differs from the selected sides by ${(check.ratioDiff * 100).toFixed(1)}% in length ratio and ${check.angleDiff.toFixed(1)}° in angle.`);
        if (warnMatch) parts.push('Check you picked the right sides and that the photo was close to square-on.');
    }
    const warnReach = check.reach > CHECK_REACH_WARN;
    if (warnReach) parts.push('The far corners are less certain, because the selected sides are short compared with this face.');
    return parts.length ? { text: parts.join(' '), warn: warnMatch || warnReach } : null;
}

async function placeFaceFromChain(corners, image) {
    const args = { corners, side: firstOfPickedSides(), chain: ph.chain };
    const placement = session.previewFaceFromChain(args);
    const accepted = await confirmMerges(placement);
    if (accepted === null) return;
    const flat = session.addFaceFromChain({ ...args, image, placement, acceptedMerges: accepted });
    clearSelection();
    leavePhoto();
    const note = checkNote(placement.check);
    const moved = flat.maxMove > 0.005 ? `Corners moved by up to ${mm(flat.maxMove)} to keep the face flat.` : '';
    if (note || moved) {
        renderModel({
            text: [note && note.text, moved].filter(Boolean).join(' '),
            warn: (note && note.warn) || flat.maxMove > FLATTEN_WARN_CM,
        });
    }
}

function selectedSideNumber() {
    const sides = orderedSides();
    return sides.findIndex(s => session.nextSide && s.face === session.nextSide.face && s.side === session.nextSide.side) + 1;
}

async function placeFace() {
    const image = { w: ph.image.width, h: ph.image.height };
    const corners = ph.corners.map(c => c.slice());
    try {
        if (ph.chain) {
            await placeFaceFromChain(corners, image);
            return;
        }
        if (session.isEmpty) {
            const lengthCm = parseNumber($('lengthInput').value);
            if (!(lengthCm > 0)) {
                ph.message = { text: 'Type the real length of the selected side, in cm.', warn: true };
                renderPhoto();
                return;
            }
            session.addFirstFace({ corners, image, side: ph.joinSide, lengthCm });
            leavePhoto();
            return;
        }

        const measured = parseNumber($('angleInput').value);
        if (!(measured > 0 && measured <= 180)) {
            ph.message = { text: 'Type the inclinometer angle, between 0 and 180°.', warn: true };
            renderPhoto();
            return;
        }
        const concave = document.querySelector('input[name=edgeType]:checked').value === 'concave';
        const angleDeg = concave ? 360 - measured : measured;
        const args = { corners, side: ph.joinSide, existing: session.nextSide, angleDeg };
        const placement = session.previewFace(args);
        const accepted = await confirmMerges(placement);
        if (accepted === null) return;
        session.addFace({ ...args, image, measuredAngle: measured, concave, placement, acceptedMerges: accepted });
        const gap = accepted.length ? Math.max(...accepted.map(m => m.gap)) : 0;
        leavePhoto();
        if (gap > 0.005) {
            renderModel({ text: `Face placed and joined to existing corners, with a gap of up to ${mm(gap)}.${flatnessNote()}`, warn: gap > 0.2 });
        }
    } catch (err) {
        ph.message = { text: err.message, warn: true };
        renderPhoto();
    }
}

// Asks which nearby corners to join. Resolves with the accepted list, or null.
function confirmMerges(placement) {
    if (placement.merges.length === 0) return Promise.resolve([]);
    const list = document.createElement('div');
    const boxes = placement.merges.map(m => {
        const row = document.createElement('label');
        row.className = 'check';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = true;
        const text = document.createElement('span');
        text.textContent = `Corner between sides ${((m.corner + placement.positions.length - 1) % placement.positions.length) + 1} and ${m.corner + 1}: gap ${mm(m.gap)}`;
        row.append(box, text);
        list.append(row);
        return box;
    });
    return showDialog({
        title: 'Join to existing corners?',
        text: 'These corners land close to corners already in the shape. Joining keeps the existing positions.',
        body: list,
        buttons: [{ label: 'Continue', value: true, primary: true }, { label: 'Cancel', value: false }],
    }).then(ok => (ok ? placement.merges.filter((_, i) => boxes[i].checked) : null));
}

// ----------------------------------------------------------- photo interaction

const toScreen = ([x, y]) => [x * ph.view.k + ph.view.ox, y * ph.view.k + ph.view.oy];
const toImage = (x, y) => [(x - ph.view.ox) / ph.view.k, (y - ph.view.oy) / ph.view.k];

function fitView() {
    const W = photoCanvas.clientWidth, H = photoCanvas.clientHeight;
    if (!W || !H) return;
    const k = Math.min(W / ph.image.width, H / ph.image.height);
    ph.view = { k, ox: (W - ph.image.width * k) / 2, oy: (H - ph.image.height * k) / 2 };
    ph.fitted = true;
}

function sideMid(i) {
    const a = ph.corners[i], b = ph.corners[(i + 1) % ph.corners.length];
    return toScreen([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
}

function drawPhoto() {
    if (!ph) return;
    const W = photoCanvas.clientWidth, H = photoCanvas.clientHeight;
    if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    if (photoCanvas.width !== Math.round(W * dpr) || photoCanvas.height !== Math.round(H * dpr)) {
        photoCanvas.width = Math.round(W * dpr);
        photoCanvas.height = Math.round(H * dpr);
        ph.fitted = false;
    }
    if (!ph.fitted) fitView();
    const ctx = photoCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = ph.view.k < 2;
    ctx.drawImage(ph.image, ph.view.ox, ph.view.oy, ph.image.width * ph.view.k, ph.image.height * ph.view.k);

    const n = ph.corners.length;
    const pts = ph.corners.map(toScreen);
    if (n >= 2) {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        if (n >= 3) ctx.closePath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#35c37d';
        ctx.stroke();
    }
    if (ph.stage === 'join') {
        for (let i = 0; i < n; i++) {
            if (!isJoinSide(i)) continue;
            const a = pts[i], b = pts[(i + 1) % n];
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#f0a33a';
            ctx.stroke();
        }
    }
    pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p[0], p[1], ph.stage === 'outline' ? 9 : 5, 0, 2 * Math.PI);
        ctx.fillStyle = i === ph.selectedCorner ? 'rgba(240,163,58,0.75)' : 'rgba(53,195,125,0.45)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    });
    if (n >= 3) {
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < n; i++) {
            const [x, y] = sideMid(i);
            const on = ph.stage === 'join' && isJoinSide(i);
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, 2 * Math.PI);
            ctx.fillStyle = on ? '#f0a33a' : '#1b1f24';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            ctx.fillStyle = on ? '#0c1712' : '#fff';
            ctx.fillText(String(i + 1), x, y);
        }
    }
    if (ph.magnify !== null && pts[ph.magnify]) drawMagnifier(ctx, pts[ph.magnify], ph.corners[ph.magnify], W);
}

// Shows the area under the finger, in the corner away from it.
function drawMagnifier(ctx, screenPt, imagePt, W) {
    const R = 64, zoom = 4;
    const cx = screenPt[0] < W / 2 ? W - R - 10 : R + 10, cy = R + 10;
    const k = ph.view.k * zoom;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.clip();
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ph.image, cx - imagePt[0] * k, cy - imagePt[1] * k, ph.image.width * k, ph.image.height * k);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy + 12);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
}

const pointers = new Map();
let gesture = null;

function localPoint(e) {
    const r = photoCanvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
}

function nearestCorner(x, y) {
    let best = -1, bestD = HANDLE_RADIUS;
    ph.corners.forEach((c, i) => {
        const [sx, sy] = toScreen(c);
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) { bestD = d; best = i; }
    });
    return best;
}

photoCanvas.addEventListener('pointerdown', e => {
    if (!ph) return;
    photoCanvas.setPointerCapture(e.pointerId);
    const p = localPoint(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        gesture = {
            type: 'pinch',
            dist: Math.hypot(a[0] - b[0], a[1] - b[1]),
            mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        };
        ph.magnify = null;
        drawPhoto();
        return;
    }
    const handle = ph.stage === 'outline' ? nearestCorner(p[0], p[1]) : -1;
    gesture = { type: 'pending', start: p, last: p, handle };
});

photoCanvas.addEventListener('pointermove', e => {
    if (!ph || !pointers.has(e.pointerId) || !gesture) return;
    const p = localPoint(e);
    pointers.set(e.pointerId, p);

    if (gesture.type === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        zoomAt(gesture.mid, d / gesture.dist);
        ph.view.ox += mid[0] - gesture.mid[0];
        ph.view.oy += mid[1] - gesture.mid[1];
        gesture.dist = d;
        gesture.mid = mid;
        drawPhoto();
        return;
    }
    if (gesture.type === 'pending' && Math.hypot(p[0] - gesture.start[0], p[1] - gesture.start[1]) > TAP_MOVE) {
        gesture.type = gesture.handle >= 0 ? 'corner' : 'pan';
        if (gesture.type === 'corner') {
            ph.selectedCorner = gesture.handle;
            ph.magnify = gesture.handle;
        }
    }
    if (gesture.type === 'corner') {
        // Moves by the finger's movement, so a corner never jumps under it.
        const c = ph.corners[gesture.handle];
        c[0] = Math.max(0, Math.min(ph.image.width, c[0] + (p[0] - gesture.last[0]) / ph.view.k));
        c[1] = Math.max(0, Math.min(ph.image.height, c[1] + (p[1] - gesture.last[1]) / ph.view.k));
        drawPhoto();
    } else if (gesture.type === 'pan') {
        ph.view.ox += p[0] - gesture.last[0];
        ph.view.oy += p[1] - gesture.last[1];
        drawPhoto();
    }
    gesture.last = p;
});

function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (!ph || !gesture) return;
    if (gesture.type === 'pinch') {
        if (pointers.size === 0) gesture = null;
        return;
    }
    const g = gesture;
    gesture = null;
    ph.magnify = null;
    if (g.type === 'pending' && e.type === 'pointerup') onTap(g.start, g.handle);
    else if (g.type === 'corner') renderPhoto();
    else drawPhoto();
}
photoCanvas.addEventListener('pointerup', endPointer);
photoCanvas.addEventListener('pointercancel', endPointer);

function zoomAt([x, y], factor) {
    const minK = Math.min(photoCanvas.clientWidth / ph.image.width, photoCanvas.clientHeight / ph.image.height) * 0.5;
    const k = Math.max(minK, Math.min(12, ph.view.k * factor));
    const f = k / ph.view.k;
    ph.view.ox = x - (x - ph.view.ox) * f;
    ph.view.oy = y - (y - ph.view.oy) * f;
    ph.view.k = k;
}

photoCanvas.addEventListener('wheel', e => {
    if (!ph) return;
    e.preventDefault();
    zoomAt(localPoint(e), e.deltaY < 0 ? 1.15 : 1 / 1.15);
    drawPhoto();
}, { passive: false });

function onTap(p, handle) {
    ph.message = null;
    if (ph.stage === 'join') {
        let best = -1, bestD = SIDE_PICK_RADIUS;
        ph.corners.forEach((_, i) => {
            const [x, y] = sideMid(i);
            const d = Math.hypot(x - p[0], y - p[1]);
            if (d < bestD) { bestD = d; best = i; }
        });
        if (best >= 0) pickJoinSide(best);
        else renderPhoto();
        return;
    }
    if (handle >= 0) {
        ph.selectedCorner = handle === ph.selectedCorner ? -1 : handle;
        renderPhoto();
        return;
    }
    ph.selectedCorner = -1;
    const pt = toImage(p[0], p[1]);
    if (pt[0] < 0 || pt[1] < 0 || pt[0] > ph.image.width || pt[1] > ph.image.height) {
        renderPhoto();
        return;
    }
    if (ph.manual) {
        insertCorner(pt);
        renderPhoto();
    } else if (ph.corners.length === 0) {
        runDetection(pt);
    } else {
        renderPhoto();
    }
}

// Inserts into the nearest side, so corners can be added in any order.
function insertCorner(pt) {
    const n = ph.corners.length;
    if (n < 3) {
        ph.corners.push(pt);
        return;
    }
    let best = 0, bestD = Infinity;
    for (let i = 0; i < n; i++) {
        const a = ph.corners[i], b = ph.corners[(i + 1) % n];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy);
        if (d < bestD) { bestD = d; best = i; }
    }
    ph.corners.splice(best + 1, 0, pt);
}

function runDetection(pt) {
    setHint('Looking for the face…');
    // Lets the browser paint the hint before the work starts.
    setTimeout(() => {
        if (!ph) return;
        if (!ph.imageData) {
            ph.imageData = ph.image.getContext('2d').getImageData(0, 0, ph.image.width, ph.image.height);
        }
        let found = null;
        try {
            found = detectPolygon(ph.imageData, pt[0], pt[1]);
        } catch (err) {
            console.warn('Face detection failed', err);
        }
        if (found) {
            ph.corners = orderPixelCorners(found.corners);
        } else {
            ph.manual = true;
            ph.message = { text: 'Could not find the face. Tap each corner by hand.', warn: true };
        }
        renderPhoto();
    }, 30);
}

new ResizeObserver(() => { if (ph) drawPhoto(); }).observe(photoCanvas);

// ------------------------------------------------------------- PWA and startup

function setupInstall() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem('installDismissed') === '1'; } catch { /* private mode */ }
    if (standalone || dismissed) return;
    const banner = $('installBanner');
    $('installClose').addEventListener('click', () => {
        banner.hidden = true;
        try { localStorage.setItem('installDismissed', '1'); } catch { /* private mode */ }
    });
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
        $('installText').textContent = 'To keep your work safe, tap Share, then "Add to Home Screen".';
        banner.hidden = false;
    }
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        $('installText').textContent = 'Install this app for offline use.';
        $('installBtn').hidden = false;
        banner.hidden = false;
        $('installBtn').addEventListener('click', () => {
            e.prompt();
            banner.hidden = true;
        }, { once: true });
    });
}

async function start() {
    setupInstall();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('No offline support', err));
    }
    await session.load();
    renderModel();
}

start();
