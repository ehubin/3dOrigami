console.log("medial_tracing.js start");
// Vector utilities are defined in origami.js

// Local epsilon for numerical comparisons
const mt_eps = 0.0001;

class MTJunction {
    gov = []; // Array of face indices
    pt = [];  // [x, y, z]
    constructor(faces, pt) {
        this.gov = faces.sort((a, b) => a - b);
        this.pt = pt;
    }
    isSame(other) {
        if (this.gov.length !== other.gov.length) return false;
        for (let i = 0; i < this.gov.length; ++i) if (this.gov[i] !== other.gov[i]) return false;
        // Also check point distance for robustness
        let d = 0;
        for (let i = 0; i < 3; ++i) d += (this.pt[i] - other.pt[i]) ** 2;
        return d < mt_eps * mt_eps;
    }
}

class Seam {
    startPt;
    dir;
    faces; // [f1, f2, f3]
    constructor(pt, dir, faces) {
        this.startPt = pt;
        this.dir = dir;
        this.faces = faces.sort((a, b) => a - b);
    }
    isSame(other) {
        if (this.faces.length !== other.faces.length) return false;
        for (let i = 0; i < this.faces.length; ++i) if (this.faces[i] !== other.faces[i]) return false;
        // Direction and start point check?
        // Ideally we check if they are the same ray.
        // For now, just face check might be enough if we only have one seam per triplet.
        return true;
    }
}

class MedialTracing {
    o; // Origami instance
    maxThickness;
    junctions = [];
    seams = []; // Resulting seams (segments)
    queue = []; // Seams to trace
    processedSeams = new Set(); // To avoid cycles/duplicates: "f1,f2,f3"

    constructor(o, maxThickness) {
        this.o = o;
        this.maxThickness = maxThickness;
    }

    compute() {
        this.initFromVertices();
        this.processQueue();
        this.deduplicateJunctions();
        return { junctions: this.junctions, seams: this.seams };
    }

    addSeamToQueue(seam) {
        let key = seam.faces.join(',');
        // We might want to trace the same triplet from different starts?
        // Yes, segments. But if we already have a seam for these faces starting at P, 
        // and we try to add another one?
        // For now, just add.
        this.queue.push(seam);
    }

    initFromVertices() {
        this.o.points.forEach((pt, pidx) => {
            let faces = [];
            this.o.faces.forEach((f, fidx) => {
                if (f.includes(pidx)) faces.push(fidx);
            });

            if (faces.length >= 3) {
                // Per-vertex inward reference: sum of incident-face normals.
                // With the app's convention (cross product gives inward normal),
                // this points into the polyhedron at this vertex.
                let inwardRef = [0, 0, 0];
                faces.forEach(fi => {
                    const n = this.o.getNorm(fi);
                    inwardRef[0] += n[0];
                    inwardRef[1] += n[1];
                    inwardRef[2] += n[2];
                });

                // Try all triplets. For a simple (3-face) vertex, only one;
                // for degenerate (4+ face) vertices, several — possibly redundant.
                for (let i = 0; i < faces.length; ++i) {
                    for (let j = i + 1; j < faces.length; ++j) {
                        for (let k = j + 1; k < faces.length; ++k) {
                            let tri = [faces[i], faces[j], faces[k]];
                            let dir = this.o.getDir(tri[0], tri[1], tri[2]);
                            // getDir's sign depends on the cyclic order of the
                            // triplet around the vertex; flip when it points
                            // away from the vertex's inward reference.
                            if (vdot(dir, inwardRef) < 0) {
                                dir = smult(-1, dir);
                            }
                            let seam = new Seam(pt, dir, tri);
                            this.addSeamToQueue(seam);
                        }
                    }
                }
                this.junctions.push(new MTJunction(faces, pt));
            }
        });
    }

    processQueue() {
        let iterations = 0;
        const maxIterations = 10000; // Safety guard

        while (this.queue.length > 0) {
            if (iterations++ > maxIterations) {
                console.error("Medial Tracing: Max iterations reached! Aborting to prevent freeze.");
                break;
            }

            let seam = this.queue.shift();
            let key = seam.faces.join(',');

            if (this.processedSeams.has(key)) {
                continue;
            }
            this.processedSeams.add(key);

            this.traceSeam(seam);
        }
        console.log(`Medial Tracing finished after ${iterations} iterations.`);
    }

    traceSeam(seam) {
        // Validity check: at startPt + eps*dir, no face outside the seam's gov
        // should be closer than the gov faces (else this 3-face bisector isn't
        // on the actual medial axis — a 4th face dominates here).
        const valEps = 0.01;
        const checkPt = vadd(seam.startPt, smult(valEps, seam.dir));
        let govDist = Infinity;
        seam.faces.forEach(g => {
            const ng = this.o.getNorm(g);
            const pg = this.o.points[this.o.faces[g][0]];
            const dg = vdot(vsub(checkPt, pg), ng);
            if (dg < govDist) govDist = dg;
        });
        for (let k = 0; k < this.o.faces.length; ++k) {
            if (seam.faces.includes(k)) continue;
            const nk = this.o.getNorm(k);
            const pk = this.o.points[this.o.faces[k][0]];
            const dk = vdot(vsub(checkPt, pk), nk);
            if (dk < govDist - mt_eps) return; // phantom seam, drop
        }

        let minT = Infinity;
        let bestF = -1;

        let f1 = seam.faces[0];
        let n1 = this.o.getNorm(f1);
        let p1 = this.o.points[this.o.faces[f1][0]];
        let rhs1 = vdot(n1, p1);

        this.o.faces.forEach((f, k) => {
            if (seam.faces.includes(k)) return;

            let nk = this.o.getNorm(k);
            let pk = this.o.points[f[0]];
            let rhsk = vdot(nk, pk);

            let denom = vdot(vsub(n1, nk), seam.dir);

            if (Math.abs(denom) > mt_eps) {
                let num = (rhs1 - rhsk) - vdot(vsub(n1, nk), seam.startPt);
                let t = num / denom;

                if (t > mt_eps && t < minT) {
                    minT = t;
                    bestF = k;
                }
            }
        });

        let endPt;
        let terminate = false;
        let hitMax = false;

        if (bestF !== -1) {
            endPt = vadd(seam.startPt, smult(minT, seam.dir));
            let distAtEnd = Math.abs(vdot(vsub(endPt, p1), n1));
            if (distAtEnd > this.maxThickness) hitMax = true;
        } else {
            hitMax = true;
        }

        if (hitMax) {
            let n1_dot_dir = vdot(n1, seam.dir);
            if (Math.abs(n1_dot_dir) > mt_eps) {
                let tMax = (this.maxThickness - vdot(vsub(seam.startPt, p1), n1)) / n1_dot_dir;
                if (tMax > 0 && (bestF === -1 || tMax < minT)) {
                    minT = tMax;
                    endPt = vadd(seam.startPt, smult(minT, seam.dir));
                    terminate = true;
                } else if (bestF !== -1) {
                    terminate = false;
                }
            } else {
                if (bestF === -1) terminate = true;
            }
        }

        if (endPt) {
            // Check if segment length > mt_eps
            if (minT > mt_eps) {
                this.seams.push({ start: seam.startPt, end: endPt, faces: seam.faces });

                if (!terminate && bestF !== -1) {
                    let newFaces = [...seam.faces, bestF];
                    let jc = new MTJunction(newFaces, endPt);
                    this.junctions.push(jc);

                    // Inward reference at the new junction = sum of its
                    // incident-face normals. Used to sign-correct getDir,
                    // whose result depends on the cyclic order of the triplet.
                    let inwardRef = [0, 0, 0];
                    newFaces.forEach(fi => {
                        const n = this.o.getNorm(fi);
                        inwardRef[0] += n[0]; inwardRef[1] += n[1]; inwardRef[2] += n[2];
                    });

                    let candidates = [
                        [seam.faces[0], seam.faces[1], bestF],
                        [seam.faces[0], seam.faces[2], bestF],
                        [seam.faces[1], seam.faces[2], bestF]
                    ];

                    candidates.forEach(cf => {
                        let newDir = this.o.getDir(cf[0], cf[1], cf[2]);
                        if (vdot(newDir, inwardRef) < 0) {
                            newDir = smult(-1, newDir);
                        }
                        this.addSeamToQueue(new Seam(endPt, newDir, cf));
                    });
                }
            }
        }
    }

    deduplicateJunctions() {
        let unique = [];
        this.junctions.forEach(j => {
            if (!unique.some(u => u.isSame(j))) {
                unique.push(j);
            }
        });
        this.junctions = unique;
    }
}

function computeMedialTracing(o, maxThickness) {
    let mt = new MedialTracing(o, maxThickness);
    return mt.compute();
}

function exportScadTracing(o, medialResult) {
    let output = "";
    o.faces.forEach((f, fidx) => {
        let points = [];
        // Face vertices
        f.forEach(pidx => points.push(o.points[pidx]));

        // Medial points (Junctions and Seam ends)
        // A point is relevant if it is on a seam governed by fidx
        // or a junction governed by fidx.

        medialResult.seams.forEach(s => {
            if (s.faces.includes(fidx)) {
                points.push(s.start);
                points.push(s.end);
            }
        });

        // Deduplicate points
        let uniquePts = [];
        points.forEach(p => {
            if (!uniquePts.some(u => Math.abs(u[0] - p[0]) < mt_eps && Math.abs(u[1] - p[1]) < mt_eps && Math.abs(u[2] - p[2]) < mt_eps)) {
                uniquePts.push(p);
            }
        });

        output += `// Face ${fidx}\n`;
        output += `module face_${fidx}() {\n`;
        output += `  hull() {\n`;
        uniquePts.forEach(p => {
            output += `    translate([${p[0]}, ${p[1]}, ${p[2]}]) sphere(0.01);\n`;
        });
        output += `  }\n`;
        output += `}\n\n`;
    });
    return output;
}

console.log("medial_tracing.js loaded");
// module.exports = { computeMedialTracing, exportScadTracing };
