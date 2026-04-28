
const debugData = {
    "name": "simple",
    "pt": [[0, 0, 0], [10, 0, 0], [0, 10, 0], [0, 0, 10], [7.94964799458297, 9.81276253330089, 8.689209469509445], [12.641047038471921, 1.1759717076206728, 10.89072810815883]],
    "f": [[0, 1, 2], [0, 3, 1], [0, 2, 3], [3, 2, 4], [2, 1, 4], [1, 3, 5], [1, 5, 4], [4, 5, 3]]
};

function runDebugRepro() {
    console.log("Running Debug Reproduction...");

    // Mock Origami object
    const mockOrigami = {
        points: debugData.pt,
        faces: debugData.f,
        getDir: function (i, j, k) {
            // We need the real getDir from Origami class or reimplement it.
            // Since we are in the browser context where origami.js is loaded, 
            // we can instantiate a real Origami object if we have the scene.
            // Or we can just use the global Origami class if available.
            return new BABYLON.Vector3(0, 1, 0); // Placeholder if not available
        },
        getNorm: function (fidx) {
            // Placeholder
            return new BABYLON.Vector3(0, 1, 0);
        }
    };

    // Actually, it's better to load this into the main app.
    // We can inject this data into the current 'theOrigami' instance if it exists.
    if (typeof theOrigami !== 'undefined') {
        theOrigami.points = debugData.pt;
        theOrigami.faces = debugData.f;
        // Re-initialize other properties if needed, or just create a new one.
        // Creating a new one is safer.

        // We need 'scene' and 'theGUI' which are global in index.html
        if (typeof scene !== 'undefined' && typeof theGUI !== 'undefined') {
            theOrigami = new Origami(scene, theGUI, debugData.pt, debugData.f);
            theOrigami.updateUIDim();
            console.log("Debug data loaded into theOrigami.");

            // Now run the tracing
            console.log("Computing Medial Tracing for debug data...");
            let res = computeMedialTracing(theOrigami, 10);
            console.log("Result:", res);
        } else {
            console.error("Scene or GUI not found.");
        }
    } else {
        console.error("theOrigami not found.");
    }
}

// Expose to global scope
window.runDebugRepro = runDebugRepro;
