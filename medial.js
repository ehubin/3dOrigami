class Junction {
    gov = [];
    pt = [];
    constructor(faces, pt) {
        this.gov = faces.sort((a, b) => a - b);
        this.pt = pt;
    }
    isSame(other) {
        if (this.gov.length !== other.gov.length) return false;
        for (let i = 0; i < this.gov.length; ++i) if (this.gov[i] !== other.gov[i]) return false;
        return BABYLON.Vector3.Distance(BABYLON.Vector3.FromArray(this.pt), BABYLON.Vector3.FromArray(other.pt)) < eps;
    }
}

const eps = 0.0001;
class Medial {
    o; //origami
    d; d2; //thickness of faces to compute

    jList = [];
    constructor(o, d) {
        this.o = o; this.d = d; this.d2 = d * d;
        o.points.forEach(() => this.jList.push([]));

    }
    // get image of point pidx for face fidx, can be one or 2 points
    getPt(pidx, fidx, fprevidx) {
        let res = [], candidates = [];
        this.jList[pidx].forEach(j => {
            if (j.gov.includes(fidx)) candidates.push(j);
        });
        if (candidates.length == 0) { console.log("no point for " + pidx + " on face " + fidx + "!!!"); return candidates; }
        else {
            let c = -1;
            let currCandidates = [...candidates];
            while (currCandidates.length > 1) {
                c = currCandidates.findIndex((j) => { return j.gov.includes(fprevidx); });
                if (c === -1) {
                    console.error(`Broken chain at ${pidx} for face ${fidx}. Prev: ${fprevidx}`);
                    break;
                }
                let chosen = currCandidates[c];

                let possibleNext = chosen.gov.filter(f => f != fprevidx && f != fidx);
                let nextF = -1;

                if (possibleNext.length > 1) {
                    let found = false;
                    for (let nf of possibleNext) {
                        if (currCandidates.some((oc, idx) => idx !== c && oc.gov.includes(nf))) {
                            nextF = nf;
                            found = true;
                            break;
                        }
                    }
                    if (!found) nextF = possibleNext[0];
                } else {
                    nextF = possibleNext[0];
                }

                fprevidx = nextF;
                res.push(chosen.pt);
                currCandidates.splice(c, 1);
            }
            if (currCandidates.length > 0) res.push(currCandidates[0].pt);
        }
        return res;
    }
    addJunctions(pidx, adjFaces) {
        for (let i = 0; i < adjFaces.length; ++i) {
            for (let j = i + 1; j < adjFaces.length; ++j) {
                for (let k = j + 1; k < adjFaces.length; ++k) {
                    this.explore(pidx, adjFaces[i], adjFaces[j], adjFaces[k],
                        adjFaces.filter((e, idx) => idx != i && idx != j && idx != k));
                }
            }
        }
    }
    explore(pidx, f1, f2, f3, others) {
        let pt = this.o.points[pidx];
        let dir = this.o.getDir(f1, f2, f3);
        let np = vadd(pt, smult(eps, dir));
        if (pidx == 5 && f1 == 4 & f2 == 5 && f3 == 6) {
            showSph(vadd(pt, dir), BABYLON.Color3.Green());
            showSph(vsub(pt, dir), BABYLON.Color3.Magenta());
        }
        let degen = [];
        let dist = this.o.getDist(np, f1);
        if (others.some(f => {
            if (this.o.isWithinDPolytope(np, f)) {
                let odist = this.o.getDist(np, f);
                if (odist < dist) {
                    console.log(f1 + "," + f2 + "," + f3 + " not feasible because of " + f);
                    return true;
                }
                if (Math.abs(odist - dist) < eps * eps) {
                    console.log("degenerated " + f);
                    degen.push(f);
                }
                return false;
            } else {
                console.log(f + " not relevant (" + f1 + "," + f2 + "," + f3 + ") seam outside polytope");
            }
        })) {
            //showSph(vadd(pt,smult(this.d/vdot(dir,this.o.getNorm(f1)),dir)),BABYLON.Color3.Red());
        } else {
            let jc = new Junction([f1, f2, f3].concat(degen),
                vadd(pt, smult(this.d / vdot(dir, this.o.getNorm(f1)), dir)));

            let exists = this.jList[pidx].some(existing => existing.isSame(jc));
            if (!exists) {
                this.jList[pidx].push(jc);
                console.log(f1 + "," + f2 + "," + f3 + " feasible");
                showSph(jc.pt, BABYLON.Color3.Blue(), f1 + "," + f2 + "," + f3);
            }
        }
    }
}

// compute medial axis of Polyhedron until a certain distance d
function computeMedial(o, d) {
    let res = new Medial(o, d);
    let first, prev, next, fi;
    try {
        o.points.forEach((p, pidx) => {
            let vList = [];
            console.log("v=" + pidx);
            // find nearby vertex to p
            o.faces.some((f, fidx) => {
                return f.some((lp, pi) => {
                    if (lp == pidx) {
                        fi = fidx;
                        prev = pi == 0 ? f[f.length - 1] : f[pi - 1];
                        next = pi == f.length - 1 ? f[0] : f[pi + 1];
                        vList.push(fi);
                        //console.log("face"+f+",prev="+prev+",next="+next);
                        return true;
                    }
                    return false;
                });
            });
            first = prev;
            let ret = [fi, next];
            do {

                ret = o.findVOtherFaceContaining(pidx, ret[1], ret[0]);
                if (ret == null) {
                    console.log("Polygon not closed... exiting computeVGlob!");
                    return;
                }
                //console.log("next="+ret[1]+"; face="+ret[0]);
                vList.push(ret[0]);
            } while (ret[1] != first)
            console.log("faces " + vList);
            res.addJunctions(pidx, vList);
        });
    } catch (e) { console.log(e); }
    return res;
}

function exportScad(o, medial) {
    let output = "";
    o.faces.forEach((f, i) => {
        let poly = o.getScadPolyhedron(i, medial);
        output += `// Face ${i}\n`;
        output += `polyhedron(\n`;
        output += `  points = ${JSON.stringify(poly.pt)},\n`;
        output += `  faces = ${JSON.stringify(poly.idx)}\n`;
        output += `);\n\n`;
    });
    console.log(output);
    return output;
}