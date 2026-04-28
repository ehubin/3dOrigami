// Compare and visualise expected vs actual medial-axis output for fixtures.
// Reads the `expected` block attached to theOrigami when a fixture is loaded.

const TH_GREEN = new BABYLON.Color3(0.2, 1, 0.2);
const TH_RED = new BABYLON.Color3(1, 0.2, 0.2);
const TH_BLUE = new BABYLON.Color3(0.2, 0.2, 1);
const TH_DIM = new BABYLON.Color3(0.45, 0.45, 0.45); // extras / unmatched actuals

function _samePoint(a, b, tol) {
    return Math.abs(a[0] - b[0]) < tol
        && Math.abs(a[1] - b[1]) < tol
        && Math.abs(a[2] - b[2]) < tol;
}

function _seamMatches(actualSeam, expectedSeam, tol) {
    // Direction-agnostic match on endpoints.
    const a = actualSeam, b = expectedSeam;
    return (_samePoint(a.start, b.start, tol) && _samePoint(a.end, b.end, tol))
        || (_samePoint(a.start, b.end, tol) && _samePoint(a.end, b.start, tol));
}

// Geometric dedup: collapse junctions/seams that share position regardless
// of gov set. Degenerate vertices and re-hit junctions cause the v2 tracer
// to emit several entries per unique point/seam.
function _dedupeJunctions(junctions, tol) {
    const out = [];
    junctions.forEach(j => {
        if (!out.some(o => _samePoint(o.pt, j.pt, tol))) out.push(j);
    });
    return out;
}

function _dedupeSeams(seams, tol) {
    const out = [];
    seams.forEach(s => {
        if (!out.some(o => _seamMatches(o, s, tol))) out.push(s);
    });
    return out;
}

function compareMA(actual, expected) {
    const tol = expected.tolerance || 1e-4;

    const rawJ = actual.junctions.length;
    const rawS = actual.seams.length;
    const dedJ = _dedupeJunctions(actual.junctions, tol);
    const dedS = _dedupeSeams(actual.seams, tol);

    // Junctions
    const expJUsed = new Set();
    const matchedJ = [];
    const extraJ = [];
    dedJ.forEach(aj => {
        const idx = expected.junctions.findIndex(
            (ej, i) => !expJUsed.has(i) && _samePoint(aj.pt, ej.pt, tol));
        if (idx !== -1) { expJUsed.add(idx); matchedJ.push(aj); }
        else extraJ.push(aj);
    });
    const missingJ = expected.junctions.filter((_, i) => !expJUsed.has(i));

    // Seams
    const expSUsed = new Set();
    const matchedS = [];
    const extraS = [];
    dedS.forEach(as => {
        const idx = expected.seams.findIndex(
            (es, i) => !expSUsed.has(i) && _seamMatches(as, es, tol));
        if (idx !== -1) { expSUsed.add(idx); matchedS.push(as); }
        else extraS.push(as);
    });
    const missingS = expected.seams.filter((_, i) => !expSUsed.has(i));

    return {
        junctions: { matched: matchedJ, missing: missingJ, extra: extraJ, total: expected.junctions.length, raw: rawJ, deduped: dedJ.length },
        seams: { matched: matchedS, missing: missingS, extra: extraS, total: expected.seams.length, raw: rawS, deduped: dedS.length }
    };
}

// Helpers: render a single seam/junction with a given color and tag.
function _drawSeam(scene, s, color, name) {
    const pts = [
        new BABYLON.Vector3(s.start[0], s.start[1], s.start[2]),
        new BABYLON.Vector3(s.end[0], s.end[1], s.end[2])
    ];
    const line = BABYLON.MeshBuilder.CreateLines(name || "seam", { points: pts }, scene);
    line.color = color;
    line.renderingGroupId = 1;
    BABYLON.Tags.AddTagsTo(line, "medial_vis");
    return line;
}

function _drawJunctionSphere(scene, j, color, diameter, name) {
    const sphere = BABYLON.MeshBuilder.CreateSphere(name || "junction",
        { diameter: diameter || 0.5, segments: 12 }, scene);
    sphere.position = new BABYLON.Vector3(j.pt[0], j.pt[1], j.pt[2]);
    const mat = new BABYLON.StandardMaterial("jmat", scene);
    mat.diffuseColor = color;
    mat.disableDepthTest = true;
    sphere.material = mat;
    sphere.renderingGroupId = 1;
    BABYLON.Tags.AddTagsTo(sphere, "medial_vis");
    return sphere;
}

function overlayExpectedMA(scene, expected, comparison) {
    // Missing seams: thick green dashed lines (something the algorithm failed to produce).
    expected.seams.forEach((s, i) => {
        const isMissing = comparison.seams.missing.includes(s);
        const pts = [
            new BABYLON.Vector3(s.start[0], s.start[1], s.start[2]),
            new BABYLON.Vector3(s.end[0], s.end[1], s.end[2])
        ];
        const line = BABYLON.MeshBuilder.CreateDashedLines("expected_seam_" + i,
            { points: pts, dashSize: 4, gapSize: 2, dashNb: 30 }, scene);
        line.color = isMissing ? TH_RED : TH_GREEN;
        line.renderingGroupId = 1;
        BABYLON.Tags.AddTagsTo(line, "medial_vis");
    });

    // Expected junctions: green wireframe spheres (slightly larger than actual).
    // Missing ones turn red.
    expected.junctions.forEach((j, i) => {
        const isMissing = comparison.junctions.missing.includes(j);
        const sphere = BABYLON.MeshBuilder.CreateSphere("expected_junction_" + i,
            { diameter: 0.9, segments: 12 }, scene);
        sphere.position = new BABYLON.Vector3(j.pt[0], j.pt[1], j.pt[2]);
        const mat = new BABYLON.StandardMaterial("exp_jmat_" + i, scene);
        mat.diffuseColor = isMissing ? TH_RED : TH_GREEN;
        mat.emissiveColor = isMissing ? TH_RED : TH_GREEN;
        mat.wireframe = true;
        mat.disableDepthTest = true;
        sphere.material = mat;
        sphere.renderingGroupId = 1;
        BABYLON.Tags.AddTagsTo(sphere, "medial_vis");
    });
}

let _testHud = null;
function updateTestHud(text, ok) {
    if (!_testHud) {
        _testHud = new BABYLON.GUI.TextBlock();
        _testHud.fontSize = 16;
        _testHud.fontFamily = "monospace";
        _testHud.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        _testHud.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        _testHud.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        _testHud.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        _testHud.top = 60;
        _testHud.left = -10;
        _testHud.width = "320px";
        _testHud.height = "120px";
        _testHud.outlineColor = "black";
        _testHud.outlineWidth = 3;
        ui.addControl(_testHud);
    }
    _testHud.text = text;
    _testHud.color = ok ? "#5fff5f" : "#ff8080";
}

function clearTestHud() {
    if (_testHud) _testHud.text = "";
}

// Run the harness step: compare actual to theOrigami.expected, draw all
// medial-axis visualisation (deduped actuals colored by match status,
// expected overlay in green/red), update HUD. Returns the comparison object.
function runHarness(scene, actual) {
    if (!theOrigami.expected) {
        clearTestHud();
        return null;
    }
    const cmp = compareMA(actual, theOrigami.expected);

    // Deduped actuals: matched seams red, extras dim grey
    cmp.seams.matched.forEach(s => _drawSeam(scene, s, TH_RED, "seam_match"));
    cmp.seams.extra.forEach(s => _drawSeam(scene, s, TH_DIM, "seam_extra"));
    cmp.junctions.matched.forEach(j => _drawJunctionSphere(scene, j, TH_BLUE, 0.5, "junc_match"));
    cmp.junctions.extra.forEach(j => _drawJunctionSphere(scene, j, TH_DIM, 0.4, "junc_extra"));

    overlayExpectedMA(scene, theOrigami.expected, cmp);

    const jOk = cmp.junctions.missing.length === 0;
    const sOk = cmp.seams.missing.length === 0;
    const allOk = jOk && sOk;

    const fmt = (m) =>
        `${m.matched.length}/${m.total}` +
        (m.missing.length ? ` missing:${m.missing.length}` : "") +
        (m.extra.length ? ` extra:${m.extra.length}` : "") +
        ` (raw:${m.raw}->${m.deduped})`;
    const lines = [
        theOrigami.name || "(unnamed)",
        `Junctions: ${fmt(cmp.junctions)}`,
        `Seams:     ${fmt(cmp.seams)}`
    ];
    updateTestHud(lines.join("\n"), allOk);

    console.log("[harness]", theOrigami.name, cmp);
    return cmp;
}
