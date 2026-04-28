
const fs = require('fs');

// Mock BABYLON and Utils (same as before)
const BABYLON = {
    Vector3: class {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
        static Zero() { return new BABYLON.Vector3(0, 0, 0); }
        static FromArray(a) { return new BABYLON.Vector3(a[0], a[1], a[2]); }
        fromArray(a) { this.x = a[0]; this.y = a[1]; this.z = a[2]; return this; }
        add(v) { return new BABYLON.Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
        subtract(v) { return new BABYLON.Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
        scale(s) { return new BABYLON.Vector3(this.x * s, this.y * s, this.z * s); }
        normalize() {
            const l = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
            return new BABYLON.Vector3(this.x / l, this.y / l, this.z / l);
        }
        static Distance(a, b) {
            return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
        }
    },
    Color3: { Green: () => 'green', Magenta: () => 'magenta', Red: () => 'red', Blue: () => 'blue', Gray: () => 'gray', Yellow: () => 'yellow', Purple: () => 'purple' }
};

// Load medial_tracing.js content
const medialTracingContent = fs.readFileSync('./medial_tracing.js', 'utf8');
// Eval it to get classes in scope. 
// Note: medial_tracing.js defines classes globally or in scope.
// We need to strip "module.exports" if present, but I commented it out.
eval(medialTracingContent);

// Mock Origami
class Origami {
    points;
    faces;
    constructor(points, faces) {
        this.points = points;
        this.faces = faces;
    }
    getNorm(p0, p1, p2) {
        if (p2 === undefined) {
            let f = this.faces[p0];
            p1 = this.points[f[1]];
            p2 = this.points[f[2]];
            p0 = this.points[f[0]];
        }
        return vnormalize(vXprd(vsub(p1, p0), vsub(p2, p0)));
    }
    getDir(f1, f2, f3) {
        let n1 = this.getNorm(f1);
        let n2 = this.getNorm(f2);
        let n3 = this.getNorm(f3);
        let res = vnormalize(vadd(vadd(vXprd(n2, n1), vXprd(n3, n2)), vXprd(n1, n3)));
        return res;
    }
}

// --- Test Case (Pyramid) ---
const points = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1.5, 0]];
const faces = [[3, 2, 1, 0], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
const origami = new Origami(points, faces);

console.log("Tracing with maxThickness = 0.1");
const res1 = computeMedialTracing(origami, 0.1);
console.log("Seams count:", res1.seams.length);
console.log("Junctions count:", res1.junctions.length);
res1.seams.forEach(s => console.log(`Seam: ${s.start} -> ${s.end}`));

console.log("\nTracing with maxThickness = 10 (should reach apex)");
const res2 = computeMedialTracing(origami, 10);
console.log("Seams count:", res2.seams.length);
console.log("Junctions count:", res2.junctions.length);
res2.junctions.forEach(j => console.log(`Junction at ${j.pt} gov: ${j.gov}`));

console.log("\nSCAD Export Sample:");
console.log(exportScadTracing(origami, res2).substring(0, 200) + "...");
