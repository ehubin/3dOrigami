// Debugging utilities for 3D Origami medial axis and face offset issues

class DebugHelper {
    constructor(scene, origami) {
        this.scene = scene;
        this.origami = origami;
        this.debugMeshes = [];
    }

    // Clear all debug visualizations
    clear() {
        this.debugMeshes.forEach(m => m.dispose());
        this.debugMeshes = [];
    }

    // Visualize offset directions at each vertex of a face
    visualizeOffsetDirections(faceIdx) {
        const f = this.origami.faces[faceIdx];
        const offsetVerts = this.origami.computeFdir(f, faceIdx, 1);

        f.forEach((vertIdx, i) => {
            const orig = this.origami.points[vertIdx];
            const offset = offsetVerts[i];
            const dir = vsub(offset, orig);

            // Draw arrow from original to offset position
            const arrow = this.createArrow(orig, offset,
                BABYLON.Color3.Yellow(), `F${faceIdx}V${i}`);
            this.debugMeshes.push(arrow);

            // Label with magnitude
            console.log(`Face ${faceIdx}, Vertex ${vertIdx}: offset magnitude = ${vnorm(dir).toFixed(3)}`);
        });
    }

    // Check if two adjacent faces share the same offset edge
    checkEdgeConsistency(face1Idx, face2Idx, sharedEdge) {
        const [v1, v2] = sharedEdge; // shared vertex indices

        const f1 = this.origami.faces[face1Idx];
        const f2 = this.origami.faces[face2Idx];

        const offset1 = this.origami.computeFdir(f1, face1Idx, 1);
        const offset2 = this.origami.computeFdir(f2, face2Idx, 1);

        // Find indices of shared vertices in each face
        const i1_v1 = f1.indexOf(v1);
        const i1_v2 = f1.indexOf(v2);
        const i2_v1 = f2.indexOf(v1);
        const i2_v2 = f2.indexOf(v2);

        if (i1_v1 === -1 || i1_v2 === -1 || i2_v1 === -1 || i2_v2 === -1) {
            console.error("Shared edge vertices not found in faces!");
            return false;
        }

        // Compare offset positions
        const off1_v1 = offset1[i1_v1];
        const off1_v2 = offset1[i1_v2];
        const off2_v1 = offset2[i2_v1];
        const off2_v2 = offset2[i2_v2];

        const diff1 = vnorm(vsub(off1_v1, off2_v1));
        const diff2 = vnorm(vsub(off1_v2, off2_v2));

        const tolerance = 0.001;
        const consistent = diff1 < tolerance && diff2 < tolerance;

        if (!consistent) {
            console.warn(`Edge ${v1}-${v2} INCONSISTENT between faces ${face1Idx} and ${face2Idx}`);
            console.warn(`  Vertex ${v1}: diff = ${diff1.toFixed(6)}`);
            console.warn(`  Vertex ${v2}: diff = ${diff2.toFixed(6)}`);

            // Visualize the mismatch
            showSph(off1_v1, BABYLON.Color3.Red(), `F${face1Idx}_V${v1}`);
            showSph(off2_v1, BABYLON.Color3.Blue(), `F${face2Idx}_V${v1}`);
            showSph(off1_v2, BABYLON.Color3.Red(), `F${face1Idx}_V${v2}`);
            showSph(off2_v2, BABYLON.Color3.Blue(), `F${face2Idx}_V${v2}`);
        } else {
            console.log(`Edge ${v1}-${v2} consistent between faces ${face1Idx} and ${face2Idx} ✓`);
        }

        return consistent;
    }

    // Check all edges in the polyhedron for consistency
    checkAllEdges() {
        console.log("=== Checking Edge Consistency ===");
        let inconsistentCount = 0;
        const checkedEdges = new Set();

        this.origami.faces.forEach((f1, f1idx) => {
            f1.forEach((v1, i) => {
                const v2 = f1[(i + 1) % f1.length];
                const edgeKey = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;

                if (checkedEdges.has(edgeKey)) return;
                checkedEdges.add(edgeKey);

                // Find other face sharing this edge
                const faces = this.origami.findFacesContaining(v1, v2);
                if (faces.length === 2) {
                    const f2idx = faces[0] === f1idx ? faces[1] : faces[0];
                    if (!this.checkEdgeConsistency(f1idx, f2idx, [v1, v2])) {
                        inconsistentCount++;
                    }
                }
            });
        });

        console.log(`=== Total inconsistent edges: ${inconsistentCount} ===`);
        return inconsistentCount === 0;
    }

    // Visualize the computed direction at a specific vertex
    visualizeVertexDirection(vertIdx) {
        const pt = this.origami.points[vertIdx];

        // Find all faces containing this vertex
        const facesWithVert = [];
        this.origami.faces.forEach((f, fidx) => {
            if (f.includes(vertIdx)) facesWithVert.push(fidx);
        });

        console.log(`Vertex ${vertIdx} appears in faces: ${facesWithVert}`);

        // For each face, compute and show the offset direction
        facesWithVert.forEach(fidx => {
            const f = this.origami.faces[fidx];
            const offset = this.origami.computeFdir(f, fidx, 1);
            const localIdx = f.indexOf(vertIdx);
            const offsetPt = offset[localIdx];
            const dir = vsub(offsetPt, pt);

            const arrow = this.createArrow(pt, offsetPt,
                Palette[fidx % Palette.length], `F${fidx}`);
            this.debugMeshes.push(arrow);

            console.log(`  From face ${fidx}: dir = [${dir[0].toFixed(3)}, ${dir[1].toFixed(3)}, ${dir[2].toFixed(3)}], mag = ${vnorm(dir).toFixed(3)}`);
        });
    }

    // Create an arrow from p1 to p2
    createArrow(p1, p2, color, label = null) {
        const line = BABYLON.MeshBuilder.CreateLines("arrow", {
            points: [
                BABYLON.Vector3.Zero().fromArray(p1),
                BABYLON.Vector3.Zero().fromArray(p2)
            ]
        }, this.scene);
        line.color = color;

        // Add small sphere at endpoint
        const sphere = BABYLON.Mesh.CreateSphere("arrowEnd", 8, 0.15, this.scene);
        sphere.position = BABYLON.Vector3.Zero().fromArray(p2);
        const mat = new BABYLON.StandardMaterial("mat", this.scene);
        mat.diffuseColor = color;
        sphere.material = mat;

        if (label) {
            sphere.actionManager = new BABYLON.ActionManager(this.scene);
            sphere.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPickTrigger,
                    () => console.log(label)
                )
            );
        }

        this.debugMeshes.push(sphere);
        return line;
    }

    // Detect face-face intersections by checking if vertices pierce other faces
    detectIntersections() {
        console.log("=== Detecting Face Intersections ===");
        let intersectionCount = 0;

        this.origami.faces.forEach((f1, f1idx) => {
            const offset1 = this.origami.computeFdir(f1, f1idx, 1);

            // Check if any offset vertex of f1 intersects with other faces
            this.origami.faces.forEach((f2, f2idx) => {
                if (f1idx === f2idx) return;

                // Skip adjacent faces (they're supposed to touch)
                const sharedVerts = f1.filter(v => f2.includes(v));
                if (sharedVerts.length > 0) return;

                const n2 = this.origami.getNorm(f2idx);
                const refPt = this.origami.points[f2[0]];

                // Check each offset vertex of f1
                offset1.forEach((offsetPt, i) => {
                    const dist = vdot(vsub(offsetPt, refPt), n2);
                    const projection = vsub(offsetPt, smult(dist, n2));

                    // Check if projection is inside f2 polygon
                    if (this.isPointInPolygon(projection, f2, n2)) {
                        if (Math.abs(dist) < 0.1) { // tolerance
                            console.warn(`Intersection detected: Face ${f1idx} vertex ${i} penetrates face ${f2idx}`);
                            showSph(offsetPt, BABYLON.Color3.Magenta(), `F${f1idx}V${i}→F${f2idx}`);
                            intersectionCount++;
                        }
                    }
                });
            });
        });

        console.log(`=== Total intersections detected: ${intersectionCount} ===`);
        return intersectionCount === 0;
    }

    // Helper: check if point is inside a polygon (2D test in 3D)
    isPointInPolygon(pt, face, normal) {
        const faceVerts = face.map(vi => this.origami.points[vi]);

        // Use cross product test for each edge
        for (let i = 0; i < faceVerts.length; i++) {
            const v1 = faceVerts[i];
            const v2 = faceVerts[(i + 1) % faceVerts.length];
            const edge = vsub(v2, v1);
            const toPoint = vsub(pt, v1);
            const cross = vXprd(edge, toPoint);

            // If point is on wrong side of any edge, it's outside
            if (vdot(cross, normal) < -0.001) {
                return false;
            }
        }
        return true;
    }
}

// Global debug instance (will be initialized with scene and origami)
let debugHelper = null;

// Convenience functions to call from console
function initDebug() {
    if (!scene || !theOrigami) {
        console.error("Scene or theOrigami not found!");
        return;
    }
    debugHelper = new DebugHelper(scene, theOrigami);
    console.log("Debug helper initialized. Available commands:");
    console.log("  debugHelper.checkAllEdges() - Check edge consistency");
    console.log("  debugHelper.visualizeVertexDirection(vertIdx) - Show directions at vertex");
    console.log("  debugHelper.visualizeOffsetDirections(faceIdx) - Show offsets for face");
    console.log("  debugHelper.detectIntersections() - Find face intersections");
    console.log("  debugHelper.clear() - Clear debug visualizations");
}

function quickCheck() {
    if (!debugHelper) initDebug();
    debugHelper.clear();
    const edgesOk = debugHelper.checkAllEdges();
    const noIntersections = debugHelper.detectIntersections();

    if (edgesOk && noIntersections) {
        console.log("✓ No issues detected!");
    } else {
        console.log("✗ Issues found - see warnings above");
    }
}
