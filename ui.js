var ui, nameLbl;
class Ui {

    lang = "fr";
    keyCB = {};
    Controls = {};
    dimInput = null;

    cb = {
        "up": () => theOrigami.translateV([0, 1], scene),
        "down": () => theOrigami.translateV([0, -1], scene),
        "left": () => theOrigami.translateV([-1, 0], scene),
        "right": () => theOrigami.translateV([1, 0], scene),
        "rot+": () => theOrigami.rotateFace(5, scene),
        "rot-": () => theOrigami.rotateFace(-5, scene),
        "extend": () => theOrigami.extendFace(scene),
        "new": () => theOrigami.newFace(scene),
        "close": () => theOrigami.closeFacefromV(scene),
        "del": () => theOrigami.deleteFace(scene),
        "esc": () => theOrigami.unselectFace(scene),
        "save": () => theOrigami.save(),
        "open": () => theOrigami.open(scene),
        "mail": () => theOrigami.email(),
        "import": () => theOrigami.import(),
        "switch": () => theOrigami.switch(this, scene)
    }
    i18n = {
        "fr": {
            "up": ["↑", "z"],
            "down": ["↓", "s"],
            "left": ["←", "q"],
            "right": ["→", "d"],
            "rot+": ["↻", "r"],
            "rot-": ["↺", "t"],
            "extend": ["", "x"],
            "new": ["nouveau", "n"],
            "close": ["fermer", "f"],
            "del": ["effacer", "Backspace"],
            "esc": ["unselect", "Escape"],
            "save": ["enregistrer", "e"],
            "open": ["ouvrir", "o"],
            "mail": ["📧", "m"],
            "import": ["importer", "i"],
            "switch": ["mode a plat", ";", "mode 3D"]
        },
        "en": {
            "up": ["↑", "w"],
            "down": ["↓", "s"],
            "left": ["←", "a"],
            "right": ["→", "d"],
            "rot+": ["↻", "r"],
            "rot-": ["↺", "t"],
            "extend": ["", "x"],
            "new": ["new", "n"],
            "close": ["close", "c"],
            "del": ["delete", "Delete"],
            "esc": ["unselect", "Escape"],
            "save": ["save", "v"],
            "open": ["open", "o"],
            "mail": ["📧", "m"],
            "import": ["import", "i"],
            "switch": ["print mode", ";", "3D mode"]
        }
    }
    setLang(l) {
        this.lang = l;
        this.keyCB = {};
        for (const k of Object.getOwnPropertyNames(this.i18n[this.lang])) {
            this.keyCB[this.i18n[this.lang][k][1]] = this.cb[k];
            if (this.Controls[k] != null) this.Controls[k].textBlock.text = this.i18n[this.lang][k][0] + "(" + this.i18n[this.lang][k][1] + ")";
        }
    }
    createButton(name) {
        const b = BABYLON.GUI.Button.CreateSimpleButton(name, this.i18n[this.lang][name][0] + "(" + this.i18n[this.lang][name][1] + ")");
        b.cornerRadius = 10;
        b.color = "White";
        b.thickness = 1;
        b.background = "Grey";
        b.onPointerClickObservable.add(this.cb[name]);
        b.paddingLeft = 5; b.paddingRight = 5;
        b.paddingTop = 5; b.paddingBottom = 5;
        this.Controls[name] = b;
        return b;
    }
    constructor(scene) {

        scene.clearColor = new BABYLON.Color3.Black;
        const canvas = document.getElementById("renderCanvas");
        const alpha = Math.PI / 4;
        const beta = Math.PI / 3;
        const radius = 70;
        const target = new BABYLON.Vector3(0, 0, 0);
        const camera = new BABYLON.ArcRotateCamera("Camera", alpha, beta, radius, target, scene);
        camera.inputs.attached.mousewheel.wheelPrecision = 20;
        camera.inputs.attached.pointers.panningSensibility = 200;
        camera.attachControl(canvas, true);

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0));

        let g = createGround(1);


        // GUI
        ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        nameLbl = new BABYLON.GUI.TextBlock();
        nameLbl.text = "";
        nameLbl.color = "white";
        nameLbl.fontSize = 30;
        nameLbl.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        nameLbl.top = 10
        ui.addControl(nameLbl);

        let tlgrid = new BABYLON.GUI.Grid();
        tlgrid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        tlgrid.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        tlgrid.top = 5; tlgrid.left = 5; tlgrid.width = 0.4;
        tlgrid.addColumnDefinition(60, true); tlgrid.addColumnDefinition(60, true); tlgrid.addColumnDefinition(60, true);
        tlgrid.addColumnDefinition(40, true); tlgrid.addColumnDefinition(60, true);
        tlgrid.addColumnDefinition(40, true); tlgrid.addColumnDefinition(100, true);
        tlgrid.addRowDefinition(40, true); tlgrid.addRowDefinition(40, true);
        ui.addControl(tlgrid);
        tlgrid.addControl(this.createButton("up"), 0, 1);
        tlgrid.addControl(this.createButton("down"), 1, 1);
        tlgrid.addControl(this.createButton("left"), 1, 0);
        tlgrid.addControl(this.createButton("right"), 1, 2);
        tlgrid.addControl(this.createButton("rot-"), 0, 4);
        tlgrid.addControl(this.createButton("rot+"), 1, 4);
        tlgrid.addControl(this.createButton("close"), 0, 6);
        let nouv = this.createButton("new");
        nouv.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        nouv.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        nouv.width = "120px"; nouv.height = "40px";
        ui.addControl(nouv);
        let panel = new BABYLON.GUI.Grid();
        panel.addRowDefinition(40, true);
        panel.addColumnDefinition(0.35); panel.addColumnDefinition(0.22); panel.addColumnDefinition(0.18); panel.addColumnDefinition(0.25);
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        panel.width = "400px"; panel.height = "40px";

        panel.addControl(this.createButton("save"), 0, 0);
        panel.addControl(this.createButton("open"), 0, 1);
        panel.addControl(this.createButton("mail"), 0, 2);
        panel.addControl(this.createButton("import"), 0, 3);
        ui.addControl(panel);

        //language selection
        let langPanel = new BABYLON.GUI.StackPanel();
        langPanel.addControl(this.addRadio("fr", langPanel, true));
        langPanel.addControl(this.addRadio("en", langPanel));

        let rect = new BABYLON.GUI.Rectangle();
        rect.width = "120px";
        rect.height = "70px";
        rect.left = 5;
        rect.thickness = 0;
        rect.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        rect.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        rect.addControl(langPanel);
        ui.addControl(rect);

        // switch mode 3D/plane
        let sw = this.createButton("switch");
        //sw.horizontalAlignment=BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        //sw.verticalAlignment=BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        //sw.left="70px";
        sw.width = "130px";
        sw.height = "40px";
        sw.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

        // manage object size
        this.dimInput = new BABYLON.GUI.InputText();
        this.dimInput.width = "80px";
        this.dimInput.maxWidth = "80px";
        this.dimInput.height = "30px";
        this.dimInput.text = "20";
        this.dimInput.color = "white";
        this.dimInput.background = "green";
        this.dimInput.onTextChangedObservable.add((ev) => {
            if (ev.text == "") return;
            theOrigami.setDimension(parseInt(ev.text), scene);
        });
        const header = BABYLON.GUI.Control.AddHeader(this.dimInput, "Dimension:", "100px", { isHorizontal: true, controlFirst: false });
        header.height = "30px";
        header.color = "White";
        //header.horizontalAlignment=BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

        let gPanel = new BABYLON.GUI.StackPanel();
        gPanel.isVertical = false;
        gPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        gPanel.height = "40px";
        let gLbl = new BABYLON.GUI.TextBlock();
        gLbl.text = "Ground:";
        gLbl.color = "white";
        gLbl.width = "80px";
        gPanel.addControl(gLbl);

        let gminus = BABYLON.GUI.Button.CreateSimpleButton("g-", "-");
        gminus.cornerRadius = 10;
        gminus.color = "White";
        gminus.thickness = 1;
        gminus.background = "Grey";
        gminus.height = "30px";
        gminus.width = "30px";
        gminus.onPointerClickObservable.add(() => {
            if (g.lines.length > 0) {
                gTxt.text = g.lines.length;
                g = createGround(g.lines.length, g);
            }
        });
        gPanel.addControl(gminus);

        let gTxt = new BABYLON.GUI.TextBlock();
        gTxt.text = "1";
        gTxt.color = "white";
        gTxt.width = "40px";
        gPanel.addControl(gTxt);
        let gplus = BABYLON.GUI.Button.CreateSimpleButton("g+", "+");
        gplus.cornerRadius = 10;
        gplus.color = "White";
        gplus.thickness = 1;
        gplus.background = "Grey";
        gplus.height = "30px";
        gplus.width = "30px";
        gplus.onPointerClickObservable.add(() => {
            gTxt.text = g.lines.length + 2;
            g = createGround(g.lines.length + 2, g);
        });
        gPanel.addControl(gplus);

        // SAT overlap test for two convex polygons (CCW or CW), with gap.
        // Returns true if they overlap or are within `gap` distance.
        const projectPoly = (poly, ax, az) => {
            let min = Infinity, max = -Infinity;
            for (const [px, pz] of poly) {
                const d = px * ax + pz * az;
                if (d < min) min = d;
                if (d > max) max = d;
            }
            return [min, max];
        };
        const polysOverlap = (a, b, gap) => {
            for (const poly of [a, b]) {
                for (let i = 0; i < poly.length; i++) {
                    const j = (i + 1) % poly.length;
                    const ex = poly[j][0] - poly[i][0];
                    const ez = poly[j][1] - poly[i][1];
                    const len = Math.hypot(ex, ez);
                    if (len < 1e-9) continue;
                    const ax = -ez / len, az = ex / len;  // unit normal to edge
                    const [aMin, aMax] = projectPoly(a, ax, az);
                    const [bMin, bMax] = projectPoly(b, ax, az);
                    if (aMax + gap < bMin || bMax + gap < aMin) return false;
                }
            }
            return true;
        };

        // Bottom-left-fill packer for convex polygons with 90° rotation.
        // Uses SAT for tight nesting; AABB pre-filter for speed.
        const packBLF = (footprints, plateW, plateH, gap, nbPlates) => {
            const sorted = [...footprints].sort((a, b) => b.area - a.area);
            const placements = [];
            const platesPlaced = Array.from({ length: nbPlates }, () => []);
            const aabbHit = (a, b, g) => !(
                a.maxX + g < b.minX || b.maxX + g < a.minX ||
                a.maxZ + g < b.minZ || b.maxZ + g < a.minZ
            );
            for (const fp of sorted) {
                let placed = false;
                for (let plateIdx = 0; plateIdx < nbPlates && !placed; plateIdx++) {
                    const plateCx = plateW * (plateIdx - (nbPlates - 1));
                    const xLoP = plateCx - plateW / 2 + gap / 2;
                    const xHiP = plateCx + plateW / 2 - gap / 2;
                    const zLoP = -plateH / 2 + gap / 2;
                    const zHiP = plateH / 2 - gap / 2;
                    for (const rotDeg of [0, 90, 180, 270]) {
                        const rad = rotDeg * Math.PI / 180;
                        const cs = Math.cos(rad), sn = Math.sin(rad);
                        const rv = fp.vertices2D.map(([x, z]) => [cs * x - sn * z, sn * x + cs * z]);
                        const xs = rv.map(v => v[0]), zs = rv.map(v => v[1]);
                        const minX = Math.min(...xs), maxX = Math.max(...xs);
                        const minZ = Math.min(...zs), maxZ = Math.max(...zs);
                        if (maxX - minX > xHiP - xLoP) continue;
                        if (maxZ - minZ > zHiP - zLoP) continue;
                        const step = 0.25;
                        let foundX = null, foundZ = null;
                        for (let z = zLoP - minZ; z + maxZ <= zHiP + 1e-6 && foundZ === null; z += step) {
                            for (let x = xLoP - minX; x + maxX <= xHiP + 1e-6; x += step) {
                                const candAABB = { minX: minX + x, maxX: maxX + x, minZ: minZ + z, maxZ: maxZ + z };
                                const candPoly = rv.map(([px, pz]) => [px + x, pz + z]);
                                let overlaps = false;
                                for (const ex of platesPlaced[plateIdx]) {
                                    if (!aabbHit(candAABB, ex.aabb, gap)) continue;
                                    if (polysOverlap(candPoly, ex.poly, gap)) { overlaps = true; break; }
                                }
                                if (overlaps) continue;
                                foundX = x; foundZ = z;
                                break;
                            }
                        }
                        if (foundX !== null) {
                            const finalPoly = rv.map(([px, pz]) => [px + foundX, pz + foundZ]);
                            const fxs = finalPoly.map(p => p[0]), fzs = finalPoly.map(p => p[1]);
                            placements.push({ i: fp.i, plateIdx, x: foundX, z: foundZ, rotation: rotDeg });
                            platesPlaced[plateIdx].push({
                                poly: finalPoly,
                                aabb: { minX: Math.min(...fxs), maxX: Math.max(...fxs), minZ: Math.min(...fzs), maxZ: Math.max(...fzs) }
                            });
                            placed = true;
                            break;
                        }
                    }
                }
                if (!placed) return null;
            }
            return placements;
        };

        const autoArrangeFlat = () => {
            const gap = 1;
            const efficiency = 0.7;
            const footprints = theOrigami.faces.map((f, i) => ({
                i,
                vertices2D: theOrigami.getFaceFootprint2D(i),
                area: theOrigami.getFaceFootprintArea(i)
            }));
            const totalArea = footprints.reduce((s, fp) => s + fp.area, 0);
            const minPlates = Math.max(1, Math.ceil(totalArea / (gW * gH * efficiency)));
            // Try `nb` plates from minPlates upward until packing succeeds.
            let placements = null, used = minPlates;
            for (let nb = minPlates; nb <= minPlates + 4; nb++) {
                placements = packBLF(footprints, gW, gH, gap, nb);
                if (placements) { used = nb; break; }
            }
            if (!placements) {
                console.warn("autoArrangeFlat: failed to pack within " + (minPlates + 4) + " plates");
                return;
            }
            // Update ground to the chosen plate count.
            if (used !== g.lines.length + 1) {
                gTxt.text = String(used);
                g = createGround(used, g);
            }
            theOrigami.applyFlatLayout(placements, scene);
            console.log(`autoArrangeFlat: ${placements.length} pieces on ${used} plate(s) (area ratio ${(totalArea / (gW * gH * used)).toFixed(2)})`);
        };

        // Inset thickness slider — controls per-face slab depth in real time.
        let thickPanel = new BABYLON.GUI.StackPanel();
        thickPanel.isVertical = false;
        thickPanel.height = "30px";
        const thickLbl = new BABYLON.GUI.TextBlock();
        thickLbl.text = "Thickness:";
        thickLbl.color = "white";
        thickLbl.width = "100px";
        thickPanel.addControl(thickLbl);
        const thickValLbl = new BABYLON.GUI.TextBlock();
        thickValLbl.text = "1.00";
        thickValLbl.color = "white";
        thickValLbl.width = "40px";
        const thickSlider = new BABYLON.GUI.Slider();
        thickSlider.minimum = 0.05;
        thickSlider.maximum = 5;
        thickSlider.value = 1;
        thickSlider.height = "20px";
        thickSlider.width = "150px";
        thickSlider.color = "white";
        thickSlider.background = "grey";
        thickSlider.onValueChangedObservable.add(value => {
            thickValLbl.text = value.toFixed(2);
            theOrigami.setInsetDepth(value, scene);
        });
        thickPanel.addControl(thickSlider);
        thickPanel.addControl(thickValLbl);

        const arrangeBtn = BABYLON.GUI.Button.CreateSimpleButton("arrange", "Auto layout");
        arrangeBtn.cornerRadius = 10;
        arrangeBtn.color = "White";
        arrangeBtn.thickness = 1;
        arrangeBtn.background = "Grey";
        arrangeBtn.height = "30px";
        arrangeBtn.width = "120px";
        arrangeBtn.onPointerClickObservable.add(autoArrangeFlat);

        let swPanel = new BABYLON.GUI.StackPanel();
        swPanel.addControl(gPanel);
        swPanel.addControl(header);
        swPanel.addControl(thickPanel);
        swPanel.addControl(arrangeBtn);
        swPanel.addControl(sw);

        swPanel.left = "90px";
        swPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        swPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        swPanel.adaptWidthToChildren = true;
        ui.addControl(swPanel);

        scene.onKeyboardObservable.add((kbInfo) => {
            console.log(kbInfo.event.key);
            if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYDOWN
                && this.keyCB[kbInfo.event.key]
                && !kbInfo.event.altKey
                && !kbInfo.event.ctrlKey
                && !kbInfo.event.metaKey)
                this.keyCB[kbInfo.event.key]();
            else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP &&
                kbInfo.event.key == "c" &&
                kbInfo.event.ctrlKey) {
                //console.log("copy");
                //theOrigami.writeToClip(scene);
                let med = computeMedial(theOrigami, 1), str = "data=[\n";
                theOrigami.faces.forEach((f, fi) => {
                    let wm = theOrigami.faceMeshes[fi].getWorldMatrix(true);
                    let r = theOrigami.getScadPolyhedron(fi, med);
                    str += "[[";
                    r.pt.forEach(p => {
                        let lp = global(p, wm);
                        str += "[" + lp.x + "," + lp.y + "," + lp.z + "],";
                    });
                    str += "],\n";
                    str += "[";
                    r.idx.forEach(p => str += "[" + p + "],");
                    str += "]],\n";
                });
                str += "];"
                navigator.clipboard.writeText(str);
            } else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP &&
                kbInfo.event.key == "b" &&
                kbInfo.event.ctrlKey) {
                //console.log("copy");
                //theOrigami.writeToClip(scene);
                let med = computeMedial(theOrigami, 1), str = "";
                theOrigami.faces.forEach((f, fi) => {
                    let wm = theOrigami.faceMeshes[fi].getWorldMatrix(true);
                    let r = theOrigami.getScadPolyhedron(fi, med);
                    r.idx[r.idx.length - 1].forEach((idx, i) => {
                        let lp = global(r.pt[idx], wm);
                        str += (i == 0 ? "M " : "L ");
                        str += (lp.x + " " + lp.z + " ");
                    });
                    str += "z\n";
                    navigator.clipboard.writeText(str);
                });
            } else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP &&
                kbInfo.event.key.toLowerCase() == "v" &&
                kbInfo.event.altKey) {
                console.log("Computing Medial Axis (Tracing)...");
                let maxThickness = parseFloat(this.dimInput.text) || 10;
                let res = computeMedialTracing(theOrigami, maxThickness);

                // Clear previous visualization
                let prev = scene.getMeshesByTags("medial_vis");
                prev.forEach(m => m.dispose());

                if (theOrigami.expected) {
                    // Harness owns all rendering when a fixture is loaded:
                    // dedupes actuals, colors by match status, overlays expected.
                    runHarness(scene, res);
                } else {
                    // Plain visualisation for user shapes: red seams, blue junctions.
                    // Dedup geometric duplicates (degenerate vertices spawn multiple
                    // entries at the same point/line with different gov sets).
                    const dedupTol = 1e-3;
                    const dedJ = _dedupeJunctions(res.junctions, dedupTol);
                    const dedS = _dedupeSeams(res.seams, dedupTol);
                    console.log(`Dedup: junctions ${res.junctions.length} -> ${dedJ.length}, seams ${res.seams.length} -> ${dedS.length}`);
                    dedS.forEach(s => {
                        let pts = [
                            new BABYLON.Vector3(s.start[0], s.start[1], s.start[2]),
                            new BABYLON.Vector3(s.end[0], s.end[1], s.end[2])
                        ];
                        let line = BABYLON.MeshBuilder.CreateLines("seam", { points: pts }, scene);
                        line.color = new BABYLON.Color3(1, 0, 0);
                        line.renderingGroupId = 1;
                        BABYLON.Tags.AddTagsTo(line, "medial_vis");
                    });
                    dedJ.forEach(j => {
                        let sphere = BABYLON.MeshBuilder.CreateSphere("junction", { diameter: 0.5 }, scene);
                        sphere.position = new BABYLON.Vector3(j.pt[0], j.pt[1], j.pt[2]);
                        sphere.material = new BABYLON.StandardMaterial("mat", scene);
                        sphere.material.diffuseColor = new BABYLON.Color3(0, 0, 1);
                        sphere.material.disableDepthTest = true;
                        sphere.renderingGroupId = 1;
                        BABYLON.Tags.AddTagsTo(sphere, "medial_vis");
                    });
                }

                console.log(`Generated ${res.seams.length} seams and ${res.junctions.length} junctions.`);
            } else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP &&
                kbInfo.event.key.toLowerCase() == "i" &&
                kbInfo.event.altKey) {
                // Inset prism preview: trace medial axis, build per-face
                // inset polyhedron, render each as a translucent mesh.
                console.log("Computing inset prisms...");
                const maxThickness = parseFloat(this.dimInput.text) || 10;
                const insetDepth = 1;
                const med = computeMedialTracing(theOrigami, maxThickness);
                scene.getMeshesByTags("inset_vis").forEach(m => m.dispose());
                theOrigami.faces.forEach((f, fidx) => {
                    const r = theOrigami.getInsetPolyhedron(fidx, med, insetDepth);
                    const customMesh = {
                        name: "InsetPrism", category: ["Prism"],
                        vertex: r.pt,
                        face: r.idx
                    };
                    const mesh = BABYLON.MeshBuilder.CreatePolyhedron("inset[" + fidx + "]",
                        { custom: customMesh }, scene);
                    const mat = new BABYLON.StandardMaterial("insetMat" + fidx, scene);
                    mat.diffuseColor = Palette[fidx % Palette.length];
                    mat.alpha = 0.6;
                    mat.backFaceCulling = false;
                    mesh.material = mat;
                    BABYLON.Tags.AddTagsTo(mesh, "inset_vis");
                });
                console.log(`Built ${theOrigami.faces.length} inset prisms.`);
            }
        });

        //mouse handling

        let startingPoint;
        let currentMesh;
        const getGroundPosition = function () {
            var pickinfo = scene.pick(scene.pointerX, scene.pointerY, function (mesh) { return mesh.name == "ground"; });
            return pickinfo.hit ? pickinfo.pickedPoint : null;
        }

        const pointerDown = function (mesh) {
            if (theOrigami.planMode) {
                currentMesh = mesh;
                //console.log("-->>"+mesh.name+";"+theOrigami.faceMeshes.indexOf(mesh));
                startingPoint = getGroundPosition();
                if (startingPoint) { // we need to disconnect camera from canvas
                    setTimeout(function () {
                        camera.detachControl(canvas);
                    }, 0);
                }
                theOrigami.selectedF = theOrigami.getFace(mesh);
            }
        }

        const pointerUp = function () {
            if (startingPoint) {
                camera.attachControl(canvas, true);
                startingPoint = null;
                return;
            }
        }

        const pointerMove = function () {
            if (!startingPoint) {
                return;
            }
            var current = getGroundPosition();
            if (!current) {
                return;
            }

            var diff = current.subtract(startingPoint);
            currentMesh.position.addInPlace(diff);

            startingPoint = current;
        }

        scene.onPointerObservable.add((pointerInfo => {
            switch (pointerInfo.type) {
                case BABYLON.PointerEventTypes.POINTERDOWN:
                    if (pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh.name != "ground") {
                        pointerDown(pointerInfo.pickInfo.pickedMesh)
                    }
                    break;
                case BABYLON.PointerEventTypes.POINTERUP:
                    pointerUp();
                    break;
                case BABYLON.PointerEventTypes.POINTERMOVE:
                    pointerMove();
                    break;
            }
        }));
        this.setLang(this.lang);
    }
    addRadio(text, parent, check = false) {
        const button = new BABYLON.GUI.RadioButton();
        button.width = "20px";
        button.height = "20px";
        button.color = "white";
        button.background = "green";
        button.isChecked = check;
        const _ui = this;
        button.onIsCheckedChangedObservable.add(function (state) {
            if (state) {
                _ui.setLang(text);
            }
        });
        const header = BABYLON.GUI.Control.AddHeader(button, text, "80px", { isHorizontal: true, controlFirst: true });
        header.height = "30px";
        header.color = "White";
        return header;
    }
    switchMode(planMode) {
        this.Controls["switch"].textBlock.text = (planMode ? this.i18n[this.lang]["switch"][2] : this.i18n[this.lang]["switch"][0]) +
            "(" + this.i18n[this.lang]["switch"][1] + ")";
    }
    setName(n) {
        nameLbl.text = n;
    }

}

//Modal callbacks

const openModal = new bootstrap.Modal('#openDialog');
const pattern = (active, name, i) => `<button type="button" class="list-group-item list-group-item-action ${active}" id="list-${i}-list">${name}</button>`;
const theList = document.getElementById("openList");

theList.addEventListener("click", e => {
    const item = e.target.closest('.list-group-item');
    if (!item) return;
    theList.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
});

document.getElementById('openButton').addEventListener("click", e => {
    let selected = theList.querySelector('.active').innerHTML;
    openModal.hide();
    load(selected);

});
function load(name) {
    if (!localStorage.hasOwnProperty(name)) {
        console.log(name + " not found in storage!");
        return;
    }
    const toOpen = JSON.parse(localStorage[name]);
    theOrigami.disposeAll();
    let q = null, p = null;
    if (toOpen.hasOwnProperty("fQuat")) {
        p = [];
        q = [];
        toOpen.fQuat.forEach(qa => {
            q.push(new BABYLON.Quaternion(qa._x, qa._y, qa._z, qa._w));
        });
        toOpen.fPos.forEach(po => p.push(new BABYLON.Vector3(po._x, po._y, po._z)));
    }
    theOrigami = new Origami(scene, theOrigami.GUI, toOpen.pt, toOpen.f, name, p, q);
    theOrigami.expected = toOpen.expected || null;
    theOrigami.updateUIDim();
}

const saveModal = new bootstrap.Modal('#saveDialog');
const txt = document.getElementById("origamiName");
document.getElementById('saveButton').addEventListener("click", e => {
    theOrigami.name = document.getElementById("origamiName").value;
    nameLbl.text = theOrigami.name;
    saveModal.hide();
    let saved = [];
    if (localStorage.hasOwnProperty("saved")) saved = JSON.parse(localStorage.saved);
    if (!saved.includes(theOrigami.name)) { saved.push(theOrigami.name); localStorage.saved = JSON.stringify(saved); }
    let value = { pt: theOrigami.points, f: theOrigami.faces, fPos: theOrigami.flatPos, fQuat: theOrigami.flatQuat };
    localStorage.setItem(theOrigami.name, JSON.stringify(value));
});

const importModal = new bootstrap.Modal('#importDialog');
const impName = document.getElementById("importName");
const impDat = document.getElementById("importData");
document.getElementById('importButton').addEventListener("click", e => {
    if (impName.value == null || impName.value == "") { alert("Entrez un nom avant import"); return; }
    let toImport = null;
    try { toImport = JSON.parse(impDat.value); }
    catch (e) {
        alert("Données invalides!"); return;
    }
    importModal.hide();
    let saved = [];
    if (localStorage.hasOwnProperty("saved")) saved = JSON.parse(localStorage.saved);
    if (!saved.includes(impName.value)) { saved.push(impName.value); localStorage.saved = JSON.stringify(saved); }
    let value = { pt: toImport.pt, f: toImport.f, fPos: toImport.fPos, fQuat: toImport.fQuat };
    localStorage.setItem(impName.value, JSON.stringify(value));
});

const gW = 30; gH = 30;
function createGround(nb, old = null) {
    if (old != null) {
        old.ground.dispose();
        old.lines.forEach(l => l.dispose());
    }
    const g = BABYLON.MeshBuilder.CreateGround("ground", { width: gW * nb, height: gH });
    g.position = new BABYLON.Vector3(gW * (1 - nb) * 0.5, 0, 0)
    const l = []
    for (let i = 0; i < nb - 1; ++i) {
        l.push(BABYLON.MeshBuilder.CreateLines("gl1", { points: [new BABYLON.Vector3(gW * (-0.5 - i), 0, gH / 2), new BABYLON.Vector3(gW * (-0.5 - i), 0, -gH / 2)] }));
        l[i].color = new BABYLON.Color3(0, 0, 0);
        l[i].isPickable = false;
    }
    return { ground: g, lines: l };
}
