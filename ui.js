var ui, nameLbl;
class Ui {

    lang = "fr";
    keyCB = {};
    Controls = {};
    dimInput = null;
    // Tool parameters; persisted across origami loads (not per-design).
    cutterOpts = { margin: 0.1, height: 2, thickness: 0.15, baseWidth: 1, moldWidth: 1, moldHeight: 0.8, tabRadius: 0.5, angle: 55, snapAlpha: 35, snapDepth: 1.0, snapWidth: 0.6, play: 0.05, useScrews: true };

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
        "esc": () => {
            // Tear down Alt+M / Alt+K previews and restore any face meshes
            // hidden by Alt+K, so a single Esc gets back to the bare polygon.
            scene.getMeshesByTags("mold_vis").forEach(m => m.dispose());
            scene.getMeshesByTags("cutter_vis").forEach(m => m.dispose());
            theOrigami.faceMeshes.forEach(fm => { if (fm) fm.isVisible = true; });
            theOrigami.unselectFace(scene);
        },
        "save": () => theOrigami.save(),
        "open": () => theOrigami.open(scene),
        "mail": () => theOrigami.email(),
        "import": () => theOrigami.import(),
        "switch": () => theOrigami.switch(this, scene),
        "cutterOpt": () => {
            const o = theGUI.cutterOpts;
            document.getElementById("cutterMargin").value = o.margin;
            document.getElementById("cutterHeight").value = o.height;
            document.getElementById("cutterThickness").value = o.thickness;
            document.getElementById("cutterBaseWidth").value = o.baseWidth;
            document.getElementById("cutterMoldWidth").value = o.moldWidth;
            document.getElementById("cutterMoldHeight").value = o.moldHeight;
            document.getElementById("cutterTabRadius").value = o.tabRadius;
            document.getElementById("cutterAngle").value = o.angle;
            cutterOptModal.show();
        }
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
            "switch": ["mode a plat", ";", "mode 3D"],
            "cutterOpt": ["⚙", "h"],
            "exportAll": ["Exporter tout"],
            "cutterOptTitle": ["Options du cutter"],
            "marginField": ["Marge (cm):"],
            "heightField": ["Hauteur (cm):"],
            "thicknessField": ["Épaisseur (cm):"],
            "baseWidthField": ["Largeur de base (cm):"],
            "moldWidthField": ["Largeur de base du moule (cm):"],
            "moldHeightField": ["Hauteur du moule (cm):"],
            "tabRadiusField": ["Rayon onglet (cm):"],
            "angleField": ["Angle onglet (°):"],
            "noSelectionTitle": ["Sélection requise"],
            "noSelectionMsg": ["Sélectionnez une face d'abord"],
            "cancelBtn": ["Annuler"],
            "okBtn": ["OK"]
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
            "switch": ["print mode", ";", "3D mode"],
            "cutterOpt": ["⚙", "h"],
            "exportAll": ["Export all"],
            "cutterOptTitle": ["Cutter options"],
            "marginField": ["Margin (cm):"],
            "heightField": ["Height (cm):"],
            "thicknessField": ["Thickness (cm):"],
            "baseWidthField": ["Base width (cm):"],
            "moldWidthField": ["Mold base width (cm):"],
            "moldHeightField": ["Mold height (cm):"],
            "tabRadiusField": ["Tab radius (cm):"],
            "angleField": ["Tab angle (°):"],
            "noSelectionTitle": ["Selection required"],
            "noSelectionMsg": ["Select a face first"],
            "cancelBtn": ["Cancel"],
            "okBtn": ["OK"]
        }
    }
    setLang(l) {
        this.lang = l;
        this.keyCB = {};
        for (const k of Object.getOwnPropertyNames(this.i18n[this.lang])) {
            const entry = this.i18n[this.lang][k];
            if (entry[1] && this.cb[k]) this.keyCB[entry[1]] = this.cb[k];
            if (this.Controls[k] != null) {
                this.Controls[k].textBlock.text = entry[1]
                    ? entry[0] + "(" + entry[1] + ")"
                    : entry[0];
            }
        }
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const entry = this.i18n[this.lang][el.getAttribute('data-i18n')];
            if (entry) el.textContent = entry[0];
        });
    }
    createButton(name) {
        const entry = this.i18n[this.lang][name];
        const label = entry[1] ? entry[0] + "(" + entry[1] + ")" : entry[0];
        const b = BABYLON.GUI.Button.CreateSimpleButton(name, label);
        b.cornerRadius = 10;
        b.color = "White";
        b.thickness = 1;
        b.background = "Grey";
        if (this.cb[name]) b.onPointerClickObservable.add(this.cb[name]);
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
        tlgrid.addColumnDefinition(100, true);
        tlgrid.addRowDefinition(40, true); tlgrid.addRowDefinition(40, true);
        ui.addControl(tlgrid);
        tlgrid.addControl(this.createButton("up"), 0, 1);
        tlgrid.addControl(this.createButton("down"), 1, 1);
        tlgrid.addControl(this.createButton("left"), 1, 0);
        tlgrid.addControl(this.createButton("right"), 1, 2);
        tlgrid.addControl(this.createButton("rot-"), 0, 4);
        tlgrid.addControl(this.createButton("rot+"), 1, 4);
        tlgrid.addControl(this.createButton("close"), 0, 6);
        tlgrid.addControl(this.createButton("del"), 0, 7);
        tlgrid.addControl(this.createButton("cutterOpt"), 1, 6);
        // Top-right toolbar: Export All (left) + New (right). Click
        // handler for Export All is wired below where the STL helpers are
        // in scope.
        let topRight = new BABYLON.GUI.Grid();
        topRight.addRowDefinition(40, true);
        topRight.addColumnDefinition(150, true);
        topRight.addColumnDefinition(120, true);
        topRight.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        topRight.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        topRight.width = "270px"; topRight.height = "40px";
        const expAllBtn = this.createButton("exportAll");
        topRight.addControl(expAllBtn, 0, 0);
        topRight.addControl(this.createButton("new"), 0, 1);
        ui.addControl(topRight);
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
        this.dimInput.text = "25";
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

        // Toggle alpha on all face/mold/cutter meshes between the default
        // translucent (0.5) and fully opaque (1.0). Useful for inspecting
        // overlaps between adjacent face molds, which are hard to see
        // through the default translucency. Re-applies on click — new
        // meshes added after toggling stay at their build-time alpha until
        // the user clicks again.
        let allOpaque = false;
        const opaqueBtn = BABYLON.GUI.Button.CreateSimpleButton("opaqueToggle", "Opaque: off");
        opaqueBtn.cornerRadius = 10;
        opaqueBtn.color = "White";
        opaqueBtn.thickness = 1;
        opaqueBtn.background = "Grey";
        opaqueBtn.height = "30px";
        opaqueBtn.width = "120px";
        opaqueBtn.onPointerClickObservable.add(() => {
            allOpaque = !allOpaque;
            const targetAlpha = allOpaque ? 1.0 : 0.5;
            scene.meshes.forEach(m => {
                if (!m.material) return;
                if (m.name === "ground") return;
                if (m.name && (m.name.startsWith("gl")
                            || m.name.startsWith("seam")
                            || m.name.startsWith("junction"))) return;
                m.material.alpha = targetAlpha;
            });
            opaqueBtn.textBlock.text = `Opaque: ${allOpaque ? 'on' : 'off'}`;
        });

        let swPanel = new BABYLON.GUI.StackPanel();
        swPanel.addControl(gPanel);
        swPanel.addControl(header);
        swPanel.addControl(thickPanel);
        swPanel.addControl(arrangeBtn);
        swPanel.addControl(opaqueBtn);
        swPanel.addControl(sw);

        swPanel.left = "90px";
        swPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        swPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        swPanel.adaptWidthToChildren = true;
        ui.addControl(swPanel);

        // Build all meshes for one face's mold piece (mold body + tabs +
        // snaps), CSG holes applied. Caller tags or exports them and is
        // responsible for disposal. Used by both Alt+M (preview) and Alt+E
        // (STL export).
        const buildFaceMold = (fidx, opts) => {
            const face = theOrigami.faces[fidx];
            const meshes = [];

            const r = theOrigami.getMoldPolyhedron(fidx, opts);
            const baseMesh = BABYLON.MeshBuilder.CreatePolyhedron("mold[" + fidx + "]_base",
                { custom: { name: "Mold", category: ["Prism"], vertex: r.pt, face: r.idx } },
                scene);
            const mat = new BABYLON.StandardMaterial("moldMat" + fidx, scene);
            mat.diffuseColor = Palette[fidx % Palette.length];
            mat.alpha = 0.5;
            mat.backFaceCulling = false;
            baseMesh.material = mat;

            const Nf = face.length;
            const n_f = theOrigami.getNorm(fidx);
            // Per-face-vertex wall heights after clipping (medial junction
            // + lateral cap). null when no clipping was applied → fall back
            // to the uniform opts.moldHeight everywhere. Used to recenter
            // screw holes at the actual wall midline.
            const heightAt = r.heightAt;
            const wallHeightAtFrac = (edgeIdx, frac) => {
                if (!heightAt) return opts.moldHeight;
                const hi = heightAt[edgeIdx];
                const hj = heightAt[(edgeIdx + 1) % Nf];
                return hi * (1 - frac) + hj * frac;
            };
            // Mold extrudes in -n_f (outward from polyhedron), matching
            // getCutterPolyhedron. Build-plate transform then sends -n_f
            // to +z so the print lands face-on-bed.
            const upDir = smult(-1, n_f);
            // Assembly method: screws (default) use a 4mm clearance hole
            // through the wall on the male side, plus a 6mm boss and 3.6mm
            // pilot hole on the female side. Snapfit uses the legacy
            // cantilever snap features built further below.
            const useScrews = opts.useScrews ?? true;
            const T = opts.thickness;
            const baseRm = opts.tabRadius;
            const angleDeg = opts.angle ?? 55;
            const sinHalfAngle = Math.sin((angleDeg / 2) * Math.PI / 180);
            const edgeData = [];
            for (let edgeIdx = 0; edgeIdx < Nf; edgeIdx++) {
                const v_i = theOrigami.points[face[edgeIdx]];
                const v_j = theOrigami.points[face[(edgeIdx + 1) % Nf]];
                const edgeVec = vsub(v_j, v_i);
                const edgeLen = vnorm(edgeVec);
                const edgeDir = smult(1 / edgeLen, edgeVec);
                const outDir = vnormalize(vXprd(edgeDir, n_f));
                let alpha = 0;
                const adj = theOrigami.findVOtherFaceContaining(
                    face[edgeIdx], face[(edgeIdx + 1) % Nf], fidx);
                if (adj) {
                    const n_adj = theOrigami.getNorm(adj[0]);
                    const dot = Math.max(-1, Math.min(1, vdot(n_f, n_adj)));
                    alpha = Math.acos(dot) / 2;
                    // Signed alpha: concave dihedrals flip the slope so
                    // walls/tabs tilt toward the polyhedron-interior-side
                    // bisector and mate properly with the adjacent face's
                    // mold. See origami.js getCutterPolyhedron for the
                    // same detection.
                    if (vdot(vXprd(n_f, n_adj), edgeDir) > 0) alpha = -alpha;
                }
                const sDir = vnormalize(vadd(upDir, smult(Math.tan(alpha), outDir)));
                const wDir = vnormalize(vXprd(edgeDir, sDir));
                let rm = baseRm;
                const halfBaseFull = rm / sinHalfAngle;
                const slack = 0.25 * edgeLen;
                if (halfBaseFull > slack) rm = slack * sinHalfAngle * 0.95;
                const tabWDirDepth = T * Math.cos(alpha);
                edgeData.push({ v_i, edgeVec, sDir, wDir, rm, alpha, tabWDirDepth });
            }

            // Build the body manifold straight from the polyhedron description
            // — bypasses Babylon's per-face vertex split + merge() tolerance
            // gamble, which can leave the body marginally non-manifold
            // (visible as MeshMixer "stripes" inside the engraving).
            let mesh;
            let bodyM = window.manifold ? polyhedronToManifold(r.pt, r.idx) : null;

            // Clip the body manifold so it can't intrude into neighboring
            // molds' territories. Two passes:
            //   (a) For each edge of F that has an edge-adjacent face F',
            //       clip by the dihedral bisector plane (contains the edge,
            //       bisects the F–F' dihedral).
            //   (b) For each vertex V of F, for every OTHER face F'' that's
            //       incident to V but does NOT share an edge with F at V,
            //       clip by a vertex-separator plane through V with normal
            //       (n_F'' − n_F). F's mold extends in −n_F (into the
            //       polyhedron interior), which projects positively onto
            //       (n_F'' − n_F), so we keep that side. Without (b), at a
            //       many-valent vertex (e.g. 5 faces meeting at V1) F can
            //       overlap with non-edge-adjacent faces like F4/F5.
            if (bodyM && window.manifold) {
                const fCentroid = face.reduce(
                    (acc, pi) => vadd(acc, theOrigami.points[pi]), [0, 0, 0]);
                const fCentroidNorm = smult(1 / Nf, fCentroid);

                // Pass (a): edge-adjacent dihedral bisector clipping.
                const adjAtEdge = []; // [edgeIdx] → other-face index (or -1)
                for (let edgeIdx = 0; edgeIdx < Nf; edgeIdx++) {
                    const va = theOrigami.points[face[edgeIdx]];
                    const vb = theOrigami.points[face[(edgeIdx + 1) % Nf]];
                    const adj = theOrigami.findVOtherFaceContaining(
                        face[edgeIdx], face[(edgeIdx + 1) % Nf], fidx);
                    adjAtEdge.push(adj ? adj[0] : -1);
                    if (!adj) continue; // boundary edge, no neighbor
                    const n_adj = theOrigami.getNorm(adj[0]);
                    const edgeDir = vnormalize(vsub(vb, va));
                    const outDirF  = vnormalize(vXprd(edgeDir, n_f));
                    const outDirFp = smult(-1, vnormalize(vXprd(edgeDir, n_adj)));
                    const sum = vadd(outDirF, outDirFp);
                    if (vdot(sum, sum) < 1e-9) continue; // flat dihedral
                    const bisectorInPlane = vnormalize(sum);
                    const bisectorN = vnormalize(vXprd(edgeDir, bisectorInPlane));
                    const signedDist = vdot(vsub(fCentroidNorm, va), bisectorN);
                    if (Math.abs(signedDist) < 1e-9) continue;
                    const normalToKeep = signedDist > 0 ? bisectorN : smult(-1, bisectorN);
                    const halfSpace = buildHalfSpaceManifold(va, normalToKeep, 100);
                    if (halfSpace) {
                        const next = bodyM.intersect(halfSpace);
                        bodyM.delete();
                        halfSpace.delete();
                        bodyM = next;
                    }
                }

                // Apply a half-space clip with the given plane (through V,
                // normal = N) after orienting N toward F's centroid and
                // sanity-checking that no other vertex of F lands on the
                // wrong side. Returns whether a clip was applied.
                const applyVertexPlane = (V, Nin, vi) => {
                    if (vdot(Nin, Nin) < 1e-9) return false;
                    let N = vnormalize(Nin);
                    const sd0 = vdot(vsub(fCentroidNorm, V), N);
                    if (Math.abs(sd0) < 1e-9) return false;
                    if (sd0 < 0) N = smult(-1, N);
                    for (const pi of face) {
                        if (pi === vi) continue;
                        const sd = vdot(vsub(theOrigami.points[pi], V), N);
                        if (sd < -1e-9) return false; // would cut F itself
                    }
                    const halfSpace = buildHalfSpaceManifold(V, N, 100);
                    if (!halfSpace) return false;
                    const next = bodyM.intersect(halfSpace);
                    bodyM.delete();
                    halfSpace.delete();
                    bodyM = next;
                    return true;
                };

                // Passes (b) and (c) at each vertex V of F:
                //   D = outward medial-axis seam direction at V,
                //       approximated as −normalize(Σ inward normals at V).
                //       Walls extend along (or near) D, so any clip plane
                //       containing D won't cut into seam-direction material
                //       even far from V — making infinite half-space clips
                //       safe.
                //   (b) Per-vertex plane spanned by D and p (where p is
                //       perpendicular to F's edge bisector b in F's plane).
                //       Normal N_b = D × p. Clips F's "outside corner" at V
                //       (flange/wall material extending in −b direction).
                //   (c) For each face F'' incident at V that's NOT F and NOT
                //       edge-adjacent to F at V, a pairwise plane through V
                //       with normal = (n_F'' − n_F) − ((n_F'' − n_F)·D)·D —
                //       i.e. the exterior bisector of F and F'' projected
                //       to be perpendicular to D (so the plane contains D).
                //       Because the projection preserves the F-vs-F'' split
                //       and is the SAME plane both F and F'' will compute
                //       (with opposite kept sides), F's and F'''s molds get
                //       consistently separated even when F and F'' share
                //       only a vertex (no edge between them).
                for (let i = 0; i < Nf && bodyM; i++) {
                    const vi = face[i];
                    const V = theOrigami.points[vi];
                    // D: outward medial-axis direction at V.
                    let sumN = [0, 0, 0];
                    for (let fi2 = 0; fi2 < theOrigami.faces.length; fi2++) {
                        if (!theOrigami.faces[fi2].includes(vi)) continue;
                        sumN = vadd(sumN, theOrigami.getNorm(fi2));
                    }
                    if (vdot(sumN, sumN) < 1e-9) continue;
                    const D = smult(-1, vnormalize(sumN));

                    // (b) per-vertex (D, p) plane.
                    const V_prev = theOrigami.points[face[(i - 1 + Nf) % Nf]];
                    const V_next = theOrigami.points[face[(i + 1) % Nf]];
                    const e_prev = vnormalize(vsub(V_prev, V));
                    const e_next = vnormalize(vsub(V_next, V));
                    const bSum = vadd(e_prev, e_next);
                    if (vdot(bSum, bSum) >= 1e-9) {
                        const b = vnormalize(bSum);
                        const p = vnormalize(vXprd(n_f, b));
                        applyVertexPlane(V, vXprd(D, p), vi);
                    }
                    if (!bodyM) break;

                    // (c) pairwise planes for non-edge-adjacent F'' at V.
                    const edgeNbrNext = adjAtEdge[i];
                    const edgeNbrPrev = adjAtEdge[(i - 1 + Nf) % Nf];
                    for (let fpp = 0; fpp < theOrigami.faces.length && bodyM; fpp++) {
                        if (fpp === fidx) continue;
                        if (fpp === edgeNbrNext || fpp === edgeNbrPrev) continue;
                        if (!theOrigami.faces[fpp].includes(vi)) continue;
                        const n_fpp = theOrigami.getNorm(fpp);
                        const diff = vsub(n_fpp, n_f);
                        const diffPerp = vsub(diff, smult(vdot(diff, D), D));
                        applyVertexPlane(V, diffPerp, vi);
                    }
                }
            }

            // Engrave the face number through the flange (1-indexed). The
            // label sits on the flange's longest face-edge, inset to the
            // flange centre, oriented to read parallel to that edge from
            // below; cut depth = flange thickness + 2ε so the digits go
            // clean through.
            if (bodyM && window.stencilFont) {
                let maxLen = 0, bestI = 0;
                for (let i = 0; i < Nf; i++) {
                    const a = theOrigami.points[face[i]];
                    const b = theOrigami.points[face[(i + 1) % Nf]];
                    const len = vnorm(vsub(b, a));
                    if (len > maxLen) { maxLen = len; bestI = i; }
                }
                const v_a = theOrigami.points[face[bestI]];
                const v_b = theOrigami.points[face[(bestI + 1) % Nf]];
                const eMid = smult(0.5, vadd(v_a, v_b));
                const eDir = vnormalize(vsub(v_b, v_a));
                const oDir = vnormalize(vXprd(eDir, n_f));
                const moldW = opts.moldWidth ?? 1;
                // Flange spans outDir ∈ [−T − moldW, −T]; centre at −T − moldW/2.
                const labelCenter = vadd(eMid, smult(-T - moldW / 2, oDir));
                // Generous overhang so the prism's front/back caps sit well
            // outside the flange's faces — sub-mm overhang leaves slivers
            // visible from below where the manifold subtract precision
            // gives up. 5 mm each side is plenty.
            const labelEps = 0.5;
                const labelDepth = T + 2 * labelEps;
                const labelM = buildLabelManifold(
                    String(fidx + 1), 1.0, labelDepth,
                    {
                        origin: vadd(labelCenter, smult(-labelEps, upDir)),
                        x: eDir,
                        y: oDir,
                        z: upDir,
                    });
                if (labelM) {
                    const next = bodyM.subtract(labelM);
                    bodyM.delete();
                    labelM.delete();
                    bodyM = next;
                } else {
                    console.warn(`face ${fidx + 1}: label engraving skipped (font/earcut not ready or rejected)`);
                }
            }

            // Female1 side (one per edge at frac = 0.75): first ADD a wall
            // extension (8 mm along the edge, full wall thickness T, +4 mm
            // above moldHeight) so the rotated through-hole stays enclosed
            // by wall material above its top edge; then SUBTRACT the
            // rectangular hole through both wall and extension. The
            // extension uses sDirN (cos α·upDir + sin α·oDirN) as the
            // local-z axis so x ∈ [-T, 0] traces wall thickness at every
            // height — matching the wall's bevel exactly. The hole is
            // rotated by -2·g.alpha around the polygon-edge direction so
            // it lines up with the male's incoming direction once the two
            // face molds are folded into their dihedral assembly.
            // `play` (default 0.05 cm) enlarges the hole on every side
            // for fit tolerance.
            const snapW=0.7; // cantilever width (excluding the beveled base)
            if (bodyM && useScrews) {
                // Screw-assembly features per edge. Male side gets a 4mm
                // clearance hole through the wall; female side gets a 6mm
                // diameter boss attached to the cavity surface and a 3.6mm
                // pilot hole drilled through wall + boss. Screw axis is
                // along wDir = edgeDir × sDir (perpendicular to the wall
                // surface). Position is centered on the wall at half its
                // height (lifted along sDir from baseCenter on the edge).
                const bossLen = 0.6;       // 6 mm in cm
                const maleR = 0.2;         // 4 mm / 2
                const bossR = 0.3;         // 6 mm / 2
                const pilotR = 0.18;       // 3.6 mm / 2
                const safety = 0.3;        // 3 mm overrun past wall/boss
                                           // on each end of every cutter
                                           // cylinder so manifold-3d's
                                           // boolean ops have enough
                                           // overlap to produce a clean
                                           // cut even for thin walls
                                           // (wall thickness · cos(alpha)
                                           // can drop below 1 mm).
                const nudge = 0.05;        // 0.5 mm overlap into the wall
                                           // material so the boss union
                                           // isn't tangential (manifold-3d
                                           // produces flipped surfaces when
                                           // the boss top cap is exactly
                                           // coplanar with the cavity face).
                for (let edgeIdx = 0; edgeIdx < Nf; edgeIdx++) {
                    const g = edgeData[edgeIdx];
                    const eDirN = vnormalize(g.edgeVec);
                    const sDirN = vnormalize(g.sDir);
                    const wDir = vnormalize(vXprd(eDirN, sDirN));
                    // Wall thickness measured perpendicular to the wall
                    // surface (= along wDir). The wall's two surfaces are
                    // separated by `thickness` along outDir (in face plane);
                    // the perpendicular separation is thickness·cos(alpha).
                    const wallT = opts.thickness * Math.cos(g.alpha);
                    // Distance along sDir to reach half the wall's actual
                    // perpendicular height at this edge fraction. sDir
                    // tilts away from face plane by alpha so a step of L
                    // along sDir gains only L·cos(alpha) perpendicular,
                    // hence sLift = h / (2·cos α). The wall height varies
                    // along the edge because of per-vertex clipping
                    // (medial junction + lateral cap), so use the
                    // linearly-interpolated height at frac=0.25 and 0.75.
                    const cosA = Math.max(Math.cos(g.alpha), 1e-6);
                    const sLiftMale   = wallHeightAtFrac(edgeIdx, 0.25) / (2 * cosA);
                    const sLiftFemale = wallHeightAtFrac(edgeIdx, 0.75) / (2 * cosA);

                    // Male side at frac=0.25: 4mm clearance hole.
                    const liftedM = vadd(
                        vadd(g.v_i, smult(0.25, g.edgeVec)),
                        smult(sLiftMale, sDirN));
                    const maleHoleLen = 2 * (wallT + safety);
                    const maleHole = buildCylinderManifold(liftedM, wDir, maleR, maleHoleLen);
                    if (maleHole) {
                        const next = bodyM.subtract(maleHole);
                        bodyM.delete();
                        maleHole.delete();
                        bodyM = next;
                    }

                    // Female side at frac=0.75: 6mm boss on the cavity
                    // surface, then 3.6mm pilot through wall + boss.
                    const liftedF = vadd(
                        vadd(g.v_i, smult(0.75, g.edgeVec)),
                        smult(sLiftFemale, sDirN));
                    // Cavity surface point is one wall-thickness IN +wDir
                    // direction from the exterior (lifted) point — with
                    // upDir = -n_f, wDir points from the external surface
                    // toward the cavity surface, so we ADD wallT·wDir to
                    // reach the cavity side of the wall.
                    const cavityPt = vadd(liftedF, smult(wallT, wDir));
                    // Boss spans (cavityPt - nudge·wDir, in wall material)
                    // → (cavityPt + bossLen·wDir, free end in the cavity).
                    // The -nudge end sits inside the wall material so the
                    // union has overlap rather than coplanar contact.
                    const bossSpan = bossLen + nudge;
                    const bossCenter = vadd(cavityPt,
                        smult((bossLen - nudge) / 2, wDir));
                    const bossM = buildCylinderManifold(bossCenter, wDir, bossR, bossSpan);
                    if (bossM) {
                        const next = bodyM.add(bossM);
                        bodyM.delete();
                        bossM.delete();
                        bodyM = next;
                    }
                    // Pilot hole spans (liftedF - safety·wDir, past wall on
                    // exterior side) → (cavityPt + bossLen·wDir + safety·wDir,
                    // past boss bottom on cavity side). Center at midpoint
                    // of (liftedF, cavityPt + bossLen·wDir).
                    const pilotSpan = wallT + bossLen + 2 * safety;
                    const pilotCenter = vadd(liftedF,
                        smult((wallT + bossLen) / 2, wDir));
                    const pilotM = buildCylinderManifold(pilotCenter, wDir, pilotR, pilotSpan);
                    if (pilotM) {
                        const next = bodyM.subtract(pilotM);
                        bodyM.delete();
                        pilotM.delete();
                        bodyM = next;
                    }
                }
            } else if (bodyM) {
                const play = opts.play ?? 0.05;
                const bossEdgeWidth = snapW+0.8;   // ±4 mm along edge
                const bossExtraH = 0.4;      // +4 mm above wall height
                const overlap = 0.05;        // dip into existing wall for clean union
                for (let edgeIdx = 0; edgeIdx < Nf; edgeIdx++) {
                    const g = edgeData[edgeIdx];
                    const baseCenter = vadd(g.v_i, smult(0.75, g.edgeVec));
                    const eDirN = vnormalize(g.edgeVec);
                    const oDirN = vnormalize(vXprd(eDirN, n_f));
                    const minusE = smult(-1, eDirN);
                    // Hole basis: origin at polygon-edge × build-plate
                    // intersection, so the helper's local (0, *, 0) corner
                    // — anchored under rotation — coincides with the
                    // mold's bottom edge. The rest of the cube tilts above
                    // and inward by alpha_deg.
                    const holeBasis = {
                        origin: baseCenter,
                        x: oDirN, y: minusE, z: upDir,
                    };
                    // Wall extension: sloped slab in (oDirN, -eDirN, sDirN)
                    // basis. Origin shifted -T in oDirN (cavity-side edge)
                    // and (moldHeight + extraH)/cosα along sDirN — the
                    // helper now hangs the cube BELOW its origin (z ∈
                    // [-h_local, 0]), so origin sits at the slab's TOP.
                    // World footprint: oDir ∈ [-T, 0], z ∈ [h-overlap, h+extraH].
                    const cosAlpha = Math.max(Math.cos(g.alpha), 1e-6);
                    const sDirN = vnormalize(g.sDir);
                    const T = opts.thickness;
                    const wallExtOrigin = vadd(
                        vadd(baseCenter, smult(-T, oDirN)),
                        smult((opts.moldHeight + bossExtraH) / cosAlpha, sDirN));
                    const wallExtBasis = {
                        origin: wallExtOrigin,
                        x: oDirN, y: minusE, z: sDirN,
                    };
                    const wallExtM = buildFemaleHole1Manifold(
                        wallExtBasis,
                        bossEdgeWidth,
                        (bossExtraH + overlap) / cosAlpha,
                        T,
                        0, 0);
                    if (wallExtM) {
                        const withExt = bodyM.add(wallExtM);
                        bodyM.delete();
                        wallExtM.delete();
                        bodyM = withExt;
                    }
                    // Snap-rest wedge: PENTAGONAL prism added BEFORE the
                    // hole cut. Cross-section follows mold.scad line 56:
                    //   OpenSCAD: P1=[0,0], P2=[d·c2α, 0],
                    //             P3=[d·c2α, d·s2α],
                    //             P4=[d·c2α-(w+2)·s2α, d·s2α+(w+2)·c2α],
                    //             P5=[-d·sα, d·cα]
                    // OpenSCAD's +x (face A interior) corresponds to my
                    // -basis.x, so OpenSCAD x-coords are negated below.
                    // (w+2) in OpenSCAD mm → (snapW + 0.2) in our cm.
                    // Mapping mold.scad → our code (line 59 cube([20,h,w])
                    // is the female-hole cutout and dictates the meaning):
                    //   OpenSCAD h (edge-direction dim of the hole)
                    //                                    = our snapW
                    //   OpenSCAD w (perpendicular dim)   = our moldHeight
                    // So in line 56's polygon `(w+2)` → moldHeight + 0.2,
                    // and `linear_extrude(h+4)` → snapW + 0.4 along edge.
                    const cA = Math.cos(g.alpha), sA = Math.sin(g.alpha);
                    const c2a = Math.cos(2 * g.alpha), s2a = Math.sin(2 * g.alpha);
                    const d = opts.snapDepth ?? 1.0;
                    const wPlus2 = opts.moldHeight + 0.2;
                    const wedgeHalfW = ((opts.snapWidth ?? 0.6) + 0.4) / 2;
                    const V1 = [0, 0];
                    const V2 = [-d * c2a, 0];
                    const V3 = [-d * c2a, d * s2a];
                    const V4 = [-d * c2a + wPlus2 * s2a, d * s2a + wPlus2 * c2a];
                    const V5 = [d * sA, d * cA];
                    const wedgeM = (() => {
                        const m3d = window.manifold;
                        if (!m3d) return null;
                        const bx = holeBasis.x,
                              by = holeBasis.y, bz = holeBasis.z;
                        // Nudge wedge basis origin INTO the body by ~50µm
                        // along basis.x and basis.z so wedge surfaces don't
                        // exactly coincide with body surfaces (V1 at body
                        // anchor, V1-V2 floor edge at z=0, V1 at x=0 wall
                        // plane). Tangential surface contact poisons
                        // manifold-3d's subsequent booleans even when the
                        // union itself succeeds.
                        const eps = 0.005;
                        const ox = [
                            holeBasis.origin[0] - eps*bx[0] + eps*bz[0],
                            holeBasis.origin[1] - eps*bx[1] + eps*bz[1],
                            holeBasis.origin[2] - eps*bx[2] + eps*bz[2],
                        ];
                        // 10 vertices: front pentagon (y=-halfW) followed
                        // by back pentagon (y=+halfW). Indices:
                        //   0..4  = V1f, V2f, V3f, V4f, V5f
                        //   5..9  = V1b, V2b, V3b, V4b, V5b
                        const local = [
                            [V1[0], -wedgeHalfW, V1[1]],
                            [V2[0], -wedgeHalfW, V2[1]],
                            [V3[0], -wedgeHalfW, V3[1]],
                            [V4[0], -wedgeHalfW, V4[1]],
                            [V5[0], -wedgeHalfW, V5[1]],
                            [V1[0],  wedgeHalfW, V1[1]],
                            [V2[0],  wedgeHalfW, V2[1]],
                            [V3[0],  wedgeHalfW, V3[1]],
                            [V4[0],  wedgeHalfW, V4[1]],
                            [V5[0],  wedgeHalfW, V5[1]],
                        ];
                        const verts = [];
                        for (const [x, y, z] of local) {
                            verts.push(
                                ox[0] + x*bx[0] + y*by[0] + z*bz[0],
                                ox[1] + x*bx[1] + y*by[1] + z*bz[1],
                                ox[2] + x*bx[2] + y*by[2] + z*bz[2]);
                        }
                        // 7 faces: 2 pentagonal caps + 5 quad sides.
                        // Front cap (y=-halfW, outward -y): fan from V1f.
                        //   Going V1→V5→V4→V3→V2 is CCW from -y view (= CW
                        //   from +y view), so cross points -y.
                        // Back cap (y=+halfW, outward +y): fan from V1b in
                        //   reversed order V1→V2→V3→V4→V5 (CCW from +y).
                        // Quads connect each front edge to back edge.
                        let tris = [
                            // Front pentagon (-y outward)
                            0, 4, 3,
                            0, 3, 2,
                            0, 2, 1,
                            // Back pentagon (+y outward)
                            5, 6, 7,
                            5, 7, 8,
                            5, 8, 9,
                            // Side V1→V2 quad (front V1f-V2f, back V2b-V1b)
                            0, 1, 6,  0, 6, 5,
                            // Side V2→V3 quad
                            1, 2, 7,  1, 7, 6,
                            // Side V3→V4 quad (the snap-rest slant)
                            2, 3, 8,  2, 8, 7,
                            // Side V4→V5 quad
                            3, 4, 9,  3, 9, 8,
                            // Side V5→V1 quad (along flange)
                            4, 0, 5,  4, 5, 9,
                        ];
                        const det = bx[0]*(by[1]*bz[2] - by[2]*bz[1])
                                  + bx[1]*(by[2]*bz[0] - by[0]*bz[2])
                                  + bx[2]*(by[0]*bz[1] - by[1]*bz[0]);
                        if (det < 0) {
                            for (let i = 0; i < tris.length; i += 3) {
                                const t = tris[i+1]; tris[i+1] = tris[i+2]; tris[i+2] = t;
                            }
                        }
                        const mesh = new m3d.Mesh({
                            numProp: 3,
                            vertProperties: new Float32Array(verts),
                            triVerts: new Uint32Array(tris),
                        });
                        try {
                            return m3d.Manifold.ofMesh(mesh);
                        } catch (e) {
                            console.warn(`snap-rest wedge: ofMesh rejected — ${e.message || e}`);
                            return null;
                        }
                    })();
                    if (wedgeM) {
                        // DEBUG: render the wedge as a translucent green
                        // ghost mesh with edges drawn on top, so all 5
                        // prism faces are visible — without edge rendering,
                        // the floor (z=0) and wall (x=0) faces are
                        // coplanar with body surfaces, making the prism
                        // appear to have only 3 distinct faces.
                        const wedgeDbgMesh = manifoldToBabylon(
                            wedgeM,
                            "wedgeDbg[" + fidx + "][" + edgeIdx + "]");
                        const wedgeDbgMat = new BABYLON.StandardMaterial(
                            "wedgeDbgMat[" + fidx + "][" + edgeIdx + "]", scene);
                        wedgeDbgMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
                        wedgeDbgMat.emissiveColor = new BABYLON.Color3(0, 0.4, 0);
                        wedgeDbgMat.alpha = 0.5;
                        wedgeDbgMat.backFaceCulling = false;
                        wedgeDbgMesh.material = wedgeDbgMat;
                        wedgeDbgMesh.enableEdgesRendering();
                        wedgeDbgMesh.edgesWidth = 4.0;
                        wedgeDbgMesh.edgesColor = new BABYLON.Color4(0, 0.3, 0, 1);
                        meshes.push(wedgeDbgMesh);

                        const withWedge = bodyM.add(wedgeM);
                        bodyM.delete();
                        wedgeM.delete();
                        bodyM = withWedge;
                    }
                    // Through-hole (rotated, with play). Anchor at the
                    // polygon-edge × build-plate point (= upper-cavity-side
                    // corner of the cube, which now hangs below origin).
                    // Rotation = α − 90° aligns the cube's long axis with
                    // the wall slope direction sDir, so the rotated hole
                    // sits parallel to the bevelled wall. The cube's
                    // lower-cavity-side corner dips ~h·cos(α) below the
                    // floor — harmless since the part below floor doesn't
                    // intersect any mold material.
                    const alphaDeg = 2* g.alpha * 180 / Math.PI;
                    // Cut depth ≫ snap depth so the cube fully pierces
                    // the wedge (matches mold.scad which uses cube([20,
                    // h, w]) for the cutout while the snap is only `d`
                    // deep). With snapDepth=1cm and the wedge ~1cm deep,
                    // a cube of equal depth lands its far corner exactly
                    // on the wedge's V3 corner, which makes manifold-3d
                    // boolean subtract degenerate.
                    const holeDepth = 2 * (opts.snapDepth ?? 1.0);
                    // Tiny play (0.01 cm = 0.1 mm) shifts cube corners off
                    // exact coincidence with body vertices (V1 anchor,
                    // wall edges) — without it manifold-3d treats the
                    // cut as a sealed internal void instead of a tunnel,
                    // producing +12 tris (= hole tris alone) and no
                    // visible cut.
                    const holeM = buildFemaleHole1Manifold(
                        holeBasis,
                        snapW,
                        opts.moldHeight,
                        holeDepth,
                        alphaDeg - 180,
                        0.01);
                    if (holeM) {
                        // DEBUG: render the hole volume as a translucent
                        // red ghost mesh BEFORE consuming it in the
                        // subtraction, so we can see what's being cut.
                        const debugMesh = manifoldToBabylon(
                            holeM,
                            "femaleHoleDbg[" + fidx + "][" + edgeIdx + "]");
                        const dbgMat = new BABYLON.StandardMaterial(
                            "femaleHoleDbgMat[" + fidx + "][" + edgeIdx + "]", scene);
                        dbgMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
                        dbgMat.emissiveColor = new BABYLON.Color3(0.4, 0, 0);
                        dbgMat.alpha = 0.5;
                        dbgMat.backFaceCulling = false;
                        debugMesh.material = dbgMat;
                        meshes.push(debugMesh);

                        const next = bodyM.subtract(holeM);
                        bodyM.delete();
                        holeM.delete();
                        bodyM = next;
                    } else {
                        console.warn(`face ${fidx + 1} edge ${edgeIdx}: female hole skipped`);
                    }
                }
            }

            if (bodyM) {
                mesh = manifoldToBabylon(bodyM, "mold[" + fidx + "]");
                bodyM.delete();
                mesh.material = mat;
                baseMesh.dispose();
            } else {
                mesh = baseMesh;
            }
            meshes.push(mesh);

            // Snap-fit only: male cantilever tabs per edge. Screw assembly
            // emits no separate tab geometry (the male side is just a hole
            // through the wall, added above).
            const tabsCfg = useScrews ? [] : [
                { frac: 0.25, kind: "Male"   },
                { frac: 0.75, kind: "Female" },
            ];
            for (let edgeIdx = 0; edgeIdx < Nf; edgeIdx++) {
                for (const t of tabsCfg) {
                    // Male side: replace the old shield+RSnapY with the new
                    // "male1" snap-fit (mold.scad male1 module) — two
                    // SnapH cantilevers extruded along the polygon edge with
                    // a beveled back so the assembly prints flat on the bed.
                    if (t.kind === "Male" && window.manifold) {
                        const g = edgeData[edgeIdx];
                        const baseCenter = vadd(g.v_i, smult(t.frac, g.edgeVec));
                        const eDirN = vnormalize(g.edgeVec);
                        // Lay the snap's polygon plane *parallel to the
                        // build plate* by aligning local x with outDir
                        // (purely horizontal — no upDir component) instead
                        // of -wDir, which had a -tan(g.alpha)·upDir tilt
                        // that pushed the cantilever down through the bed.
                        // basis.y = -eDir makes the basis right-handed
                        // (outDir × -eDir = +upDir).
                        const oDirN = vnormalize(vXprd(eDirN, n_f));
                        const minusE = smult(-1, eDirN);
                        // Bevel angle = wall slope (g.alpha) so the foot of
                        // the snap, after the cube subtraction, sits flush
                        // against the cavity wall. On open boundary edges
                        // (g.alpha ≈ 0) fall back to the configured default
                        // for a print-friendly bevel.
                        const wallSlopeDeg = g.alpha * 180 / Math.PI;
                        const bevelDeg = wallSlopeDeg > 0.5 ? wallSlopeDeg : (opts.snapAlpha ?? 35);
                        const male1M = buildMaleSnap1Manifold(
                            { origin: baseCenter, x: oDirN, y: minusE, z: upDir },
                            bevelDeg,
                            opts.moldHeight,
                            opts.snapDepth ?? 1.0,
                            snapW);
                        if (male1M) {
                            const mesh = manifoldToBabylon(
                                male1M, "male1[" + fidx + "][" + edgeIdx + "]");
                            male1M.delete();
                            const mat = new BABYLON.StandardMaterial(
                                "male1Mat[" + fidx + "][" + edgeIdx + "]", scene);
                            mat.diffuseColor = Palette[fidx % Palette.length];
                            mat.alpha = 0.9;
                            mat.backFaceCulling = false;
                            mesh.material = mat;
                            meshes.push(mesh);
                        }
                        continue;
                    }
                    // Female side: the rectangular hole has already been
                    // subtracted from the mold body above (mold.scad female1
                    // module replaces the old shield+cone+cylinder design).
                    // Nothing more to add as a separate mesh here.
                    if (t.kind === "Female") continue;
                    const tab = theOrigami.getMoldTab(fidx, edgeIdx, t.frac, t.kind, opts);
                    let solidTab = BABYLON.MeshBuilder.CreatePolyhedron(
                        "moldTab[" + fidx + "][" + edgeIdx + "][" + t.kind + "]_solid",
                        { custom: { name: "MoldTab", category: ["Prism"], vertex: tab.pt, face: tab.idx } },
                        scene);
                    const tabMat = new BABYLON.StandardMaterial(
                        "moldTabMat[" + fidx + "][" + edgeIdx + "][" + t.kind + "]", scene);
                    tabMat.diffuseColor = Palette[fidx % Palette.length];
                    tabMat.alpha = 0.9;
                    tabMat.backFaceCulling = false;
                    solidTab.material = tabMat;

                    meshes.push(solidTab);
                }
            }
            return meshes;
        };

        // Build a manifold "male1" snap-fit assembly per mold.scad's male1
        // module: two SnapH cantilevers extruded in z (sharing their base at
        // y=±h/2), with a beveled cube subtracted from the back so the part
        // can be FDM-printed flat on the bed without supports.
        //   alpha = bevel angle from vertical (degrees).
        //   h     = snap-fit height (extrusion in z).
        //   depth = cantilever length (snap engagement).
        //   w     = cantilever width (in y, excluding the bevel).
        // The basis (origin, x, y, z) maps local (x,y,z) → world; for our
        // mold, x = -wDir (cantilever points into cavity), y = eDir (along
        // edge), z = upDir (vertical, +z in print).
        const buildMaleSnap1Manifold = (basis, alpha_deg, h, depth,w) => {
            const m3d = window.manifold;
            if (!m3d || typeof earcut !== 'function') return null;

            // SnapH parameters (PLA-tuned: from SnapLib.0.36.scad).
            const y_def = 0.2;       // 2 mm interference
            const a_deg_hook = 30;
            const f_safety = 1;
            const eps_pla = 0.03;    // 0.5 × PLA strain at break
            const h_snap = (1.09 / f_safety) * (eps_pla * depth * depth) / y_def;
            const p = y_def;
            const a_rad = a_deg_hook * Math.PI / 180;

            // SnapH polygon (CCW), local 2D xy.
            const poly2D = [
                [0, -h_snap],
                [depth, -h_snap/2],
                [depth + p + (y_def + h_snap/4) / Math.tan(a_rad), -h_snap/4],
                [depth + p, y_def],
                [depth, y_def],
                [depth, 0],
                [0, 0],
            ];
            const flat = [];
            for (const [x, y] of poly2D) flat.push(x, y);
            const tri2D = earcut(flat, [], 2);
            if (!tri2D.length) return null;

            // Det of basis: < 0 means left-handed; we'll flip windings.
            const det = basis.x[0]*(basis.y[1]*basis.z[2] - basis.y[2]*basis.z[1])
                      + basis.x[1]*(basis.y[2]*basis.z[0] - basis.y[0]*basis.z[2])
                      + basis.x[2]*(basis.y[0]*basis.z[1] - basis.y[1]*basis.z[0]);
            const flipL = det < 0;

            const verts = [];
            const tris = [];
            const pushVert = (lx, ly, lz) => {
                verts.push(
                    basis.origin[0] + lx*basis.x[0] + ly*basis.y[0] + lz*basis.z[0],
                    basis.origin[1] + lx*basis.x[1] + ly*basis.y[1] + lz*basis.z[1],
                    basis.origin[2] + lx*basis.x[2] + ly*basis.y[2] + lz*basis.z[2]);
            };

            // Build one piece (front+back caps + side strips) at the given y
            // shift. mirrorY=true mirrors across local y=0 (which inverts CCW
            // → CW, so the cap/strip windings get flipped accordingly).
            const buildPiece = (yShift, mirrorY) => {
                const N = poly2D.length;
                const baseFront = verts.length / 3;
                for (const [px, py] of poly2D) {
                    pushVert(px, mirrorY ? -(py + yShift) : (py + yShift), 0);
                }
                const baseBack = verts.length / 3;
                for (const [px, py] of poly2D) {
                    pushVert(px, mirrorY ? -(py + yShift) : (py + yShift), h);
                }
                // Front cap (z=0): want outward -z normal. earcut gives CCW
                // (normal +z) for CCW polygon, so reverse for non-mirror.
                // Mirrored piece has CW polygon → earcut still triangulates,
                // but the resulting tris are CW (normal -z) — already correct.
                // Left-handed basis flips everything once more.
                const reverseCap = mirrorY !== flipL;
                for (let i = 0; i < tri2D.length; i += 3) {
                    const a = baseFront + tri2D[i], b = baseFront + tri2D[i+1], c = baseFront + tri2D[i+2];
                    tris.push(...(reverseCap ? [a, b, c] : [c, b, a]));
                }
                // Back cap (z=h): outward +z (opposite of front).
                for (let i = 0; i < tri2D.length; i += 3) {
                    const a = baseBack + tri2D[i], b = baseBack + tri2D[i+1], c = baseBack + tri2D[i+2];
                    tris.push(...(reverseCap ? [c, b, a] : [a, b, c]));
                }
                // Side strips.
                const reverseStrip = mirrorY !== flipL;
                for (let i = 0; i < N; i++) {
                    const j = (i + 1) % N;
                    const fa = baseFront + i, fb = baseFront + j;
                    const ba = baseBack + i,  bb = baseBack + j;
                    if (reverseStrip) {
                        tris.push(fa, ba, bb,  fa, bb, fb);
                    } else {
                        tris.push(fa, fb, bb,  fa, bb, ba);
                    }
                }
            };
            buildPiece(w/2, false);   // piece A
            buildPiece(w/2, true);    // piece B (mirror across y=0)

            const snapMesh = new m3d.Mesh({
                numProp: 3,
                vertProperties: new Float32Array(verts),
                triVerts: new Uint32Array(tris),
            });
            snapMesh.merge();
            let snapM;
            try {
                snapM = m3d.Manifold.ofMesh(snapMesh);
            } catch (e) {
                console.warn(`buildMaleSnap1Manifold: snap ofMesh rejected — ${e.message || e}`);
                return null;
            }

            // Build the bevel cube. SCAD: rotate([0,alpha,0]) translate([-5,-h/2-eps,0]) cube([5,h+2eps,2h])
            // Order (inside-out): cube, translate, rotate. We bake the rotation
            // around local y at construction time, then map vertices to world.
            const a_rad_bev = alpha_deg * Math.PI / 180;
            const cBev = Math.cos(a_rad_bev), sBev = Math.sin(a_rad_bev);
            const eps_pad = 0.1;
            const cubeCornersLocal = [
                [-5, -h/2 - eps_pad, 0],
                [ 0, -h/2 - eps_pad, 0],
                [ 0,  h/2 + eps_pad, 0],
                [-5,  h/2 + eps_pad, 0],
                [-5, -h/2 - eps_pad, 2*h],
                [ 0, -h/2 - eps_pad, 2*h],
                [ 0,  h/2 + eps_pad, 2*h],
                [-5,  h/2 + eps_pad, 2*h],
            ];
            const cubeVerts = [];
            for (const [x, y, z] of cubeCornersLocal) {
                // Rotation by alpha around local y axis, right-hand-rule
                // convention matching OpenSCAD's rotate([0, alpha, 0]):
                // (x, z) → (x·cos + z·sin, -x·sin + z·cos), so +z rotates
                // toward +x. The previous formulas had the wrong sign and
                // sent the bevel cube off into negative x/z, never actually
                // intersecting the snap.
                const xr =  x*cBev + z*sBev;
                const zr = -x*sBev + z*cBev;
                cubeVerts.push(
                    basis.origin[0] + xr*basis.x[0] + y*basis.y[0] + zr*basis.z[0],
                    basis.origin[1] + xr*basis.x[1] + y*basis.y[1] + zr*basis.z[1],
                    basis.origin[2] + xr*basis.x[2] + y*basis.y[2] + zr*basis.z[2]);
            }
            // Cube faces (CCW from outside, then triangulated).
            let cubeTris = [
                0, 3, 2, 0, 2, 1,    // bottom (-z outward in local)
                4, 5, 6, 4, 6, 7,    // top    (+z outward)
                0, 1, 5, 0, 5, 4,    // -y
                3, 7, 6, 3, 6, 2,    // +y
                0, 4, 7, 0, 7, 3,    // -x
                1, 2, 6, 1, 6, 5,    // +x
            ];
            if (flipL) {
                for (let i = 0; i < cubeTris.length; i += 3) {
                    const t = cubeTris[i+1]; cubeTris[i+1] = cubeTris[i+2]; cubeTris[i+2] = t;
                }
            }
            const cubeMesh = new m3d.Mesh({
                numProp: 3,
                vertProperties: new Float32Array(cubeVerts),
                triVerts: new Uint32Array(cubeTris),
            });
            let cubeM;
            try {
                cubeM = m3d.Manifold.ofMesh(cubeMesh);
            } catch (e) {
                console.warn(`buildMaleSnap1Manifold: cube ofMesh rejected — ${e.message || e}`);
                snapM.delete();
                return null;
            }

            let result;
            try {
                result = snapM.subtract(cubeM);
            } catch (e) {
                console.warn(`buildMaleSnap1Manifold: subtract failed — ${e.message || e}`);
                snapM.delete(); cubeM.delete();
                return null;
            }
            snapM.delete();
            cubeM.delete();
            return result;
        };

        // Build a manifold rectangular hole for the female side of the snap
        // (mold.scad female1 module). Pre-rotation: an axis-aligned cube
        //   x ∈ [0, depth],  y ∈ [-w/2, w/2],  z ∈ [-h, 0]
        // — translated DOWN by h so the local origin sits at the cube's
        // upper-cavity-side corner (the "anchor"). Rotated by alpha_deg
        // around that anchor (y axis = polygon-edge axis) before being
        // mapped to world via basis. At the call site, the anchor is wired
        // to the polygon-edge × build-plate point on the wall.
        const buildFemaleHole1Manifold = (basis, w, h, depth, alpha_deg, play = 0) => {
            const m3d = window.manifold;
            if (!m3d) return null;
            const a_rad = alpha_deg * Math.PI / 180;
            const cA = Math.cos(a_rad), sA = Math.sin(a_rad);
            // Enlarge the cube by `play` in every direction so the hole has
            // a bit of slack around the male — controls fit tightness.
            const x0 = -play, x1 = depth + play;
            const y0 = -w/2 - play, y1 = w/2 + play;
            // Cube hangs BELOW the basis origin (z ∈ [-h, 0]) — the YELLOW
            // initial position. Anchor (0, 0) is the upper-cavity-side
            // corner of the cube.
            const z0 = -h - play, z1 = play;
            const corners = [
                [x0, y0, z0],
                [x1, y0, z0],
                [x1, y1, z0],
                [x0, y1, z0],
                [x0, y0, z1],
                [x1, y0, z1],
                [x1, y1, z1],
                [x0, y1, z1],
            ];
            const verts = [];
            for (const [x, y, z] of corners) {
                const xr =  x*cA + z*sA;
                const zr = -x*sA + z*cA;
                verts.push(
                    basis.origin[0] + xr*basis.x[0] + y*basis.y[0] + zr*basis.z[0],
                    basis.origin[1] + xr*basis.x[1] + y*basis.y[1] + zr*basis.z[1],
                    basis.origin[2] + xr*basis.x[2] + y*basis.y[2] + zr*basis.z[2]);
            }
            const det = basis.x[0]*(basis.y[1]*basis.z[2] - basis.y[2]*basis.z[1])
                      + basis.x[1]*(basis.y[2]*basis.z[0] - basis.y[0]*basis.z[2])
                      + basis.x[2]*(basis.y[0]*basis.z[1] - basis.y[1]*basis.z[0]);
            let cubeTris = [
                0, 3, 2, 0, 2, 1,
                4, 5, 6, 4, 6, 7,
                0, 1, 5, 0, 5, 4,
                3, 7, 6, 3, 6, 2,
                0, 4, 7, 0, 7, 3,
                1, 2, 6, 1, 6, 5,
            ];
            if (det < 0) {
                for (let i = 0; i < cubeTris.length; i += 3) {
                    const t = cubeTris[i+1]; cubeTris[i+1] = cubeTris[i+2]; cubeTris[i+2] = t;
                }
            }
            const mesh = new m3d.Mesh({
                numProp: 3,
                vertProperties: new Float32Array(verts),
                triVerts: new Uint32Array(cubeTris),
            });
            try {
                return m3d.Manifold.ofMesh(mesh);
            } catch (e) {
                console.warn(`buildFemaleHole1Manifold: ofMesh rejected — ${e.message || e}`);
                return null;
            }
        };

        // Build a watertight Manifold from a text string by sampling glyph
        // outlines from window.stencilFont (loaded via opentype.js), grouping
        // each glyph's outer/holes by signed-area + bbox-containment,
        // triangulating with earcut, and extruding into 3D using a caller-
        // supplied basis. The basis maps glyph-local (x, y, z) → world via
        // origin + x·basis.x + y·basis.y + z·basis.z (z is the extrude axis).
        // Returns null if any prerequisite isn't ready or the resulting mesh
        // is rejected by Manifold.ofMesh. Caller owns the returned Manifold.
        const buildLabelManifold = (text, height, depth, basis) => {
            const m3d = window.manifold;
            const font = window.stencilFont;
            if (!m3d || !font || !text || typeof earcut !== 'function') return null;

            // Sample the OpenType path at the given em size.
            const path = font.getPath(text, 0, 0, height);
            const bb = path.getBoundingBox();
            const cx = (bb.x1 + bb.x2) / 2;
            const cy = (bb.y1 + bb.y2) / 2;

            // OpenType uses Y-down (typographic). Flip y so glyphs read right-
            // side-up in our basis, and centre on (0,0).
            const SAMPLES = 16;
            const subpaths = [];
            let cur = [];
            let lx = 0, ly = 0;
            for (const cmd of path.commands) {
                if (cmd.type === 'M') {
                    if (cur.length) subpaths.push(cur);
                    cur = [[cmd.x - cx, -(cmd.y - cy)]];
                    lx = cmd.x; ly = cmd.y;
                } else if (cmd.type === 'L') {
                    cur.push([cmd.x - cx, -(cmd.y - cy)]);
                    lx = cmd.x; ly = cmd.y;
                } else if (cmd.type === 'Q') {
                    for (let i = 1; i <= SAMPLES; i++) {
                        const t = i / SAMPLES, mt = 1 - t;
                        const x = mt*mt*lx + 2*mt*t*cmd.x1 + t*t*cmd.x;
                        const y = mt*mt*ly + 2*mt*t*cmd.y1 + t*t*cmd.y;
                        cur.push([x - cx, -(y - cy)]);
                    }
                    lx = cmd.x; ly = cmd.y;
                } else if (cmd.type === 'C') {
                    for (let i = 1; i <= SAMPLES; i++) {
                        const t = i / SAMPLES, mt = 1 - t;
                        const x = mt*mt*mt*lx + 3*mt*mt*t*cmd.x1 + 3*mt*t*t*cmd.x2 + t*t*t*cmd.x;
                        const y = mt*mt*mt*ly + 3*mt*mt*t*cmd.y1 + 3*mt*t*t*cmd.y2 + t*t*t*cmd.y;
                        cur.push([x - cx, -(y - cy)]);
                    }
                    lx = cmd.x; ly = cmd.y;
                } else if (cmd.type === 'Z') {
                    if (cur.length) { subpaths.push(cur); cur = []; }
                }
            }
            if (cur.length) subpaths.push(cur);

            // Dedup consecutive (and wrap-around) coincident vertices —
            // Bézier samples occasionally produce points within float
            // epsilon of the previous one, which yields zero-area triangles
            // and trips Manifold.ofMesh's non-manifold check.
            const eps2 = 1e-12;
            const dedup = (poly) => {
                const out = [];
                for (const p of poly) {
                    const last = out[out.length - 1];
                    if (!last || (last[0]-p[0])**2 + (last[1]-p[1])**2 > eps2) out.push(p);
                }
                if (out.length > 1) {
                    const f = out[0], l = out[out.length - 1];
                    if ((f[0]-l[0])**2 + (f[1]-l[1])**2 < eps2) out.pop();
                }
                return out;
            };
            const cleaned = subpaths.map(dedup).filter(p => p.length >= 3);
            if (!cleaned.length) {
                console.warn(`buildLabelManifold("${text}"): no valid subpaths after dedup`);
                return null;
            }
            subpaths.length = 0;
            cleaned.forEach(p => subpaths.push(p));

            const sArea = (poly) => {
                let a = 0;
                for (let i = 0; i < poly.length; i++) {
                    const j = (i + 1) % poly.length;
                    a += poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1];
                }
                return a / 2;
            };
            const bbox = (poly) => poly.reduce((bb, p) => ({
                minX: Math.min(bb.minX, p[0]), maxX: Math.max(bb.maxX, p[0]),
                minY: Math.min(bb.minY, p[1]), maxY: Math.max(bb.maxY, p[1]),
            }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

            // After Y-flip, OpenType outers come out with negative signed
            // area (CW). The largest |area| polygon is taken as outer-sign;
            // matching-sign polygons are outers, opposite are holes. We then
            // normalise so earcut receives CCW outers + CW holes.
            const rawMeta = subpaths.map(p => ({ pts: p, area: sArea(p), box: bbox(p) }));
            if (!rawMeta.length) return null;
            const maxAbsArea = Math.max(...rawMeta.map(m => Math.abs(m.area)));
            const dominant = rawMeta.reduce((b, m) => Math.abs(m.area) > Math.abs(b.area) ? m : b);
            const overlap = (b1, b2) => !(
                b1.maxX < b2.minX || b2.maxX < b1.minX ||
                b1.maxY < b2.minY || b2.maxY < b1.minY);
            // Per-subpath diagnostic — useful when a font emits unexpected
            // extra outlines (artifacts of stencil bridges, separate base
            // serifs etc.) that show up as spurious extrusions.
            console.log(`buildLabelManifold("${text}"): ${rawMeta.length} subpath(s):`);
            rawMeta.forEach((m, i) => {
                const w = m.box.maxX - m.box.minX;
                const h = m.box.maxY - m.box.minY;
                console.log(`  #${i}: ${m.pts.length}v, area=${m.area.toFixed(3)}, bbox=[${m.box.minX.toFixed(2)},${m.box.minY.toFixed(2)}]→[${m.box.maxX.toFixed(2)},${m.box.maxY.toFixed(2)}] (${w.toFixed(2)}×${h.toFixed(2)})`);
            });
            // Drop subpaths whose area is < 1 % of the dominant or whose
            // bbox doesn't overlap the dominant's bbox — those are font
            // artefacts that would extrude as spurious cuts off to the side
            // of the actual digit shape.
            const meta = rawMeta.filter(m =>
                Math.abs(m.area) >= 0.01 * maxAbsArea &&
                overlap(m.box, dominant.box));
            const dropped = rawMeta.length - meta.length;
            if (dropped > 0) {
                console.log(`buildLabelManifold("${text}"): dropped ${dropped} subpath(s) (tiny or bbox-disjoint from dominant)`);
            }
            const outerSign = Math.sign(meta.reduce((b, m) => Math.abs(m.area) > Math.abs(b.area) ? m : b).area);
            const outers = [], holes = [];
            for (const m of meta) {
                if (Math.sign(m.area) === outerSign) outers.push(m);
                else holes.push(m);
            }
            console.log(`buildLabelManifold("${text}"): ${outers.length} outer(s), ${holes.length} hole(s) after filter`);
            const ensure = (poly, wantPositive) => {
                if ((sArea(poly) > 0) !== wantPositive) poly.reverse();
            };
            outers.forEach(o => ensure(o.pts, true));
            holes.forEach(h => ensure(h.pts, false));

            // Assign each hole to the smallest containing outer (by bbox).
            const groups = outers.map(o => ({ outer: o.pts, holes: [] }));
            for (const h of holes) {
                let bestI = -1, bestArea = Infinity;
                outers.forEach((o, i) => {
                    if (o.box.minX <= h.box.minX && o.box.maxX >= h.box.maxX &&
                        o.box.minY <= h.box.minY && o.box.maxY >= h.box.maxY) {
                        const a = (o.box.maxX - o.box.minX) * (o.box.maxY - o.box.minY);
                        if (a < bestArea) { bestArea = a; bestI = i; }
                    }
                });
                if (bestI >= 0) groups[bestI].holes.push(h.pts);
            }

            // Build extruded mesh (front + back caps + side strips).
            const verts = [];
            const tris = [];
            const place = (x, y, z) => verts.push(
                basis.origin[0] + x * basis.x[0] + y * basis.y[0] + z * basis.z[0],
                basis.origin[1] + x * basis.x[1] + y * basis.y[1] + z * basis.z[1],
                basis.origin[2] + x * basis.x[2] + y * basis.y[2] + z * basis.z[2]);
            for (const g of groups) {
                const flat = [];
                const holeStarts = [];
                for (const p of g.outer) flat.push(p[0], p[1]);
                for (const h of g.holes) {
                    holeStarts.push(flat.length / 2);
                    for (const p of h) flat.push(p[0], p[1]);
                }
                const N = flat.length / 2;
                const baseFront = verts.length / 3;
                for (let i = 0; i < N; i++) place(flat[i*2], flat[i*2+1], 0);
                const baseBack = verts.length / 3;
                for (let i = 0; i < N; i++) place(flat[i*2], flat[i*2+1], depth);
                const tri2D = earcut(flat, holeStarts, 2);
                if (!tri2D.length) {
                    console.warn(`buildLabelManifold("${text}"): earcut produced no triangles for a glyph (vertex count ${N})`);
                    continue;
                }
                // Front cap (at z=0): outward normal in -z direction → reverse winding.
                for (let i = 0; i < tri2D.length; i += 3) {
                    tris.push(baseFront + tri2D[i+2], baseFront + tri2D[i+1], baseFront + tri2D[i]);
                }
                // Back cap (at z=depth): outward in +z, forward winding.
                for (let i = 0; i < tri2D.length; i += 3) {
                    tris.push(baseBack + tri2D[i], baseBack + tri2D[i+1], baseBack + tri2D[i+2]);
                }
                // Side strips for outer (CCW) + each hole (CW). Same winding
                // works for both because right-of-walk gives outward normal
                // for CCW outers AND inward (= toward void center, away from
                // material) for CW holes — exactly what manifold expects.
                const stripWalk = (start, len) => {
                    for (let i = 0; i < len; i++) {
                        const j = (i + 1) % len;
                        const a = baseFront + start + i;
                        const b = baseFront + start + j;
                        const c = baseBack + start + j;
                        const d = baseBack + start + i;
                        tris.push(a, b, c);
                        tris.push(a, c, d);
                    }
                };
                stripWalk(0, g.outer.length);
                let off = g.outer.length;
                for (const h of g.holes) { stripWalk(off, h.length); off += h.length; }
            }

            // The triangle windings above assume a right-handed basis. If the
            // caller passed a left-handed one (det < 0), every triangle's
            // world-space normal flips inward; manifold then reports
            // "Not manifold" because the surface, while closed, is inverted.
            // Detect via the basis determinant and flip every triangle.
            const det = basis.x[0]*(basis.y[1]*basis.z[2] - basis.y[2]*basis.z[1])
                      + basis.x[1]*(basis.y[2]*basis.z[0] - basis.y[0]*basis.z[2])
                      + basis.x[2]*(basis.y[0]*basis.z[1] - basis.y[1]*basis.z[0]);
            if (det < 0) {
                for (let i = 0; i < tris.length; i += 3) {
                    const t = tris[i+1]; tris[i+1] = tris[i+2]; tris[i+2] = t;
                }
            }

            const mMesh = new m3d.Mesh({
                numProp: 3,
                vertProperties: new Float32Array(verts),
                triVerts: new Uint32Array(tris),
            });
            try {
                return m3d.Manifold.ofMesh(mMesh);
            } catch (e) {
                console.warn(`buildLabelManifold("${text}"): ofMesh rejected — ${e.message || e}`);
                return null;
            }
        };

        // Build a Manifold directly from a polyhedron description {pts, faces}
        // (the same shape returned by getCutterPolyhedron / getMoldPolyhedron),
        // bypassing Babylon's CreatePolyhedron + babylonToManifold round-trip.
        // Babylon emits one vertex per face-vertex (for flat shading), so the
        // intended-shared edges between adjacent quads only become shared
        // again via mMesh.merge()'s float-tolerance dedup — which can fail
        // at sub-mm precision and leave the mesh marginally non-manifold.
        // Building straight from the polyhedron list keeps every shared edge
        // sharing its actual index, so the input to ofMesh is structurally
        // manifold to begin with.
        const polyhedronToManifold = (pts, faces) => {
            const m3d = window.manifold;
            if (!m3d) return null;
            const verts = new Float32Array(pts.length * 3);
            for (let i = 0; i < pts.length; i++) {
                verts[i*3]     = pts[i][0];
                verts[i*3 + 1] = pts[i][1];
                verts[i*3 + 2] = pts[i][2];
            }
            const tris = [];
            for (const face of faces) {
                if (face.length < 3) continue;
                // Fan-triangulate from vertex 0 (matches Babylon's strategy
                // for convex polygon faces, which is what getCutter/MoldPolyhedron
                // produces).
                for (let i = 1; i < face.length - 1; i++) {
                    tris.push(face[0], face[i], face[i+1]);
                }
            }
            const mMesh = new m3d.Mesh({
                numProp: 3,
                vertProperties: verts,
                triVerts: new Uint32Array(tris),
            });
            mMesh.merge();
            try {
                return m3d.Manifold.ofMesh(mMesh);
            } catch (e) {
                console.warn(`polyhedronToManifold: ofMesh rejected — ${e.message || e}`);
                return null;
            }
        };

        // Cylinder manifold centered at `origin` with axis along `axis`, given
        // radius and length. Used for screw-assembly hole and boss features.
        // The face windings below are emitted in CW-from-outside order and
        // then reversed in the final return to land at CCW-from-outside
        // (cross product OUTWARD), matching getCutterPolyhedron's body
        // winding. Without this match, the boss union ends up with the
        // cylinder's surfaces inside-out relative to the body (pink stripes /
        // flipped normals in MeshMixer).
        const buildCylinderManifold = (origin, axis, radius, length, segments = 32) => {
            if (!window.manifold) return null;
            const axisN = vnormalize(axis);
            // Pick any two orthonormal basis vectors perpendicular to axisN.
            let xN = Math.abs(axisN[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
            xN = vnormalize(vsub(xN, smult(vdot(xN, axisN), axisN)));
            const yN = vXprd(axisN, xN);
            const halfL = length / 2;
            const pt = [];
            for (let i = 0; i < segments; i++) {
                const theta = (2 * Math.PI * i) / segments;
                const lateral = vadd(smult(radius * Math.cos(theta), xN),
                                     smult(radius * Math.sin(theta), yN));
                pt.push(vadd(vadd(origin, lateral), smult(-halfL, axisN))); // bottom
                pt.push(vadd(vadd(origin, lateral), smult(+halfL, axisN))); // top
            }
            const idx = [];
            const bottomCap = [];
            for (let i = 0; i < segments; i++) bottomCap.push(2 * i);
            idx.push(bottomCap);
            const topCap = [];
            for (let i = segments - 1; i >= 0; i--) topCap.push(2 * i + 1);
            idx.push(topCap);
            for (let i = 0; i < segments; i++) {
                const j = (i + 1) % segments;
                idx.push([2 * i, 2 * i + 1, 2 * j + 1, 2 * j]);
            }
            return polyhedronToManifold(pt, idx.map(face => face.slice().reverse()));
        };

        // Half-space cube manifold for clipping: a large box (side `size`)
        // with one face on the plane through `pointOnPlane` perpendicular
        // to `normalToKeep`, extending `size` units in the `normalToKeep`
        // direction. Used to intersect each face mold with the half-space
        // on its side of each adjacent-edge bisector plane, so adjacent
        // molds don't overlap in 3D at concave or sharp dihedrals.
        const buildHalfSpaceManifold = (pointOnPlane, normalToKeep, size = 100) => {
            if (!window.manifold) return null;
            const n = vnormalize(normalToKeep);
            let xN = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
            xN = vnormalize(vsub(xN, smult(vdot(xN, n), n)));
            const yN = vXprd(n, xN);
            const halfSize = size / 2;
            const farPt = vadd(pointOnPlane, smult(size, n));
            const pt = [
                vadd(vadd(pointOnPlane, smult(-halfSize, xN)), smult(-halfSize, yN)), // 0
                vadd(vadd(pointOnPlane, smult(+halfSize, xN)), smult(-halfSize, yN)), // 1
                vadd(vadd(pointOnPlane, smult(+halfSize, xN)), smult(+halfSize, yN)), // 2
                vadd(vadd(pointOnPlane, smult(-halfSize, xN)), smult(+halfSize, yN)), // 3
                vadd(vadd(farPt,        smult(-halfSize, xN)), smult(-halfSize, yN)), // 4
                vadd(vadd(farPt,        smult(+halfSize, xN)), smult(-halfSize, yN)), // 5
                vadd(vadd(farPt,        smult(+halfSize, xN)), smult(+halfSize, yN)), // 6
                vadd(vadd(farPt,        smult(-halfSize, xN)), smult(+halfSize, yN)), // 7
            ];
            // CCW-from-outside (cross product OUTWARD), matching the body's
            // winding convention so the cube is manifold and intersects cleanly.
            const idx = [
                [0, 3, 2, 1], // near face (-n outside)
                [4, 5, 6, 7], // far face (+n outside)
                [0, 1, 5, 4], // -yN side
                [1, 2, 6, 5], // +xN side
                [2, 3, 7, 6], // +yN side
                [0, 4, 7, 3], // -xN side
            ];
            return polyhedronToManifold(pt, idx);
        };

        // Convert a Babylon mesh (with its current world transform applied)
        // into a manifold-3d Manifold solid. Returns null if manifold isn't
        // loaded yet or the mesh has no geometry. Caller owns the returned
        // Manifold and must .delete() it when done (manifold uses native WASM
        // memory that isn't reclaimed by JS GC).
        const babylonToManifold = (mesh) => {
            const m3d = window.manifold;
            if (!m3d) return null;
            mesh.computeWorldMatrix(true);
            const wm = mesh.getWorldMatrix();
            const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const indices = mesh.getIndices();
            if (!positions || !indices) return null;
            const numVerts = positions.length / 3;
            const vertProperties = new Float32Array(numVerts * 3);
            const v = new BABYLON.Vector3();
            for (let i = 0; i < numVerts; i++) {
                v.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
                const w = BABYLON.Vector3.TransformCoordinates(v, wm);
                vertProperties[i * 3]     = w.x;
                vertProperties[i * 3 + 1] = w.y;
                vertProperties[i * 3 + 2] = w.z;
            }
            const triVerts = (indices instanceof Uint32Array)
                ? indices
                : new Uint32Array(indices);
            const mMesh = new m3d.Mesh({ numProp: 3, vertProperties, triVerts });
            // Dedupe coincident vertices so meshes built with duplicate
            // ring-slots (notch corners collapsing to the same 3D point at
            // z=0, etc.) get treated as a single watertight surface.
            mMesh.merge();
            try {
                return m3d.Manifold.ofMesh(mMesh);
            } catch (e) {
                console.warn(
                    `babylonToManifold("${mesh.name}"): input rejected by ` +
                    `Manifold.ofMesh — ${e.message || e}. Caller should fall ` +
                    `back to Babylon CSG.`);
                return null;
            }
        };

        // Boolean-union an array of Babylon meshes into a single watertight
        // solid via manifold. Used for STL export: separate shells with
        // overlapping volume confuse slicers (Cura leaves "unsliced" gaps at
        // intersections of body wall + tab front/back coplanar surfaces),
        // but a single unioned solid has no internal faces. Falls back to
        // returning the input array unchanged if manifold isn't loaded or
        // any input mesh is rejected by Manifold.ofMesh. Caller is
        // responsible for disposing both the input meshes AND the returned
        // mesh(es) — when the union succeeds the returned array contains a
        // single new mesh and the inputs are NOT modified.
        const unionMeshes = (meshes) => {
            if (!window.manifold || meshes.length <= 1) return meshes;
            let unionM = babylonToManifold(meshes[0]);
            if (!unionM) {
                console.warn(`unionMeshes: ${meshes[0].name} rejected — keeping shells separate`);
                return meshes;
            }
            for (let i = 1; i < meshes.length; i++) {
                const m = babylonToManifold(meshes[i]);
                if (!m) {
                    console.warn(`unionMeshes: ${meshes[i].name} rejected — skipping in union`);
                    continue;
                }
                const next = unionM.add(m);
                unionM.delete(); m.delete();
                unionM = next;
            }
            const result = manifoldToBabylon(unionM, "moldUnion");
            unionM.delete();
            return [result];
        };

        // Convert a manifold-3d Manifold back to a Babylon mesh. Computes
        // smooth normals from the output positions/indices. Caller assigns
        // material and disposes the Babylon mesh as usual; the manifold
        // Manifold is NOT deleted here (caller manages its lifecycle).
        const manifoldToBabylon = (manifoldObj, name) => {
            const m = manifoldObj.getMesh();
            const vd = new BABYLON.VertexData();
            vd.positions = m.vertProperties;
            vd.indices = m.triVerts;
            const normals = [];
            BABYLON.VertexData.ComputeNormals(vd.positions, vd.indices, normals);
            vd.normals = normals;
            const mesh = new BABYLON.Mesh(name, scene);
            vd.applyToMesh(mesh);
            return mesh;
        };

        // Diagnostic: for each face and each face vertex V, reports the
        // medial-junction depth from F at V (depth where bisectors from V
        // first converge on F's cell), and the wall height that per-vertex
        // clipping would pick (= min(moldHeight, junctionDepth)). Call as
        // `debugMoldHeights()` from devtools.
        window.debugMoldHeights = () => {
            const moldHeight = theGUI.cutterOpts.moldHeight ?? 0.8;
            console.group(`debugMoldHeights — moldHeight=${moldHeight} cm`);
            if (!theOrigami.medial || !theOrigami.medial.seams || theOrigami.medial.seams.length === 0) {
                console.warn('No medial axis cached; cannot compute per-vertex depths.');
                console.groupEnd();
                return;
            }
            const tol = 1e-3;
            const sameVec = (a, b) =>
                Math.abs(a[0]-b[0]) < tol && Math.abs(a[1]-b[1]) < tol && Math.abs(a[2]-b[2]) < tol;
            theOrigami.faces.forEach((face, fidx) => {
                const n_f = theOrigami.getNorm(fidx);
                const p_f = theOrigami.points[face[0]];
                console.group(`face ${fidx+1} (data idx ${fidx}): verts=[${face}]`);
                let clippedNeeded = false;
                face.forEach((pIdx) => {
                    const v_pos = theOrigami.points[pIdx];
                    const seams = theOrigami.medial.seams.filter(s => {
                        const fromV = sameVec(s.start, v_pos) || sameVec(s.end, v_pos);
                        return fromV && s.faces.includes(fidx);
                    });
                    if (seams.length === 0) {
                        console.log(`  V${pIdx} at [${v_pos.map(x=>x.toFixed(2))}]: NO seams ∋ ${fidx} (boundary or open vertex) → use full moldHeight=${moldHeight.toFixed(3)}`);
                        return;
                    }
                    const depths = seams.map(seam => {
                        const cross = theOrigami._traverseToDepth(
                            seam, v_pos, fidx, 1e6,
                            n_f, p_f, theOrigami.medial, sameVec, 0);
                        return (cross[0]-p_f[0])*n_f[0]
                             + (cross[1]-p_f[1])*n_f[1]
                             + (cross[2]-p_f[2])*n_f[2];
                    });
                    const minDepth = Math.min(...depths);
                    const clipped = Math.min(moldHeight, minDepth);
                    const wasClipped = minDepth < moldHeight;
                    if (wasClipped) clippedNeeded = true;
                    console.log(`  V${pIdx} at [${v_pos.map(x=>x.toFixed(2))}]: ${seams.length} seam(s), depths=[${depths.map(d=>d.toFixed(3))}], min=${minDepth.toFixed(3)} cm${wasClipped ? `, CLIP → ${clipped.toFixed(3)} cm` : `, no clip (≥ ${moldHeight} cm)`}`);
                });
                if (clippedNeeded) {
                    console.log(`  → walls on this face would taper at clipped vertices`);
                }
                console.groupEnd();
            });
            console.groupEnd();
        };

        // Diagnostic: runs the full mold-export pipeline for face fidx and
        // logs where the geometry lands at each stage. Helps localize a
        // "preview correct, STL wrong" divergence. Call from devtools as
        // `debugMoldExport(0)` (data index; UI label N → index N-1).
        window.debugMoldExport = (fidx) => {
            const face = theOrigami.faces[fidx];
            if (!face) { console.log(`face ${fidx}: no such face`); return; }
            const center = theOrigami.getCenter(face);
            const n_f = theOrigami.getNorm(fidx);
            const upDirArr = smult(-1, n_f);
            const p_f = theOrigami.points[face[0]];

            console.group(`debugMoldExport(${fidx}) — UI label ${fidx+1}`);
            console.log(`face vertex indices: [${face}]`);
            console.log(`face center (world): (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
            console.log(`n_f (inward, world): [${n_f.map(x => x.toFixed(3))}]`);
            console.log(`upDir (outward, world): [${upDirArr.map(x => x.toFixed(3))}]`);

            // Sanity: which side of f's plane do other face centroids sit on?
            // Confirms whether n_f is genuinely inward for this face.
            let inSide = 0, outSide = 0;
            theOrigami.faces.forEach((g, gi) => {
                if (gi === fidx) return;
                const gc = theOrigami.getCenter(g);
                const d = (gc.x - p_f[0]) * n_f[0] + (gc.y - p_f[1]) * n_f[1] + (gc.z - p_f[2]) * n_f[2];
                if (d > 0) inSide++; else outSide++;
            });
            console.log(`other face centroids: ${inSide} on +n_f side (inward), ${outSide} on -n_f side (outward)`);

            const rawMeshes = buildFaceMold(fidx, theGUI.cutterOpts);
            const exportableRaw = rawMeshes.filter(m =>
                !m.name || (!m.name.startsWith("femaleHoleDbg")
                            && !m.name.startsWith("wedgeDbg")));
            console.log(`buildFaceMold produced ${rawMeshes.length} meshes, ${exportableRaw.length} exportable`);

            const bodyMesh = exportableRaw.find(m => m.name && m.name.startsWith("mold[")) || exportableRaw[0];
            const bodyPos = bodyMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const bbWorld = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
            let sumD = 0, n = 0;
            for (let i = 0; i < bodyPos.length; i += 3) {
                const v = [bodyPos[i], bodyPos[i+1], bodyPos[i+2]];
                for (let k = 0; k < 3; k++) {
                    if (v[k] < bbWorld.min[k]) bbWorld.min[k] = v[k];
                    if (v[k] > bbWorld.max[k]) bbWorld.max[k] = v[k];
                }
                sumD += (v[0]-p_f[0])*n_f[0] + (v[1]-p_f[1])*n_f[1] + (v[2]-p_f[2])*n_f[2];
                n++;
            }
            const meanDWorld = sumD / n;
            console.log(`body mesh "${bodyMesh.name}" (world): ${n} verts, bbox min=[${bbWorld.min.map(x=>x.toFixed(2))}] max=[${bbWorld.max.map(x=>x.toFixed(2))}]`);
            console.log(`  mean signed distance from face plane along n_f: ${meanDWorld.toFixed(3)}  (negative = outward side, where mold should be)`);

            const finalMat = computeBuildPlateTransform(fidx);
            const m = finalMat.m;
            console.log(`build-plate matrix elements [m[0..15]]:`);
            console.log(`  [${m[0].toFixed(2)}, ${m[1].toFixed(2)}, ${m[2].toFixed(2)}, ${m[3].toFixed(2)}]`);
            console.log(`  [${m[4].toFixed(2)}, ${m[5].toFixed(2)}, ${m[6].toFixed(2)}, ${m[7].toFixed(2)}]`);
            console.log(`  [${m[8].toFixed(2)}, ${m[9].toFixed(2)}, ${m[10].toFixed(2)}, ${m[11].toFixed(2)}]`);
            console.log(`  [${m[12].toFixed(2)}, ${m[13].toFixed(2)}, ${m[14].toFixed(2)}, ${m[15].toFixed(2)}]`);

            // Sample a face vertex and a mold vertex through TransformCoordinates.
            const sampleFace = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(p_f[0], p_f[1], p_f[2]), finalMat);
            console.log(`face vertex p_f after transform: (${sampleFace.x.toFixed(2)}, ${sampleFace.y.toFixed(2)}, ${sampleFace.z.toFixed(2)})`);

            // Find the mold vertex furthest along upDir in world — that's the "top" of the mold.
            let topI = 0, topD = -Infinity;
            for (let i = 0; i < bodyPos.length; i += 3) {
                const d = bodyPos[i]*upDirArr[0] + bodyPos[i+1]*upDirArr[1] + bodyPos[i+2]*upDirArr[2];
                if (d > topD) { topD = d; topI = i; }
            }
            const topWorld = new BABYLON.Vector3(bodyPos[topI], bodyPos[topI+1], bodyPos[topI+2]);
            const topAfter = BABYLON.Vector3.TransformCoordinates(topWorld, finalMat);
            console.log(`mold "top" vertex (world): (${topWorld.x.toFixed(2)}, ${topWorld.y.toFixed(2)}, ${topWorld.z.toFixed(2)})`);
            console.log(`mold "top" vertex after transform: (${topAfter.x.toFixed(2)}, ${topAfter.y.toFixed(2)}, ${topAfter.z.toFixed(2)})`);
            console.log(`  →  z of mold top after transform: ${topAfter.z.toFixed(2)} (expected POSITIVE if mold extrudes upward from build plate)`);

            // Whole-body bbox after transform.
            const bbBuild = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
            const tmp = new BABYLON.Vector3();
            for (let i = 0; i < bodyPos.length; i += 3) {
                tmp.set(bodyPos[i], bodyPos[i+1], bodyPos[i+2]);
                const w = BABYLON.Vector3.TransformCoordinates(tmp, finalMat);
                if (w.x < bbBuild.min[0]) bbBuild.min[0] = w.x;
                if (w.y < bbBuild.min[1]) bbBuild.min[1] = w.y;
                if (w.z < bbBuild.min[2]) bbBuild.min[2] = w.z;
                if (w.x > bbBuild.max[0]) bbBuild.max[0] = w.x;
                if (w.y > bbBuild.max[1]) bbBuild.max[1] = w.y;
                if (w.z > bbBuild.max[2]) bbBuild.max[2] = w.z;
            }
            console.log(`body bbox after transform: min=[${bbBuild.min.map(x=>x.toFixed(2))}] max=[${bbBuild.max.map(x=>x.toFixed(2))}]`);
            console.log(`  z range: [${bbBuild.min[2].toFixed(2)}, ${bbBuild.max[2].toFixed(2)}]`);

            rawMeshes.forEach(mesh => mesh.dispose());
            console.groupEnd();
        };

        // Binary STL writer. Walks every triangle of every mesh in world
        // coords and emits the standard 80-byte header + triCount + (normal,
        // 3 verts, attr) records.
        const meshesToSTL = (meshes, extraTransform) => {
            const tris = [];
            for (const m of meshes) {
                // Skip debug ghost meshes (name prefixes "femaleHoleDbg"
                // or "wedgeDbg") so they don't appear in the exported STL.
                if (m.name && (m.name.startsWith("femaleHoleDbg") || m.name.startsWith("wedgeDbg"))) continue;
                m.computeWorldMatrix(true);
                const wm = m.getWorldMatrix();
                const finalMat = extraTransform ? wm.multiply(extraTransform) : wm;
                const positions = m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                const indices = m.getIndices();
                if (!positions || !indices) continue;
                for (let i = 0; i < indices.length; i += 3) {
                    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
                    const v0 = BABYLON.Vector3.TransformCoordinates(
                        new BABYLON.Vector3(positions[a], positions[a + 1], positions[a + 2]), finalMat);
                    const v1 = BABYLON.Vector3.TransformCoordinates(
                        new BABYLON.Vector3(positions[b], positions[b + 1], positions[b + 2]), finalMat);
                    const v2 = BABYLON.Vector3.TransformCoordinates(
                        new BABYLON.Vector3(positions[c], positions[c + 1], positions[c + 2]), finalMat);
                    tris.push([v0, v1, v2]);
                }
            }
            const buf = new ArrayBuffer(80 + 4 + tris.length * 50);
            const view = new DataView(buf);
            const header = new TextEncoder().encode("3dOrigami mold STL");
            new Uint8Array(buf, 0, 80).set(header.subarray(0, Math.min(header.length, 80)));
            view.setUint32(80, tris.length, true);
            let off = 84;
            for (const [v0, v1, v2] of tris) {
                const e1 = v1.subtract(v0);
                const e2 = v2.subtract(v0);
                const n = BABYLON.Vector3.Cross(e1, e2);
                if (n.lengthSquared() > 1e-20) n.normalize();
                view.setFloat32(off, n.x, true); off += 4;
                view.setFloat32(off, n.y, true); off += 4;
                view.setFloat32(off, n.z, true); off += 4;
                view.setFloat32(off, v0.x, true); off += 4;
                view.setFloat32(off, v0.y, true); off += 4;
                view.setFloat32(off, v0.z, true); off += 4;
                view.setFloat32(off, v1.x, true); off += 4;
                view.setFloat32(off, v1.y, true); off += 4;
                view.setFloat32(off, v1.z, true); off += 4;
                view.setFloat32(off, v2.x, true); off += 4;
                view.setFloat32(off, v2.y, true); off += 4;
                view.setFloat32(off, v2.z, true); off += 4;
                view.setUint16(off, 0, true); off += 2;
            }
            return buf;
        };

        // Trigger a browser download (Save As dialog) for the given buffer.
        const downloadBuffer = (buf, fileName, mime = 'application/octet-stream') => {
            const blob = new Blob([buf], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        // Build the (engraved) cookie-cutter mesh for face fidx. Shared by
        // the Alt+K preview and the Export Cutter button. Returns a Babylon
        // mesh; caller owns it. Falls back to an un-engraved mesh if
        // manifold or the stencil font isn't ready yet.
        const buildCutterMesh = (fidx) => {
            const r = theOrigami.getCutterPolyhedron(fidx, theGUI.cutterOpts);
            // Build the manifold directly from the polyhedron description so
            // the input to ofMesh has shared edges by construction (no
            // float-precision merge gamble like the Babylon round-trip).
            // Babylon mesh is only built as a fallback if manifold/stencil
            // aren't ready or the direct conversion fails.
            const bodyM0 = window.manifold ? polyhedronToManifold(r.pt, r.idx) : null;
            if (!bodyM0 || !window.stencilFont) {
                const baseMesh = BABYLON.MeshBuilder.CreatePolyhedron("cutter[" + fidx + "]_base",
                    { custom: { name: "Cutter", category: ["Prism"], vertex: r.pt, face: r.idx } },
                    scene);
                if (bodyM0) bodyM0.delete();
                return baseMesh;
            }
            const cOpts = theGUI.cutterOpts;
            const T = cOpts.thickness;
            const margin = cOpts.margin ?? 0;
            const baseW = cOpts.baseWidth ?? 1;
            const face = theOrigami.faces[fidx];
            const Nf = face.length;
            const n_f = theOrigami.getNorm(fidx);
            const upDir = smult(-1, n_f);
            let maxLen = 0, bestI = 0;
            for (let i = 0; i < Nf; i++) {
                const a = theOrigami.points[face[i]];
                const b = theOrigami.points[face[(i + 1) % Nf]];
                const len = vnorm(vsub(b, a));
                if (len > maxLen) { maxLen = len; bestI = i; }
            }
            const v_a = theOrigami.points[face[bestI]];
            const v_b = theOrigami.points[face[(bestI + 1) % Nf]];
            const eMid = smult(0.5, vadd(v_a, v_b));
            const eDir = vnormalize(vsub(v_b, v_a));
            const oDir = vnormalize(vXprd(eDir, n_f));
            const labelCenter = vadd(eMid, smult(margin - T - baseW / 2, oDir));
            // Generous overhang so the prism's front/back caps sit well
            // outside the flange's faces — sub-mm overhang leaves slivers
            // visible from below where the manifold subtract precision
            // gives up. 5 mm each side is plenty.
            const labelEps = 0.5;
            const labelM = buildLabelManifold(
                String(fidx + 1), 1.0, T + 2 * labelEps,
                {
                    origin: vadd(labelCenter, smult(-labelEps, upDir)),
                    x: eDir, y: oDir, z: upDir,
                });
            let bodyM = bodyM0;
            if (labelM) {
                bodyM = bodyM0.subtract(labelM);
                bodyM0.delete();
                labelM.delete();
            }
            const mesh = manifoldToBabylon(bodyM, "cutter[" + fidx + "]");
            bodyM.delete();
            return mesh;
        };

        // Wire the Export All button (created above with the toolbar).
        // Builds a Babylon mesh straight from theOrigami.points/faces, then
        // emits a binary STL of the whole polyhedron shape (cm→mm). Faces
        // are stored CW-from-outside (OpenSCAD convention) so each face is
        // fan-triangulated in REVERSED order — that makes the cross
        // product point outward, which is what MeshMixer and other STL
        // viewers expect.
        expAllBtn.onPointerClickObservable.add(() => {
            const positions = [];
            const indices = [];
            for (const face of theOrigami.faces) {
                if (face.length < 3) continue;
                const base = positions.length / 3;
                for (const pi of face) {
                    const p = theOrigami.points[pi];
                    positions.push(p[0], p[1], p[2]);
                }
                for (let k = 1; k < face.length - 1; k++) {
                    indices.push(base, base + k + 1, base + k);
                }
            }
            const vd = new BABYLON.VertexData();
            vd.positions = positions;
            vd.indices = indices;
            const mesh = new BABYLON.Mesh("polyhedron_export", scene);
            vd.applyToMesh(mesh);
            const scaleMat = BABYLON.Matrix.Scaling(10, 10, 10);
            const buf = meshesToSTL([mesh], scaleMat);
            downloadBuffer(buf, "polyhedron.stl");
            mesh.dispose();
            console.log(`STL exported for polyhedron (${theOrigami.faces.length} faces, ${indices.length / 3} triangles).`);
        });

        // Build-plate transform for STL export: translate face centroid to
        // origin, rotate so n_f (inward) points to -z. The body extrudes
        // in -n_f from the face polygon, so -n_f maps to +z and the body
        // lands ABOVE the bed with the face polygon's flat side sitting
        // on the build plate. Walls rise straight up rather than landing
        // their narrow sloped bottoms on the bed (poor adhesion). Scale
        // cm→mm.
        const computeBuildPlateTransform = (fidx) => {
            const center = theOrigami.getCenter(theOrigami.faces[fidx]);
            const n_f = theOrigami.getNorm(fidx);
            const sourceN = new BABYLON.Vector3(n_f[0], n_f[1], n_f[2]);
            const targetN = new BABYLON.Vector3(0, 0, -1);
            const cosA = BABYLON.Vector3.Dot(sourceN, targetN);
            let q;
            if (cosA > 1 - 1e-10) {
                q = BABYLON.Quaternion.Identity();
            } else if (cosA < -1 + 1e-10) {
                q = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(1, 0, 0), Math.PI);
            } else {
                const axis = BABYLON.Vector3.Cross(sourceN, targetN).normalize();
                q = BABYLON.Quaternion.RotationAxis(axis, Math.acos(cosA));
            }
            const tMat = BABYLON.Matrix.Translation(-center.x, -center.y, -center.z);
            const rMat = new BABYLON.Matrix();
            q.toRotationMatrix(rMat);
            const sMat = BABYLON.Matrix.Scaling(10, 10, 10);
            return tMat.multiply(rMat).multiply(sMat);
        };

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
                // Per-face inset prism geometry as a JS data array, using v2
                // medial + current insetDepth slider. World-matrix-transformed
                // so plan-mode positions are baked in.
                let str = "data=[\n";
                theOrigami.faces.forEach((f, fi) => {
                    const wm = theOrigami.faceMeshes[fi].getWorldMatrix(true);
                    const r = theOrigami.getInsetPolyhedron(fi, theOrigami.medial, theOrigami.insetDepth);
                    str += "[[";
                    r.pt.forEach(p => {
                        const lp = global(p, wm);
                        str += "[" + lp.x + "," + lp.y + "," + lp.z + "],";
                    });
                    str += "],\n[";
                    r.idx.forEach(p => str += "[" + p + "],");
                    str += "]],\n";
                });
                str += "];";
                navigator.clipboard.writeText(str);
            } else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP &&
                kbInfo.event.key == "b" &&
                kbInfo.event.ctrlKey) {
                // SVG path of each face's inset polygon outline (v2 layout
                // puts the inset polygon at idx[0]).
                let str = "";
                theOrigami.faces.forEach((f, fi) => {
                    const wm = theOrigami.faceMeshes[fi].getWorldMatrix(true);
                    const r = theOrigami.getInsetPolyhedron(fi, theOrigami.medial, theOrigami.insetDepth);
                    r.idx[0].forEach((idx, i) => {
                        const lp = global(r.pt[idx], wm);
                        str += (i == 0 ? "M " : "L ");
                        str += (lp.x + " " + lp.z + " ");
                    });
                    str += "z\n";
                });
                navigator.clipboard.writeText(str);
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
            } else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP &&
                kbInfo.event.key.toLowerCase() == "s" &&
                kbInfo.event.altKey) {
                // STL export of the selected face's mold piece. The mold is
                // built as separate shells (body + tabs + snaps), then
                // boolean-unioned via manifold into a single watertight solid
                // — Cura was leaving "unsliced" gaps at coplanar surfaces
                // between the body wall and the tab front/back when the
                // shells stayed separate.
                if (!theOrigami.selectedF) {
                    noSelectionModal.show();
                    return;
                }
                const fidx = theOrigami.faces.indexOf(theOrigami.selectedF);
                if (fidx < 0) return;
                const rawMeshes = buildFaceMold(fidx, theGUI.cutterOpts);
                // Strip debug ghost meshes BEFORE unioning, otherwise the
                // union folds them into "moldUnion" and the STL contains
                // the cutter cube + wedge ghost.
                const exportableRaw = rawMeshes.filter(m =>
                    !m.name || (!m.name.startsWith("femaleHoleDbg")
                                && !m.name.startsWith("wedgeDbg")));
                const meshes = unionMeshes(exportableRaw);
                if (meshes !== exportableRaw) exportableRaw.forEach(m => m.dispose());

                const finalMat = computeBuildPlateTransform(fidx);
                const buf = meshesToSTL(meshes, finalMat);
                downloadBuffer(buf, "mold_face_" + fidx + ".stl");
                meshes.forEach(m => m.dispose());
                console.log(`STL exported for face ${fidx} (${meshes.length} meshes).`);
            } else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP &&
                kbInfo.event.key.toLowerCase() == "k" &&
                kbInfo.event.altKey) {
                // Cookie-cutter preview overlaid on the selected face.
                scene.getMeshesByTags("cutter_vis").forEach(m => m.dispose());
                if (!theOrigami.selectedF) {
                    // No selection: dismiss any preview state and restore
                    // visibility of all prism faces.
                    theOrigami.faceMeshes.forEach(fm => { if (fm) fm.isVisible = true; });
                    console.warn("Alt+K: select a face first to preview its cookie cutter");
                    return;
                }
                const fidx = theOrigami.faces.indexOf(theOrigami.selectedF);
                if (fidx < 0) return;
                // Hide every prism face except the selected one so the cutter
                // bevel angles can be inspected without other prisms in the way.
                theOrigami.faceMeshes.forEach((fm, i) => {
                    if (fm) fm.isVisible = (i === fidx);
                });
                const mesh = buildCutterMesh(fidx);
                const mat = new BABYLON.StandardMaterial("cutterMat" + fidx, scene);
                mat.diffuseColor = new BABYLON.Color3(1, 0.4, 0);
                mat.alpha = 0.6;
                mat.backFaceCulling = false;
                mesh.material = mat;
                BABYLON.Tags.AddTagsTo(mesh, "cutter_vis");
                console.log(`Cookie cutter for face ${fidx + 1}`);
            } else if (kbInfo.type == BABYLON.KeyboardEventTypes.KEYUP &&
                kbInfo.event.key.toLowerCase() == "m" &&
                kbInfo.event.altKey) {
                // Mold-pieces preview: one mold per face, all overlaid on the
                // polyhedron.
                scene.getMeshesByTags("mold_vis").forEach(m => m.dispose());
                scene.getMeshesByTags("cutter_vis").forEach(m => m.dispose());
                theOrigami.faceMeshes.forEach(fm => { if (fm) fm.isVisible = true; });
                const opts = theGUI.cutterOpts;
                theOrigami.faces.forEach((_, fidx) => {
                    const meshes = buildFaceMold(fidx, opts);
                    meshes.forEach(m => BABYLON.Tags.AddTagsTo(m, "mold_vis"));
                });
                console.log(`Mold pieces shown for ${theOrigami.faces.length} faces.`);
            }
        });

        //mouse handling

        let startingPoint;
        let currentMesh;
        const getGroundPosition = function () {
            // Intersect the pointer ray with the y=0 plane analytically
            // (the ground mesh is isPickable=false so scene.pick wouldn't
            // return it). Returns null if the ray runs parallel to or
            // away from the plane.
            const ray = scene.createPickingRay(
                scene.pointerX, scene.pointerY,
                BABYLON.Matrix.Identity(), scene.activeCamera);
            if (Math.abs(ray.direction.y) < 1e-9) return null;
            const t = -ray.origin.y / ray.direction.y;
            if (t < 0) return null;
            return ray.origin.add(ray.direction.scale(t));
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

const noSelectionModal = new bootstrap.Modal('#noSelectionDialog');

const cutterOptModal = new bootstrap.Modal('#cutterOptDialog');
document.getElementById('cutterOptOk').addEventListener("click", () => {
    const parse = (id, fallback) => {
        const v = parseFloat(document.getElementById(id).value);
        return isNaN(v) ? fallback : v;
    };
    const o = theGUI.cutterOpts;
    theGUI.cutterOpts = {
        margin: parse("cutterMargin", o.margin),
        height: parse("cutterHeight", o.height),
        thickness: parse("cutterThickness", o.thickness),
        baseWidth: parse("cutterBaseWidth", o.baseWidth),
        moldWidth: parse("cutterMoldWidth", o.moldWidth),
        moldHeight: parse("cutterMoldHeight", o.moldHeight),
        tabRadius: parse("cutterTabRadius", o.tabRadius),
        angle: parse("cutterAngle", o.angle)
    };
    cutterOptModal.hide();
});

const gW = 30; gH = 30;
function createGround(nb, old = null) {
    if (old != null) {
        old.ground.dispose();
        old.lines.forEach(l => l.dispose());
    }
    const g = BABYLON.MeshBuilder.CreateGround("ground", { width: gW * nb, height: gH });
    g.position = new BABYLON.Vector3(gW * (1 - nb) * 0.5, 0, 0)
    // Don't capture mouse events — picking should pass through to face
    // meshes behind the ground. Plan-mode drag intersects the y=0 plane
    // analytically (see getGroundPosition).
    g.isPickable = false;
    const l = []
    for (let i = 0; i < nb - 1; ++i) {
        l.push(BABYLON.MeshBuilder.CreateLines("gl1", { points: [new BABYLON.Vector3(gW * (-0.5 - i), 0, gH / 2), new BABYLON.Vector3(gW * (-0.5 - i), 0, -gH / 2)] }));
        l[i].color = new BABYLON.Color3(0, 0, 0);
        l[i].isPickable = false;
    }
    return { ground: g, lines: l };
}
