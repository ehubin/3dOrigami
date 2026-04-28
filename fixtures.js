// Reference polyhedra with analytically-known medial axis structure.
// Seeded into localStorage so they appear in the standard "open" dialog.
//
// Each shape is defined in natural unit coordinates, then uniformly scaled
// by SCALE so the rendered slabs (1 unit thick, inward) look thin relative
// to the object. Finally lifted so the lowest vertex sits on the ground.
//
// Bump FIXTURES_VERSION to force re-seed on next load (won't touch user shapes).

const FIXTURES_VERSION = 7;
const SCALE = 2.5; // unit shapes -> ~5-unit objects

// --- Regular tetrahedron (alternating cube corners) -----------------------
const tetrahedron = {
    name: "Test Tetrahedron",
    pt: [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1]
    ],
    f: [
        [0, 1, 2],
        [0, 3, 1],
        [0, 2, 3],
        [1, 3, 2]
    ],
    expected: {
        tolerance: 1e-4,
        junctions: [
            { pt: [1, 1, 1], gov: [0, 1, 2] },
            { pt: [1, -1, -1], gov: [0, 1, 3] },
            { pt: [-1, 1, -1], gov: [0, 2, 3] },
            { pt: [-1, -1, 1], gov: [1, 2, 3] },
            { pt: [0, 0, 0], gov: [0, 1, 2, 3] }
        ],
        seams: [
            { start: [1, 1, 1], end: [0, 0, 0], faces: [0, 1, 2] },
            { start: [1, -1, -1], end: [0, 0, 0], faces: [0, 1, 3] },
            { start: [-1, 1, -1], end: [0, 0, 0], faces: [0, 2, 3] },
            { start: [-1, -1, 1], end: [0, 0, 0], faces: [1, 2, 3] }
        ]
    }
};

// --- Cube, side 2, centered ------------------------------------------------
const cube = {
    name: "Test Cube",
    pt: [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ],
    f: [
        [0, 3, 2, 1],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [1, 2, 6, 5],
        [2, 3, 7, 6],
        [0, 4, 7, 3]
    ],
    expected: {
        tolerance: 1e-4,
        junctions: [
            { pt: [-1, -1, -1], gov: [0, 2, 5] },
            { pt: [1, -1, -1], gov: [0, 2, 3] },
            { pt: [1, 1, -1], gov: [0, 3, 4] },
            { pt: [-1, 1, -1], gov: [0, 4, 5] },
            { pt: [-1, -1, 1], gov: [1, 2, 5] },
            { pt: [1, -1, 1], gov: [1, 2, 3] },
            { pt: [1, 1, 1], gov: [1, 3, 4] },
            { pt: [-1, 1, 1], gov: [1, 4, 5] },
            { pt: [0, 0, 0], gov: [0, 1, 2, 3, 4, 5] }
        ],
        seams: [
            { start: [-1, -1, -1], end: [0, 0, 0], faces: [0, 2, 5] },
            { start: [1, -1, -1], end: [0, 0, 0], faces: [0, 2, 3] },
            { start: [1, 1, -1], end: [0, 0, 0], faces: [0, 3, 4] },
            { start: [-1, 1, -1], end: [0, 0, 0], faces: [0, 4, 5] },
            { start: [-1, -1, 1], end: [0, 0, 0], faces: [1, 2, 5] },
            { start: [1, -1, 1], end: [0, 0, 0], faces: [1, 2, 3] },
            { start: [1, 1, 1], end: [0, 0, 0], faces: [1, 3, 4] },
            { start: [-1, 1, 1], end: [0, 0, 0], faces: [1, 4, 5] }
        ]
    }
};

// --- Octahedron ------------------------------------------------------------
const octahedron = {
    name: "Test Octahedron",
    pt: [
        [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ],
    f: [
        [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
        [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]
    ],
    expected: {
        tolerance: 1e-4,
        junctions: [
            { pt: [1, 0, 0], gov: [0, 1, 2, 3] },
            { pt: [-1, 0, 0], gov: [4, 5, 6, 7] },
            { pt: [0, 1, 0], gov: [0, 3, 4, 7] },
            { pt: [0, -1, 0], gov: [1, 2, 5, 6] },
            { pt: [0, 0, 1], gov: [0, 1, 4, 5] },
            { pt: [0, 0, -1], gov: [2, 3, 6, 7] },
            { pt: [0, 0, 0], gov: [0, 1, 2, 3, 4, 5, 6, 7] }
        ],
        seams: [
            { start: [1, 0, 0], end: [0, 0, 0], faces: [0, 1, 2] },
            { start: [-1, 0, 0], end: [0, 0, 0], faces: [4, 5, 6] },
            { start: [0, 1, 0], end: [0, 0, 0], faces: [0, 3, 4] },
            { start: [0, -1, 0], end: [0, 0, 0], faces: [1, 2, 5] },
            { start: [0, 0, 1], end: [0, 0, 0], faces: [0, 1, 4] },
            { start: [0, 0, -1], end: [0, 0, 0], faces: [2, 3, 6] }
        ]
    }
};

// --- Square pyramid --------------------------------------------------------
const PYRAMID_H = 1.5;
const PYRAMID_S = Math.sqrt(1 + PYRAMID_H * PYRAMID_H);
const PYRAMID_YC = PYRAMID_H / (1 + PYRAMID_S);

const squarePyramid = {
    name: "Test Pyramid",
    pt: [
        [-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1],
        [0, PYRAMID_H, 0]
    ],
    f: [
        [0, 1, 2, 3],
        [0, 4, 1],
        [1, 4, 2],
        [2, 4, 3],
        [3, 4, 0]
    ],
    expected: {
        tolerance: 1e-4,
        junctions: [
            { pt: [-1, 0, -1], gov: [0, 1, 4] },
            { pt: [1, 0, -1], gov: [0, 1, 2] },
            { pt: [1, 0, 1], gov: [0, 2, 3] },
            { pt: [-1, 0, 1], gov: [0, 3, 4] },
            { pt: [0, PYRAMID_H, 0], gov: [1, 2, 3, 4] },
            { pt: [0, PYRAMID_YC, 0], gov: [0, 1, 2, 3, 4] }
        ],
        seams: [
            { start: [-1, 0, -1], end: [0, PYRAMID_YC, 0], faces: [0, 1, 4] },
            { start: [1, 0, -1], end: [0, PYRAMID_YC, 0], faces: [0, 1, 2] },
            { start: [1, 0, 1], end: [0, PYRAMID_YC, 0], faces: [0, 2, 3] },
            { start: [-1, 0, 1], end: [0, PYRAMID_YC, 0], faces: [0, 3, 4] },
            { start: [0, PYRAMID_H, 0], end: [0, PYRAMID_YC, 0], faces: [1, 2, 3] }
        ]
    }
};

// --- Triangular prism ------------------------------------------------------
const PRISM_L = 4;
const PRISM_R = Math.sqrt(3) / 3;
const PRISM_S3 = Math.sqrt(3);

const triangularPrism = {
    name: "Test Prism",
    pt: [
        [-1, 0, 0], [1, 0, 0], [0, 0, PRISM_S3],
        [-1, PRISM_L, 0], [1, PRISM_L, 0], [0, PRISM_L, PRISM_S3]
    ],
    f: [
        [0, 1, 2],
        [3, 5, 4],
        [0, 3, 4, 1],
        [1, 4, 5, 2],
        [2, 5, 3, 0]
    ],
    expected: {
        tolerance: 1e-4,
        junctions: [
            { pt: [-1, 0, 0], gov: [0, 2, 4] },
            { pt: [1, 0, 0], gov: [0, 2, 3] },
            { pt: [0, 0, PRISM_S3], gov: [0, 3, 4] },
            { pt: [-1, PRISM_L, 0], gov: [1, 2, 4] },
            { pt: [1, PRISM_L, 0], gov: [1, 2, 3] },
            { pt: [0, PRISM_L, PRISM_S3], gov: [1, 3, 4] },
            { pt: [0, PRISM_R, PRISM_R], gov: [0, 2, 3, 4] },
            { pt: [0, PRISM_L - PRISM_R, PRISM_R], gov: [1, 2, 3, 4] }
        ],
        seams: [
            { start: [-1, 0, 0], end: [0, PRISM_R, PRISM_R], faces: [0, 2, 4] },
            { start: [1, 0, 0], end: [0, PRISM_R, PRISM_R], faces: [0, 2, 3] },
            { start: [0, 0, PRISM_S3], end: [0, PRISM_R, PRISM_R], faces: [0, 3, 4] },
            { start: [-1, PRISM_L, 0], end: [0, PRISM_L - PRISM_R, PRISM_R], faces: [1, 2, 4] },
            { start: [1, PRISM_L, 0], end: [0, PRISM_L - PRISM_R, PRISM_R], faces: [1, 2, 3] },
            { start: [0, PRISM_L, PRISM_S3], end: [0, PRISM_L - PRISM_R, PRISM_R], faces: [1, 3, 4] },
            { start: [0, PRISM_R, PRISM_R], end: [0, PRISM_L - PRISM_R, PRISM_R], faces: [2, 3, 4] }
        ]
    }
};

// --- Icosahedron ----------------------------------------------------------
// 12 vertices at (0,±1,±φ), (±1,±φ,0), (±φ,0,±1) with φ the golden ratio.
// 20 triangular faces, every vertex is incident to 5 (degenerate vertex).
// All 10 cyclic-3-subsets at each vertex give the same axis direction by
// 5-fold symmetry, so after dedup we expect 12 unique seams.
const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSA_VERTS = [
    [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
    [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
    [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1]
];
// Face vertex sets (unordered). orientForOutward fixes the order so the
// cross-product points away from the origin; flipWindings later reverses
// for the app's inward-cross convention.
const ICOSA_FACE_SETS = [
    [0, 1, 8], [0, 1, 10], [0, 4, 5], [0, 4, 8], [0, 5, 10],
    [1, 6, 7], [1, 6, 8], [1, 7, 10],
    [2, 3, 9], [2, 3, 11], [2, 4, 5], [2, 4, 9], [2, 5, 11],
    [3, 6, 7], [3, 6, 9], [3, 7, 11],
    [4, 8, 9], [5, 10, 11], [6, 8, 9], [7, 10, 11]
];
function _orientForOutward(verts, abc) {
    const [a, b, c] = abc;
    const va = verts[a], vb = verts[b], vc = verts[c];
    const ab = [vb[0]-va[0], vb[1]-va[1], vb[2]-va[2]];
    const ac = [vc[0]-va[0], vc[1]-va[1], vc[2]-va[2]];
    const cx = ab[1]*ac[2] - ab[2]*ac[1];
    const cy = ab[2]*ac[0] - ab[0]*ac[2];
    const cz = ab[0]*ac[1] - ab[1]*ac[0];
    const fx = (va[0]+vb[0]+vc[0])/3;
    const fy = (va[1]+vb[1]+vc[1])/3;
    const fz = (va[2]+vb[2]+vc[2])/3;
    return (cx*fx + cy*fy + cz*fz) > 0 ? [a, b, c] : [a, c, b];
}
const ICOSA_F = ICOSA_FACE_SETS.map(s => _orientForOutward(ICOSA_VERTS, s));

const icosahedron = {
    name: "Test Icosahedron",
    pt: ICOSA_VERTS,
    f: ICOSA_F,
    expected: {
        tolerance: 1e-3,
        junctions: [
            ...ICOSA_VERTS.map((p, i) => ({
                pt: p,
                gov: ICOSA_F.map((face, fi) => face.includes(i) ? fi : -1).filter(x => x >= 0)
            })),
            { pt: [0, 0, 0], gov: [...Array(20).keys()] }
        ],
        seams: ICOSA_VERTS.map((p, i) => {
            const incident = ICOSA_F.map((face, fi) => face.includes(i) ? fi : -1).filter(x => x >= 0);
            return { start: p, end: [0, 0, 0], faces: incident.slice(0, 3) };
        })
    }
};

// Reverse vertex order of every face so cross((p1-p0),(p2-p0)) points
// inward, matching the convention the in-app face creation uses.
function flipWindings(fx) {
    return {
        ...fx,
        f: fx.f.map(face => face.slice().reverse())
    };
}

// Uniform scale of pt + expected geometry (gov face indices unchanged).
function applyScale(fx, scale) {
    const s = p => [p[0] * scale, p[1] * scale, p[2] * scale];
    return {
        ...fx,
        pt: fx.pt.map(s),
        expected: {
            ...fx.expected,
            tolerance: fx.expected.tolerance * scale,
            junctions: fx.expected.junctions.map(j => ({ pt: s(j.pt), gov: j.gov })),
            seams: fx.expected.seams.map(seam => ({ start: s(seam.start), end: s(seam.end), faces: seam.faces }))
        }
    };
}

// Translate so the lowest vertex sits at y=0.
function restOnGround(fx) {
    const minY = Math.min(...fx.pt.map(p => p[1]));
    if (Math.abs(minY) < 1e-9) return fx;
    const shift = p => [p[0], p[1] - minY, p[2]];
    return {
        ...fx,
        pt: fx.pt.map(shift),
        expected: {
            ...fx.expected,
            junctions: fx.expected.junctions.map(j => ({ pt: shift(j.pt), gov: j.gov })),
            seams: fx.expected.seams.map(s => ({ start: shift(s.start), end: shift(s.end), faces: s.faces }))
        }
    };
}

const FIXTURES = [tetrahedron, cube, octahedron, squarePyramid, triangularPrism, icosahedron]
    .map(flipWindings)
    .map(fx => applyScale(fx, SCALE))
    .map(restOnGround);

(function seedFixtures() {
    let storedVersion = 0;
    if (localStorage.hasOwnProperty("__fixturesVersion")) {
        storedVersion = parseInt(localStorage.getItem("__fixturesVersion"), 10) || 0;
    }
    const forceWrite = storedVersion < FIXTURES_VERSION;

    let saved = [];
    if (localStorage.hasOwnProperty("saved")) {
        try { saved = JSON.parse(localStorage.saved) || []; } catch (e) { saved = []; }
    }

    let writes = 0;
    FIXTURES.forEach(fx => {
        const exists = localStorage.hasOwnProperty(fx.name);
        if (!exists || forceWrite) {
            const value = { pt: fx.pt, f: fx.f, expected: fx.expected };
            localStorage.setItem(fx.name, JSON.stringify(value));
            writes++;
        }
        if (!saved.includes(fx.name)) saved.push(fx.name);
    });

    localStorage.setItem("saved", JSON.stringify(saved));
    localStorage.setItem("__fixturesVersion", String(FIXTURES_VERSION));

    if (writes > 0) {
        console.log(`fixtures.js: seeded ${writes} test fixture(s) (v${FIXTURES_VERSION})`);
    } else {
        console.log(`fixtures.js: ${FIXTURES.length} test fixtures present (v${FIXTURES_VERSION})`);
    }
})();
