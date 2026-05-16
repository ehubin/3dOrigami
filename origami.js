const Palette = [[230, 25, 75], [60, 180, 75], [255, 225, 25], [0, 130, 200], [245, 130, 48], [145, 30, 180], [70, 240, 240], [240, 50, 230], [210, 245, 60], [250, 190, 212], [0, 128, 128], [220, 190, 255], [170, 110, 40], [255, 250, 200], [128, 0, 0], [170, 255, 195], [128, 128, 0], [255, 215, 180], [0, 0, 128], [128, 128, 128], [255, 255, 255], [0, 0, 0]].map((c)=>BABYLON.Color3.FromInts(c[0],c[1],c[2]));
const SphD=0.2;

//vect utilities
function vsub(a,b)  { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function vadd(a,b)  { return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function vdot(a,b)  { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function vXprd(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-b[0]*a[1]];}
function smult(scal,a) { return [scal*a[0],scal*a[1],scal*a[2]];}
function vnorm(v) { return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);}
function vnormalize(v) { return smult(1/vnorm(v),v); }
function vbissec(v0,v1,v2,v3,tw) { 
    let v01=vsub(v1,v0),v12=vsub(v2,v1),v31=vsub(v1,v3);
    return tw?vsub(vnormalize(vXprd(v01,v12)),vnormalize(vXprd(v01,v31))):
              vadd(vnormalize(vXprd(v01,v12)),vnormalize(vXprd(v01,v31)));
}

class Origami {            
    points=null;
    faces=null;
    flatPos=[];
    flatQuat=[];
    name="";
    planMode=false;
    faceMeshes=[];
    faceLabels=[];
    VSelMeshes=null;
    ESelMeshes=[];
    selectedF=null;
    selectedE=-1;
    selectedV=-1;
    GUI=null;
    medial=null;
    insetDepth=1;
    constructor(scene,gui,pts,fa,na="<Sans Nom>",fpos=null,fqat=null) {
        this.GUI=gui;
        this.name=na;
        gui.setName(na);
        this.points=pts;
        this.faces=fa;
        this.refreshMedial();
        fa.forEach((f,idx)=>{
            this.createFaceMesh(f,idx,scene);
            this.flatQuat.push(fqat==null?this.getRot(f):fqat[idx]);
            this.flatPos.push(fpos==null?this.getCenter(f).scale(-1):fpos[idx]);
        });
    }
    refreshMedial(maxThickness=10) {
        this.checkClosure();
        try {
            this.medial = (typeof computeMedialTracing === "function")
                ? computeMedialTracing(this, maxThickness)
                : null;
        } catch (e) {
            console.warn("Medial axis computation failed:", e);
            this.medial = null;
        }
    }

    // Check that every edge belongs to exactly two faces. Warns when the
    // polyhedron is not a closed manifold — medial-axis-derived prisms only
    // make geometric sense for closed shapes, and the tracer's output is at
    // best a heuristic when run on an open shell. Caches the last signature
    // so we don't spam identical warnings on every edit.
    checkClosure() {
        const edgeCount = new Map();
        const key = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
        this.faces.forEach(face => {
            for (let i = 0; i < face.length; i++) {
                const k = key(face[i], face[(i+1) % face.length]);
                edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
            }
        });
        const boundary = [], nonManifold = [];
        edgeCount.forEach((c, k) => {
            if (c < 2) boundary.push(k);
            else if (c > 2) nonManifold.push(`${k}(×${c})`);
        });
        const sig = `b:${boundary.join('|')}|n:${nonManifold.join('|')}`;
        if (sig !== this._closureSig) {
            this._closureSig = sig;
            if (boundary.length || nonManifold.length) {
                console.warn(
                    `Origami "${this.name}" is not a closed manifold — medial-axis output may be unreliable.` +
                    (boundary.length ? `\n  boundary edges (${boundary.length}): ${boundary.join(' ')}` : '') +
                    (nonManifold.length ? `\n  non-manifold edges (${nonManifold.length}): ${nonManifold.join(' ')}` : ''));
            }
        }
        return { closed: boundary.length === 0 && nonManifold.length === 0, boundary, nonManifold };
    }
    switch(ui,scene) {
        if(this.planMode) {
            this.planMode=false;
            ui.switchMode(false);
            this.faceMeshes.forEach((fm,i)=>{
                fm.rotationQuaternion=BABYLON.Quaternion.Zero();
                fm.position=BABYLON.Vector3.Zero();
            });
        } else {
            this.unselectFace(scene);
            this.planMode=true;
            ui.switchMode(true);
            this.faceMeshes.forEach((fm,i)=>{
                fm.rotationQuaternion=this.flatQuat[i];
                fm.position=this.flatPos[i];
            });
        }
    }
    getCenter(f) {
        let sum=[0,0,0];
        for(let p of f) sum=vadd(sum,this.points[p]);
        return BABYLON.Vector3.Zero().fromArray(smult(1/f.length,sum));
    }
    email() {
        let exportVal=JSON.stringify(
            {   name:this.name,
                pt:this.points,
                f:this.faces,
                fPos:this.flatPos,
                fQuat:this.flatQuat
            });
        navigator.clipboard.writeText(exportVal);
        window.location.href = "mailto:?subject=Origami: " + this.name+"&body= clique droit coller pour rajouter les données de l'origami\n\n";
    }
    import() { importModal.show(); }

    open(scene) {
        if(!localStorage.hasOwnProperty("saved")) {
            alert("Aucun origami enregistré!");
            return;
        }
        const allOrig=JSON.parse(localStorage.saved);
        let ih="";
        allOrig.forEach((or,i)=>{ih=ih+pattern(i==0?"active":"",or,i);});
        theList.innerHTML=ih;
        openModal.show();
    }
    disposeAll() {
        if(this.faceMeshes!= null) this.faceMeshes.forEach(f=>{f.dispose();})
        if(this.faceLabels!= null) this.faceLabels.forEach(l=>{ if(l && l.plane) l.plane.dispose(false, true); })
        if(this.VSelMeshes!= null) this.VSelMeshes.forEach(sm=>{sm.dispose();})
        if(this.ESelMeshes!= null) this.ESelMeshes.forEach(sm=>{sm.dispose();})
    }

    save() {
        txt.value=this.name;
        saveModal.show();
    }

    createFaceMesh(f,idx,scene) {
        let vertex, faces;
        if (this.medial && this.medial.seams && this.medial.seams.length > 0) {
            // Medial-axis-correct inset prism (notched at degenerate vertices).
            const r = this.getInsetPolyhedron(idx, this.medial, this.insetDepth);
            vertex = r.pt;
            faces = r.idx;
        } else {
            // Fallback: simple bevel prism via _computeVDir.
            const n = f.length;
            vertex = this.computeFaceVertex(f, idx);
            const top = [];
            for (let i = 0; i < n; ++i) top.push(i);
            const bottom = [];
            for (let i = n - 1; i >= 0; --i) bottom.push(n + i);
            const sides = [];
            for (let i = 0; i < n; ++i) {
                const j = (i + 1) % n;
                sides.push([j, i, n + i, n + j]);
            }
            faces = [top, bottom, ...sides];
        }
        const customMesh = { "name": "Face Prism", "category": ["Prism"],
            "vertex": vertex,
            "face": faces };
        const Prism = BABYLON.MeshBuilder.CreatePolyhedron("Face["+idx+"]", {custom: customMesh}, scene);
        Prism.actionManager =new BABYLON.ActionManager(scene);
        let _t=this;
        Prism.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, 
            function (evt) { _t.selectFace(f,scene); }));
        Prism.setPivotPoint(this.getCenter(f));    

        const material = new BABYLON.StandardMaterial("material", scene);
        material.diffuseColor = Palette[idx%Palette.length];
        material.alpha=0.5;
        material.backFaceCulling = false;
        material.separateCullingPass = true;
        Prism.material = material;
        this.faceMeshes[idx]=Prism;
        if(this.planMode) {
            Prism.rotationQuaternion=this.flatQuat[idx];
            Prism.position=this.flatPos[idx];
        }
        // Face number rendered on a small billboarded plane parented to the
        // prism — sits in 3D space so it gets depth-sorted and blended
        // through translucent faces in front of it (and is occluded by
        // opaque ones), unlike a fullscreen-UI TextBlock which always
        // draws on top. The plane is offset slightly along the face
        // normal to avoid z-fighting with the prism surface.
        const center = this.getCenter(f);
        const n = this.getNorm(idx);
        // Scale the label with the polyhedron's overall dimension. The
        // baseline (size 4 cm at dim 30) reads well; smaller/larger objects
        // get proportionally adjusted labels and z-fight offset.
        const dim = this.getDimension() || 30;
        const labelSize = dim / 7.5;
        const labelOffset = dim / 300;
        const labelPlane = BABYLON.MeshBuilder.CreatePlane(
            "Label[" + idx + "]",
            { size: labelSize, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
            scene);
        labelPlane.position = new BABYLON.Vector3(
            center.x + n[0] * labelOffset,
            center.y + n[1] * labelOffset,
            center.z + n[2] * labelOffset);
        labelPlane.parent = Prism;
        labelPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        labelPlane.isPickable = false;

        const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(labelPlane, 256, 256);
        adt.background = "transparent";
        const lbl = new BABYLON.GUI.TextBlock();
        lbl.text = String(idx + 1);
        // Tint with a darkened (or lightened, for very dark hues) version
        // of the face palette colour so each number is visually tied to
        // its face.
        const fc = Palette[idx % Palette.length];
        const luma = 0.299 * fc.r + 0.587 * fc.g + 0.114 * fc.b;
        let lr, lg, lb;
        if (luma > 0.3) {
            lr = fc.r * 0.6; lg = fc.g * 0.6; lb = fc.b * 0.6;
        } else {
            lr = fc.r + (1 - fc.r) * 0.5;
            lg = fc.g + (1 - fc.g) * 0.5;
            lb = fc.b + (1 - fc.b) * 0.5;
        }
        lbl.color = `rgb(${Math.round(lr*255)},${Math.round(lg*255)},${Math.round(lb*255)})`;
        lbl.fontSize = 200;
        lbl.fontWeight = "bold";
        lbl.outlineWidth = 20;
        lbl.outlineColor = "black";
        adt.addControl(lbl);

        this.faceLabels[idx] = { plane: labelPlane, textBlock: lbl };
    }
    computeFaceVertex(f,fidx) {
        const e=1;
        let dir=this.computeFdir(f,fidx,e);
        let bottom=f.map(pi=>this.points[pi]);
        return [...dir, ...bottom];
       
        /*let e=0.02; //face thickness

        let p0=this.points[f[0]],p1=this.points[f[1]],p2=this.points[f[2]];
        let p02=vsub(p2,p0);
        let p01=vsub(p1,p0);                      
        let dirs=this.computeFdir(f,fidxe);
        if(this.vDir.length>0)  {
            let norm = vnormalize(vXprd(p02,p01));
            e=1;
            return [vsub(p0,smult(e/vdot(norm,this.vDir[f[0]]),this.vDir[f[0]])), 
                    vsub(p1,smult(e/vdot(norm,this.vDir[f[1]]),this.vDir[f[1]])), 
                    vsub(p2,smult(e/vdot(norm,this.vDir[f[2]]),this.vDir[f[2]])),
                    p0,p1,p2
                    ];
        } else {
            let norm = smult(e,vnormalize(vXprd(p02,p01)));
            return [vsub(p0,norm), vsub(p1,norm), vsub(p2,norm),
                    vadd(p0,norm), vadd(p1,norm), vadd(p2,norm)]; 
        } 
        */  
    }
    translateV(dir,scene) {
        if(this.selectedF==null|| this.selectedF==-1) return;
        if(this.planMode ) {
            let sel=this.faces.indexOf(this.selectedF);
            this.faceMeshes[sel].position.addInPlace( new BABYLON.Vector3(dir[0]*0.1,0,dir[1]*0.1));
            this.flatPos[sel]=this.faceMeshes[sel].position;
        } else {
            if(this.selectedV==-1) return;
            let f=this.selectedF,v=this.points[f[this.selectedV]];
            let from=this.points[f[(this.selectedV+2)%3]],to=this.points[f[(this.selectedV+1)%3]];
            let base=vsub(to,from),fromv=vsub(v,from);
            let h=vsub(v, vadd(from,smult(vdot(fromv,base)/vdot(base,base),base)) );
            //console.log(this.selectedV+"|"+f+" - "+v+" - "+base+ " ,from:"+from+" ,to:"+to);
            v[0]+=(dir[0]*base[0]+dir[1]*h[0])/10;
            v[1]+=(dir[0]*base[1]+dir[1]*h[1])/10;
            v[2]+=(dir[0]*base[2]+dir[1]*h[2])/10;
            this.updateVertex(v,f[this.selectedV],scene);
            this.VSelMeshes[this.selectedV].position=new BABYLON.Vector3(v[0], v[1], v[2]);
            this.reComputeESel(this.selectedF);
        }
        this.updateUIDim();
    }
    rotateFace(angle,scene) {
        if(this.selectedF==null) return;
        if(this.planMode) {
            let sel=this.faces.indexOf(this.selectedF);
            this.faceMeshes[sel].rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0,1,0),angle*Math.PI/180).multiplyInPlace(this.faceMeshes[sel].rotationQuaternion);
            this.flatQuat[sel]=this.faceMeshes[sel].rotationQuaternion;
        } else {
            if(this.selectedV==-1) return;
            let f=this.selectedF,v=this.points[f[this.selectedV]];
            let from=this.points[f[(this.selectedV+2)%3]],to=this.points[f[(this.selectedV+1)%3]];
            let base=BABYLON.Vector3.Zero().fromArray(vnormalize(vsub(to,from))),la=BABYLON.Vector3.Zero().fromArray(vsub(v,from));
            let rotQ=BABYLON.Matrix.RotationAxis(base,angle*Math.PI/180);
            la=BABYLON.Vector3.TransformCoordinates(la,rotQ);
            v[0]=la.x+from[0];
            v[1]=la.y+from[1];
            v[2]=la.z+from[2];
            
            this.updateVertex(v,f[this.selectedV],scene);
            this.VSelMeshes[this.selectedV].position=new BABYLON.Vector3(v[0], v[1], v[2]);
            this.reComputeESel(this.selectedF);
        }
        this.updateUIDim();
    }
    

    updateVertex(v,idx,scene) {
        // Moving any vertex changes the medial axis globally, so refresh
        // the cache and rebuild every face mesh (not just the affected ones).
        this.refreshMedial();
        this.faces.forEach((f,i)=>{
            this.faceMeshes[i].dispose();
            this.createFaceMesh(f,i,scene);
            this.flatPos[i]=this.getCenter(f).scale(-1);
            this.flatQuat[i]=this.getRot(f);
        });
    }
    selectFace(f,scene) {
        if(this.VSelMeshes==null) {
            this.VSelMeshes = [];
            for(let k=0;k<10;++k) this.VSelMeshes.push(BABYLON.Mesh.CreateSphere("p"+k, 10, SphD, scene,true));
        
            this.VSelMeshes.forEach((m,i)=>{
                m.material = new BABYLON.StandardMaterial("material", scene);
                m.actionManager =new BABYLON.ActionManager(scene);
                let _t=this;
                m.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, 
                    function (evt) { _t.selectVertex(i,scene); }));
            });
        }
        if(this.planMode) {
            this.selectedF=f;
        } else {
            this.reComputeESel(f);
            for(let j=f.length;j<10;++j) {
                this.VSelMeshes[j].isVisible = false;
            }
            this.selectedF=f;
            this.selectEdge(-1,scene);
            this.selectVertex(-1,scene);
            console.log("Selected "+f+"("+this.faces.indexOf(f)+")");
        }
    }
    unselectFace(scene) {
        if(this.VSelMeshes != null) {
            for(let j=0;j<this.VSelMeshes.length;++j) {
            this.VSelMeshes[j].isVisible = false;
            }
        }
        this.ESelMeshes.forEach(m=>m.dispose());
        this.ESelMeshes=[];
        this.selectedF=null;
        this.selectEdge(-1,scene);
        this.selectVertex(-1,scene); 
    }
    reComputeESel(f) {
        //compute average side length
        let fSize=vnorm(vsub(this.points[f[0]],this.points[f[f.length-1]]));
        for(let i=0;i<f.length-1;++i) fSize+=vnorm(vsub(this.points[f[i]],this.points[f[i+1]]));
        fSize=fSize/f.length;
        console.log(fSize);
        this.ESelMeshes.forEach(m=>m.dispose());
        this.ESelMeshes=[];
        for(let j=0;j<f.length;++j) {
            let p= this.points[f[j]];
            this.VSelMeshes[j].position = new BABYLON.Vector3(p[0], p[1], p[2]);
            this.VSelMeshes[j].scaling = new BABYLON.Vector3(fSize,fSize,fSize);
            this.VSelMeshes[j].isVisible=true;                   
            this.ESelMeshes.push(this.getEdgeCyl(f,j,scene,fSize));
        }
    }
    getEdgeCyl(f,edgeIdx,scene,fSize) {
            let p1=new BABYLON.Vector3().fromArray(this.points[f[edgeIdx]]);
            let p2=new BABYLON.Vector3().fromArray(this.points[f[(edgeIdx+1)%f.length]]);
            let distance = BABYLON.Vector3.Distance(p1,p2 )-SphD*fSize;
        
            let cylinder = BABYLON.MeshBuilder.CreateCylinder("cylinder", 
                {height:distance, diameterTop:0.1*fSize, diameterBottom:0.1*fSize, tessellation:6, subdivisions:1}, scene);
            cylinder.material = new BABYLON.StandardMaterial("material", scene);
            cylinder.actionManager =new BABYLON.ActionManager(scene);
            let _t=this;
            cylinder.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, 
                function (evt) { _t.selectEdge(edgeIdx,scene); }));
            let diff=p2.subtract(p1);
            //position cylinder in between p1 and p2
            cylinder.position = p1.add(diff.scale(0.5));              
            // rotate as needed
            let rot=BABYLON.Quaternion.Zero();
            BABYLON.Quaternion.FromUnitVectorsToRef(new BABYLON.Vector3(0,1, 0), diff.normalize(),rot );
            cylinder.rotationQuaternion=rot;
            return cylinder;
    }
    selectVertex(i,scene) {
        if(this.VSelMeshes != null) this.VSelMeshes.forEach((m,idx)=> { m.material.diffuseColor=(i==idx?BABYLON.Color3.Yellow():BABYLON.Color3.White()); });
        this.selectedV=i;
        if(i>=0) console.log("Selected V"+this.selectedF[i]+"("+i+")");
    }
    selectEdge(i,scene) {
        this.ESelMeshes.forEach((m,idx)=> { m.material.diffuseColor=(i==idx?BABYLON.Color3.Yellow():BABYLON.Color3.White()); });
        this.selectedE=i;
        
    }
    newFace(scene) {
        if(this.selectedE<0) return;
        let p1i=this.selectedF[this.selectedE], p2i=this.selectedF[(this.selectedE+1)%this.selectedF.length];
        let p1=new BABYLON.Vector3().fromArray(this.points[p1i]);
        let p2=new BABYLON.Vector3().fromArray(this.points[p2i]);
        if(this.findFacesContaining(p1i,p2i).length ==2) return; // edge already has 2 faces cannot add one
        let cam=scene.activeCamera.getForwardRay().direction;
        let base=p2.subtract(p1);
        let mid=p1.add(base.scale(0.5));
        //let lines = BABYLON.MeshBuilder.CreateLines("lines", { points:[mid,mid.add(cam)] }, scene);
        cam.applyRotationQuaternionInPlace(BABYLON.Quaternion.RotationAxis(base.clone(),120*Math.PI/180));
        let newPt=mid.add(cam.scale(0.707*base.length()));
        //console.log(newPt);
        let newFace=[p2i,p1i,this.points.length];
        this.points.push([newPt.x,newPt.y,newPt.z]);
        this.faces.push(newFace);
        this.flatPos.push(this.getCenter(newFace).scale(-1));
        this.flatQuat.push(this.getRot(newFace));               
        this.createFaceMesh(newFace,this.faces.length-1,scene);
        this.selectFace(newFace,scene);
        this.updateUIDim();
    }
    extendFace(scene) {
        if(this.selectedE<0) return;
        let p1i=this.selectedE, p2i=(this.selectedE+1)%f.length;
        let p1=new BABYLON.Vector3().fromArray(this.points[p1i]);
        let p2=new BABYLON.Vector3().fromArray(this.points[p2i]);
        this.updateUIDim();

    }
    findFacesContaining(p1,p2) {
        let res=[];
        this.faces.forEach( (f,fidx)=>{
            let hasp1=false,hasp2=false;
            f.forEach(v=>{if(v==p1) hasp1=true; else if(v==p2) hasp2=true;});
            if(hasp1 && hasp2) res.push(fidx);
        })
        return res;
    }
    // find a vertex on another face than tfidx containing the edge p1,p2
    findVOtherFaceContaining(p1,p2,tfidx) {
        //console.log(" findVOtherFaceContaining "+p1+", "+p2+", not "+this.faces[tfidx]);
        for(let fidx=0; fidx<this.faces.length;++fidx) {
            if(fidx== tfidx) continue;
            let f=this.faces[fidx],hasp1=false,hasp2=false;
            f.forEach(v=>{if(v==p1) hasp1=true; else if(v==p2) hasp2=true;});
            if(hasp1 && hasp2) {
                // Return the cyclic neighbour of p1 in f that isn't p2.
                // For a triangle this is the third vertex; for a quad/n-gon
                // it's the edge-adjacent vertex along p1's other side.
                const idx = f.indexOf(p1);
                const prev = f[(idx + f.length - 1) % f.length];
                const next = f[(idx + 1) % f.length];
                const p = (prev === p2) ? next : prev;
                return [fidx, p];
            }
        }
        return null;
    }
    
    closeFacefromV(scene) {
        if(this.selectedV <0) return;
        let curV=this.selectedF[this.selectedV];
        let fe=Array.from(this.findFreeEdges(curV).values());
        if(fe.length != 2) return;
        let newFace=[curV];
        //insert other vertex in right order to preserve CCW order seen from outside
        // this ensures normal calculation is consistent across faces
        let of = this.faces.find(f=>{
            let hasp1=false,hasp2=false;
            f.forEach(ver=>{if(ver==curV) hasp1=true; else if(ver==fe[0]) hasp2=true;});
            if(hasp1 && hasp2) return true; else return false;
        });
        let i1=of.findIndex(v=>v==curV), i2=of.findIndex(v=>v==fe[0]);
        if (i1==2 && i2==0 || i2==i1+1) {
            newFace.push(fe[1]); newFace.push(fe[0]);
        } else {
            newFace.push(fe[0]); newFace.push(fe[1]);
        }
      
        this.faces.push(newFace);               
        this.createFaceMesh(newFace,this.faces.length-1,scene);
        this.selectFace(newFace,scene);
        this.flatPos.push(this.getCenter(newFace).scale(-1));
        this.flatQuat.push(this.getRot(newFace));

    }
    findFreeEdges(v) {
        let s=new Set();
        this.faces.forEach( (f)=>{
            f.some((vert,vIdx)=>{
                if(vert==v) {
                    let prev=f[vIdx==0?f.length-1:vIdx-1];
                    let next=f[vIdx==f.length-1?0:vIdx+1];
                    if(s.has(prev)) { s.delete(prev);} else {s.add(prev);}
                    if(s.has(next)) { s.delete(next);} else {s.add(next);}
                    return true;
                }
                return false;
            });
        });
        return s;
    }
    findEdges(v) {
        let s=new Set();
        this.faces.forEach( (f)=>{
            f.some((vert,vIdx)=>{
                if(vert==v) {
                    let prev=f[vIdx==0?f.length-1:vIdx-1];
                    let next=f[vIdx==f.length-1?0:vIdx+1];
                    s.add(prev);
                    s.add(next);
                    return true;
                }
                return false;
            });
        });
        return s;
    }

    deleteFace(scene) {

        if(this.selectedF==null) return;
        let toBeDeleted=[];
        this.selectedF.filter(v=>{
            let found=false;
            top:
            for(const f of this.faces) {
                if(f != this.selectedF) {
                    for(const ov of f) { 
                        if(ov==v) {
                            found=true
                            break top;
                        }
                    }
                }
            }
            if(!found) toBeDeleted.push(v);
        });
        let sel=this.faces.indexOf(this.selectedF);
        this.unselectFace(scene);
        this.faces.splice(sel,1);
        this.faceMeshes[sel].dispose();
        this.faceMeshes.splice(sel,1);
        this.flatPos.splice(sel,1);
        this.flatQuat.splice(sel,1);
        // Drop the deleted face's label (its plane was already disposed as a
        // child of the deleted prism) and re-text the subsequent ones so
        // the displayed numbers stay contiguous from 1.
        this.faceLabels.splice(sel,1);
        for(let i=sel;i<this.faceLabels.length;++i) {
            if(this.faceLabels[i] && this.faceLabels[i].textBlock) {
                this.faceLabels[i].textBlock.text=String(i+1);
            }
        }
        for(const v of toBeDeleted) this.delPt(v);
        this.updateUIDim();
    }
    delPt(vIdx) {
        this.points.splice(vIdx,1);
        for(const f of this.faces) {
            for(let i=0;i<f.length;++i) if(f[i]>vIdx) --f[i];
        }
    }

    isClosed() {
        const edges=new Set();
        let id=0;
        for(f of this.faces) {
            id=getUid(f[0],f[f.length-1]);
            if(edges.has(id)) edges.delete(id); else edges.add(id);
            for(let i=0;i<f.length-2;++i) {
                id=getUid(f[i],f[i+1]);
                if(edges.has(id)) edges.delete(id); else edges.add(id);
            } 
        }
        return edges.size ==0;

    }
    getUid(p1,p2) { if(p1>p2) return p1+65536*p2; else return p2+65536*p1;}

    getRot(f) {
        let v1=vsub(this.points[f[0]],this.points[f[1]]);
        let v2=vsub(this.points[f[2]],this.points[f[1]]);
        const n= vnormalize(vXprd(v2,v1));
        const fwd=vnormalize(vadd(v1,v2));
        return BABYLON.Quaternion.FromLookDirectionLH(BABYLON.Vector3.Zero().fromArray(fwd),BABYLON.Vector3.Zero().fromArray(n)).invert();
    }
    updateUIDim() {   this.GUI.dimInput.text=Math.round(this.getDimension());}
 
    getDimension() {
        let p1,p2,max=0,cur;
        for(let i=0;i<this.points.length;++i) {
            for(let j=i+1;j<this.points.length;++j) {
                p1=this.points[i],p2=this.points[j];
                cur=vnorm(vsub(p1,p2));
                if(cur>max) max=cur;
            }
        }
        return max;
    }
    setDimension(newDim,scene) {
        if (isNaN(newDim)) return;
        console.log("++>"+newDim);
        let curDim=this.getDimension();
        if(newDim == Math.round(curDim)) {
            console.log(newDim+ "=> no dim change");
        } else {
            let sc=newDim/curDim;
            this.points.forEach(p=>{p[0]*=sc;p[1]*=sc;p[2]*=sc});
            // Vertices changed -> medial axis cache is stale; recompute
            // before rebuilding face meshes.
            this.refreshMedial();
            this.unselectFace(scene);
            this.faces.forEach((f,idx)=>{
                this.faceMeshes[idx].dispose();
                this.createFaceMesh(f,idx,scene);
                this.flatPos[idx]=this.getCenter(f).scale(-1);
                this.flatQuat[idx]=this.getRot(f);
            });
        }
    }
    // 2D footprint of face fi as it sits on the build plate in plan mode:
    // vertices rotated by getRot(f) (face plane → horizontal) and projected
    // onto the (x,z) plane, centered at the face centroid.
    getFaceFootprint2D(fi) {
        const f = this.faces[fi];
        const center = this.getCenter(f);
        const rot = this.getRot(f);
        return f.map(pi => {
            const p3 = BABYLON.Vector3.FromArray(this.points[pi]).subtract(center);
            const out = BABYLON.Vector3.Zero();
            p3.rotateByQuaternionToRef(rot, out);
            return [out.x, out.z];
        });
    }

    getFaceFootprintArea(fi) {
        const verts = this.getFaceFootprint2D(fi);
        let a = 0;
        for (let i = 0; i < verts.length; i++) {
            const j = (i + 1) % verts.length;
            a += verts[i][0] * verts[j][1] - verts[j][0] * verts[i][1];
        }
        return Math.abs(a) / 2;
    }

    // Apply a packed layout to plan-mode positions/rotations.
    // placements: [{i, x, z, rotation_deg}] — each face's centroid placed at
    // (x, 0, z) in world coords with an extra y-axis rotation by rotation_deg.
    applyFlatLayout(placements, scene) {
        placements.forEach(p => {
            const yRot = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), p.rotation * Math.PI / 180);
            const baseRot = this.getRot(this.faces[p.i]);
            this.flatQuat[p.i] = yRot.multiply(baseRot);
            const center = this.getCenter(this.faces[p.i]);
            this.flatPos[p.i] = new BABYLON.Vector3(p.x - center.x, -center.y, p.z - center.z);
            if (this.planMode) {
                this.faceMeshes[p.i].rotationQuaternion = this.flatQuat[p.i];
                this.faceMeshes[p.i].position = this.flatPos[p.i];
            }
        });
    }

    setInsetDepth(d, scene) {
        if (isNaN(d) || d <= 0) return;
        this.insetDepth = d;
        // Medial axis is invariant of d. Rebuild only the geometry; preserve
        // each face's plan-mode position/rotation so manual arrangement isn't
        // wiped out on every slider tick.
        this.unselectFace(scene);
        this.faces.forEach((f, idx) => {
            this.faceMeshes[idx].dispose();
            this.createFaceMesh(f, idx, scene);
        });
    }
    getFace(fmesh) { return this.faces[this.faceMeshes.indexOf(fmesh)];}
    getPoints(fi) {
        let f=this.faces[fi];
        return f.map(pi=>this.points[pi]);
    }

    // Inset corners for face fi at depth d, derived from the v2 medial
    // output. At each original vertex of fi, collects every seam that
    // emanates with gov containing fi, dedupes geometric duplicates, orders
    // them angularly in fi's tangent plane, and traverses each chain to
    // emit one corner per starting seam (at the depth-d crossing on the
    // chain, or at the deepest reachable junction if the chain caps).
    getInsetCorners(fi, medial, d) {
        const f = this.faces[fi];
        const N = f.length;
        const n_f = this.getNorm(fi);
        const p_f = this.points[f[0]];
        const out = [];
        const tol = 1e-3;
        const sameVec = (a, b) =>
            Math.abs(a[0]-b[0]) < tol && Math.abs(a[1]-b[1]) < tol && Math.abs(a[2]-b[2]) < tol;
        const sameSeam = (a, b) =>
            (sameVec(a.start, b.start) && sameVec(a.end, b.end))
            || (sameVec(a.start, b.end) && sameVec(a.end, b.start));

        // Face diameter — max pairwise vertex distance. Used as a generous
        // upper bound for how far an inset corner's lateral projection may
        // legitimately sit from the face polygon. Anything beyond this is a
        // phantom from a seam nearly tangent to fi's plane that hit depth d
        // via a huge lateral excursion (e.g. faraway-fin symptom on
        // degenerate vertices).
        let faceDiameter = 0;
        for (let i = 0; i < N; i++) {
            for (let j = i + 1; j < N; j++) {
                const diff = vsub(this.points[f[i]], this.points[f[j]]);
                const dd = vdot(diff, diff);
                if (dd > faceDiameter) faceDiameter = dd;
            }
        }
        faceDiameter = Math.sqrt(faceDiameter);
        const facePolygon = f.map(pi => this.points[pi]);
        const lateralLimit = faceDiameter;

        for (let i = 0; i < N; i++) {
            const v_i = f[i];
            const v_next = f[(i + 1) % N];
            const v_prev = f[(i - 1 + N) % N];
            const v_pos = this.points[v_i];

            // Boundary-vertex shortcut: if either of v_i's two incident
            // face-fi edges has no adjacent face (incomplete polyhedron),
            // the medial-axis algorithm has no dihedral to bisect against
            // at those edges and can emit phantom seams. Bypass medial
            // and emit a SINGLE inset corner using the in-plane angle
            // bisector — the prism is then notch-free at this vertex.
            const adjPrev = this.findVOtherFaceContaining(v_prev, v_i, fi);
            const adjNext = this.findVOtherFaceContaining(v_i, v_next, fi);
            if (!adjPrev || !adjNext) {
                const ePrev = vsub(this.points[v_prev], v_pos);
                const eNext = vsub(this.points[v_next], v_pos);
                const dPrev = vnormalize(vsub(ePrev, smult(vdot(ePrev, n_f), n_f)));
                const dNext = vnormalize(vsub(eNext, smult(vdot(eNext, n_f), n_f)));
                const bisN = vnormalize(vadd(dPrev, dNext));
                // sin(α/2) where α is the in-plane interior angle at v_i.
                const cosA = vdot(dPrev, dNext);
                const sinHalf = Math.sqrt(Math.max(1e-9, (1 - cosA) / 2));
                const inPlaneShift = d / sinHalf;
                const corner = vadd(
                    vadd(v_pos, smult(inPlaneShift, bisN)),
                    smult(d, n_f));
                out.push({ pt: corner, vertexIdx: i });
                continue;
            }

            // All seams from v_i with gov containing fi, geometrically deduped.
            const raw = medial.seams.filter(s => {
                const fromV = sameVec(s.start, v_pos) || sameVec(s.end, v_pos);
                return fromV && s.faces.includes(fi);
            });
            const seamsAtV = [];
            raw.forEach(s => {
                if (!seamsAtV.some(u => sameSeam(u, s))) seamsAtV.push(s);
            });

            if (seamsAtV.length === 0) {
                console.warn(`getInsetCorners: face ${fi} vertex ${v_i}: no seam emanates with gov containing ${fi}`);
                out.push({ pt: v_pos, vertexIdx: i });
                continue;
            }

            // Local frame in f's tangent plane at v_i: refDir along edge to
            // v_next (angle 0), tangent = n_f x refDir.
            const edgeNext = vsub(this.points[v_next], v_pos);
            const refDir = vnormalize(vsub(edgeNext, smult(vdot(edgeNext, n_f), n_f)));
            const tangent = vXprd(n_f, refDir);

            const seamInfo = seamsAtV.map(s => {
                const otherEnd = sameVec(s.start, v_pos) ? s.end : s.start;
                const dir = vnormalize(vsub(otherEnd, v_pos));
                const dirProj = vsub(dir, smult(vdot(dir, n_f), n_f));
                const x = vdot(dirProj, refDir);
                const y = vdot(dirProj, tangent);
                return { seam: s, angle: Math.atan2(y, x) };
            });
            // Walk perimeter: arrive from v_prev (high angle), leave to
            // v_next (angle 0). Emit corners in DESCENDING angle.
            seamInfo.sort((a, b) => b.angle - a.angle);

            // Dedup at the CORNER level (not the seam level). Non-convex
            // polyhedra can produce multiple distinct seams from a single
            // vertex with fi in their gov (different medial-axis branches
            // around concave dihedrals). After _traverseToDepth(d) those
            // branches often converge to nearly the same inset point —
            // emitting both as corners would create a spurious notch on a
            // face that should be a clean polygon. 10% of d.
            const cornerTol = Math.max(d * 0.1, 1e-3);
            const cornersAtV = [];
            seamInfo.forEach(info => {
                const corner = this._traverseToDepth(info.seam, v_pos, fi, d, n_f, p_f, medial, sameVec, 0);
                // Lateral sanity: project the corner onto fi's plane and
                // reject if it lands outside facePolygon by more than the
                // face's own diameter. Catches faraway-fin phantoms from
                // seams nearly tangent to fi's plane.
                const cornerProj = vsub(corner, smult(vdot(vsub(corner, p_f), n_f), n_f));
                if (typeof pointToPolygonDist3D === 'function'
                    && pointToPolygonDist3D(cornerProj, facePolygon, n_f) > lateralLimit) {
                    return;
                }
                const dup = cornersAtV.some(c =>
                    Math.abs(c[0]-corner[0]) < cornerTol &&
                    Math.abs(c[1]-corner[1]) < cornerTol &&
                    Math.abs(c[2]-corner[2]) < cornerTol);
                if (dup) return;
                cornersAtV.push(corner);
                out.push({ pt: corner, vertexIdx: i });
            });
        }
        return out;
    }

    // Walk along seams whose gov contains fi, starting from startPt on
    // `seam`, until depth d (measured along fi's inward normal from p_f) is
    // reached on some seam in the chain — return the depth-d crossing.
    // If no seam in the chain reaches depth d (terminal junction has no
    // deeper continuation with gov ∋ fi), return the terminal junction.
    _traverseToDepth(seam, startPt, fi, d, n_f, p_f, medial, sameVec, recursion) {
        if (recursion > 64) return startPt;

        const otherEnd = sameVec(seam.start, startPt) ? seam.end : seam.start;
        const offset = vsub(otherEnd, startPt);
        const dir = vnormalize(offset);
        const seamLen = vnorm(offset);
        const dotN = vdot(dir, n_f);
        const dStart = vdot(vsub(startPt, p_f), n_f);
        const dEnd = vdot(vsub(otherEnd, p_f), n_f);

        // Depth d reached on this seam? (allow tiny tolerance)
        if (dEnd >= d - 1e-6 && Math.abs(dotN) > 1e-9) {
            const t = Math.max(0, Math.min((d - dStart) / dotN, seamLen));
            return vadd(startPt, smult(t, dir));
        }

        // Doesn't reach d. Look for a continuation seam at the terminal
        // junction with gov ∋ fi, going strictly deeper than dEnd.
        const junction = otherEnd;
        const candidates = medial.seams.filter(s => {
            if (s === seam) return false;
            const onJ = sameVec(s.start, junction) || sameVec(s.end, junction);
            if (!onJ) return false;
            if (!s.faces.includes(fi)) return false;
            const candOther = sameVec(s.start, junction) ? s.end : s.start;
            return vdot(vsub(candOther, p_f), n_f) > dEnd + 1e-6;
        });

        if (candidates.length === 0) return junction;

        // Prefer continuation that shares 2+ faces with current seam (same
        // bisector sheet on f's cell boundary).
        let next = candidates.find(c => c.faces.filter(g => seam.faces.includes(g)).length >= 2);
        if (!next) next = candidates[0];

        return this._traverseToDepth(next, junction, fi, d, n_f, p_f, medial, sameVec, recursion + 1);
    }

    // Inset prism for face fi: original face on the outer side, inset
    // polygon at depth d on the inner side, side quads + internal bevel
    // triangles connecting them. Layout matches createFaceMesh's prism
    // convention (inner first, outer second).
    getInsetPolyhedron(fi, medial, d) {
        const f = this.faces[fi];
        const N = f.length;
        const outer = this.getPoints(fi);
        const cornerList = this.getInsetCorners(fi, medial, d);
        const M = cornerList.length;

        const pt = [
            ...cornerList.map(c => c.pt),
            ...outer
        ];
        const idx = [];

        // Inner (inset) face — corners in walk order
        idx.push([...Array(M).keys()]);

        // Outer (original face) face — reversed so cross gives outward of slab
        const outerLoop = [];
        for (let k = N - 1; k >= 0; k--) outerLoop.push(M + k);
        idx.push(outerLoop);

        // Per-vertex first/last corner range
        const cornerStart = new Array(N).fill(-1);
        const cornerEnd = new Array(N).fill(-1);
        cornerList.forEach((c, k) => {
            if (cornerStart[c.vertexIdx] === -1) cornerStart[c.vertexIdx] = k;
            cornerEnd[c.vertexIdx] = k;
        });

        // Side quad per outer edge: outer_i -> outer_j on f, paired with
        // last-corner-of-i -> first-corner-of-j on the inset polygon.
        for (let i = 0; i < N; i++) {
            const j = (i + 1) % N;
            idx.push([cornerStart[j], cornerEnd[i], M + i, M + j]);
        }

        // Internal bevel triangles at multi-corner vertices: between
        // consecutive corners at vertex v_i, on the bisector with the
        // intruding face that both seams' gov sets share.
        for (let i = 0; i < N; i++) {
            for (let k = cornerStart[i]; k < cornerEnd[i]; k++) {
                idx.push([M + i, k, k + 1]);
            }
        }

        return { pt, idx };
    }

    // Console diagnostics for the inset-prism pipeline on a single face.
    // Run from DevTools as `theOrigami.debugFace(1)` (data index, 0-based —
    // UI label N maps to index N-1). Reports: (a) whether the face touches any
    // boundary edges in the polyhedron at large or on its own perimeter,
    // (b) which getInsetCorners branch fires per vertex (boundary shortcut vs
    // medial), (c) the seam set used at each medial vertex with angles and
    // depth-d crossings, and (d) the prism pt/idx output. Helps localize
    // "wrong size/position" bugs to a specific stage.
    debugFace(fi, d) {
        d = d ?? this.insetDepth;
        const f = this.faces[fi];
        if (!f) { console.log(`face ${fi}: no such face`); return; }
        const N = f.length;
        const n_f = this.getNorm(fi);
        const p_f = this.points[f[0]];
        const tol = 1e-3;
        const sameVec = (a, b) =>
            Math.abs(a[0]-b[0]) < tol && Math.abs(a[1]-b[1]) < tol && Math.abs(a[2]-b[2]) < tol;

        // Whole-polyhedron edge incidence (for "boundary-incident vertex" check).
        const edgeCount = new Map();
        const key = (a, b) => a < b ? `${a},${b}` : `${b},${a}`;
        this.faces.forEach(face => {
            for (let i = 0; i < face.length; i++) {
                const k = key(face[i], face[(i+1) % face.length]);
                edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
            }
        });
        const vertexBoundaryEdges = vi => {
            const out = [];
            edgeCount.forEach((c, k) => {
                if (c < 2) {
                    const [a, b] = k.split(',').map(Number);
                    if (a === vi || b === vi) out.push([a, b]);
                }
            });
            return out;
        };

        console.group(`debugFace(${fi}) — UI label ${fi+1}, verts=[${f}], n_f=[${n_f.map(x => x.toFixed(3))}], d=${d}`);
        console.log(`medial seams available: ${this.medial && this.medial.seams ? this.medial.seams.length : 0}`);

        for (let i = 0; i < N; i++) {
            const v_i = f[i];
            const v_next = f[(i + 1) % N];
            const v_prev = f[(i - 1 + N) % N];
            const v_pos = this.points[v_i];

            const adjPrev = this.findVOtherFaceContaining(v_prev, v_i, fi);
            const adjNext = this.findVOtherFaceContaining(v_i, v_next, fi);
            const inFaceBoundary = !adjPrev || !adjNext;
            const otherBoundary = vertexBoundaryEdges(v_i).filter(([a,b]) =>
                !((a === v_prev && b === v_i) || (a === v_i && b === v_prev)
                  || (a === v_i && b === v_next) || (a === v_next && b === v_i)));

            console.group(`v${i} (point ${v_i}) at [${v_pos.map(x => x.toFixed(3))}]`);
            console.log(`in-face edges: prev(${v_prev}→${v_i}) adj=${!!adjPrev}, next(${v_i}→${v_next}) adj=${!!adjNext}`);
            console.log(`other boundary edges at this vertex: ${otherBoundary.length ? JSON.stringify(otherBoundary) : "none"}`);

            if (inFaceBoundary) {
                console.log(`→ boundary shortcut fires (in-plane bisector + d*n_f)`);
            } else if (!this.medial || !this.medial.seams) {
                console.log(`→ no medial; getInsetCorners would warn and emit v_pos`);
            } else {
                const raw = this.medial.seams.filter(s => {
                    const fromV = sameVec(s.start, v_pos) || sameVec(s.end, v_pos);
                    return fromV && s.faces.includes(fi);
                });
                console.log(`→ medial path: ${raw.length} raw seam(s) with gov ∋ ${fi} starting from v_pos`);
                const edgeNext = vsub(this.points[v_next], v_pos);
                const refDir = vnormalize(vsub(edgeNext, smult(vdot(edgeNext, n_f), n_f)));
                const tangent = vXprd(n_f, refDir);
                raw.forEach((s, k) => {
                    const otherEnd = sameVec(s.start, v_pos) ? s.end : s.start;
                    const dir = vnormalize(vsub(otherEnd, v_pos));
                    const dirProj = vsub(dir, smult(vdot(dir, n_f), n_f));
                    const x = vdot(dirProj, refDir);
                    const y = vdot(dirProj, tangent);
                    const angle = Math.atan2(y, x) * 180 / Math.PI;
                    const crossing = this._traverseToDepth(s, v_pos, fi, d, n_f, p_f, this.medial, sameVec, 0);
                    const crossDepth = vdot(vsub(crossing, p_f), n_f);
                    console.log(`  seam[${k}]: angle=${angle.toFixed(1)}°, faces=[${s.faces}], → crossing=[${crossing.map(x => x.toFixed(3))}] depth=${crossDepth.toFixed(4)} (target=${d})`);
                });
            }
            console.groupEnd();
        }

        let cornerList = null;
        try {
            cornerList = this.getInsetCorners(fi, this.medial, d);
            console.log(`getInsetCorners returned ${cornerList.length} corner(s) (face has ${N} vertices):`);
            cornerList.forEach((c, k) => {
                const depth = vdot(vsub(c.pt, p_f), n_f);
                console.log(`  corner[${k}] vertexIdx=${c.vertexIdx} pt=[${c.pt.map(x => x.toFixed(3))}] depth=${depth.toFixed(4)}`);
            });
        } catch (e) {
            console.warn(`getInsetCorners threw:`, e);
        }

        try {
            const prism = this.getInsetPolyhedron(fi, this.medial, d);
            console.log(`prism: ${prism.pt.length} verts, ${prism.idx.length} faces`);
            console.log(`prism.pt =`, prism.pt);
            console.log(`prism.idx =`, prism.idx);
        } catch (e) {
            console.warn(`getInsetPolyhedron threw:`, e);
        }

        console.groupEnd();
        return cornerList;
    }

    // Cookie-cutter frame for face fi: a thin-walled hollow ring sitting on
    // the face, walls slanted outward at the dihedral half-angle of each
    // edge. Wall thickness constant in the face plane. Used as a passive
    // knife guide to cut clay sheets to the right shape with the right
    // bevel angle.
    //
    // opts:
    //   margin: outward offset of cutter perimeter from face polygon (mm-ish, default 1)
    //   height: how tall the cutter walls are (mm-ish)
    //   thickness: wall thickness in the face plane (mm-ish)
    getCutterPolyhedron(fi, opts = {}) {
        const margin = opts.margin ?? 0.1;
        const height = opts.height ?? 2;
        const thickness = opts.thickness ?? 0.15;
        const baseWidth = opts.baseWidth ?? 1;
        // Extra inward shift applied only to the flange (not the cavity wall).
        // The cutter leaves it 0; the mold sets it to `thickness` so adjacent
        // face molds' flanges touch at the shared edge instead of overlapping.
        const flangeInset = opts.flangeInset ?? 0;
        // Sample seams just past v_face so each notch wall sits on the
        // immediate f / intruding-face bisector, regardless of where any
        // medial-axis junction lies further in.
        const cutterDepth = 0.0001;

        const f = this.faces[fi];
        const Nf = f.length;
        const n_f = this.getNorm(fi);
        // Walls extrude in -n_f (outward from the polyhedron, away from
        // the polyhedron interior). In the 3D preview this keeps the mold
        // visibly OUTSIDE the polyhedron volume so the user can see which
        // side of each face the mold attaches to. The build-plate
        // transform then maps -n_f to +z so the print lands face-on-bed.
        const upDir = smult(-1, n_f);
        const p_f = this.points[f[0]];

        // Inset corner list: M ≥ Nf points. M > Nf when some vertex emits
        // multiple seams — those extra corners produce extra (notch) walls
        // that mirror the prism's internal bevel triangles.
        let cornerList;
        if (this.medial && this.medial.seams && this.medial.seams.length > 0) {
            cornerList = this.getInsetCorners(fi, this.medial, cutterDepth);
        } else {
            cornerList = f.map((pi, i) => ({ pt: this.points[pi], vertexIdx: i }));
        }
        const M = cornerList.length;

        // Per-face-edge data (Nf entries): used both for regular walls and
        // for computing the bottom-perimeter offset corners.
        const faceEdgeData = [];
        for (let i = 0; i < Nf; i++) {
            const a = this.points[f[i]];
            const b = this.points[f[(i + 1) % Nf]];
            const edgeDir = vnormalize(vsub(b, a));
            const outDir = vnormalize(vXprd(edgeDir, n_f));
            let alpha = 0;
            const adj = this.findVOtherFaceContaining(f[i], f[(i + 1) % Nf], fi);
            if (adj) {
                const n_adj = this.getNorm(adj[0]);
                const dot = Math.max(-1, Math.min(1, vdot(n_f, n_adj)));
                alpha = Math.acos(dot) / 2;
                // Signed alpha: at a concave (reflex) dihedral the
                // bisector plane lies on the polyhedron-interior side of
                // the edge, so walls must slope INWARD (-outDir) instead
                // of outward to meet adjacent face-mold walls there.
                // Detect concave via (n_f × n_adj) · edgeDir > 0 (the
                // sign is opposite for a convex dihedral, e.g. -1 at a
                // cube corner, +1 at an L-shape inside corner).
                const dihedralSign = vdot(vXprd(n_f, n_adj), edgeDir);
                if (dihedralSign > 0) alpha = -alpha;
            }
            faceEdgeData.push({ a, edgeDir, outDir, alpha });
        }

        // Corner of the face polygon offset outward by `offset` at face
        // vertex i: intersection of the two adjacent face edges shifted by
        // `offset` along their respective in-plane outward normals.
        const offsetCorner = (i, offset) => {
            const ePrev = faceEdgeData[(i - 1 + Nf) % Nf];
            const eCurr = faceEdgeData[i];
            const p1 = vadd(ePrev.a, smult(offset, ePrev.outDir));
            const p2 = vadd(eCurr.a, smult(offset, eCurr.outDir));
            const cross = vXprd(ePrev.edgeDir, eCurr.edgeDir);
            const cm2 = vdot(cross, cross);
            if (cm2 < 1e-12) return p2;
            const t = vdot(vXprd(vsub(p2, p1), eCurr.edgeDir), cross) / cm2;
            return vadd(p1, smult(t, ePrev.edgeDir));
        };

        // The blade rests on the cutter's external surface (large offset);
        // the cavity sits `thickness` inward of that. So `innerVi` holds the
        // larger offset (external, at margin) and `outerVi` the smaller one
        // (cavity, at margin − thickness). Keeping the original outer/inner
        // variable names so the wall-winding code below stays unchanged.
        const outerVi = [];
        const innerVi = [];
        for (let i = 0; i < Nf; i++) {
            outerVi.push(offsetCorner(i, margin - thickness));
            innerVi.push(offsetCorner(i, margin));
        }

        // Per-wall data (M entries). Each wall has aOuter/aInner anchors so
        // that the line at face plane passes through (a + level*outDir) for
        // level ∈ {margin, margin+thickness}. Regular walls anchor at the
        // face vertex; notch walls anchor so the line passes through the
        // outer/inner offset-corner at z=0 (i.e., the notch wall originates
        // at the same point where the two adjacent face edges, translated
        // outward by margin, intersect — per the user's spec).
        const wallData = [];
        for (let k = 0; k < M; k++) {
            const ck = cornerList[k];
            const ck1 = cornerList[(k + 1) % M];
            if (ck.vertexIdx !== ck1.vertexIdx) {
                const fed = faceEdgeData[ck.vertexIdx];
                wallData.push({
                    aOuter: fed.a, aInner: fed.a,
                    edgeDir: fed.edgeDir, outDir: fed.outDir, alpha: fed.alpha,
                });
            } else {
                const v_face = this.points[f[ck.vertexIdx]];
                const proj = pt => {
                    const d = vdot(vsub(pt, p_f), n_f);
                    return vsub(pt, smult(d, n_f));
                };
                const ev = vsub(proj(ck1.pt), proj(ck.pt));
                let edgeDir;
                if (vdot(ev, ev) > 1e-18) {
                    edgeDir = vnormalize(ev);
                } else {
                    edgeDir = vnormalize(vXprd(n_f, vsub(ck.pt, v_face)));
                }
                const outDir = vnormalize(vXprd(edgeDir, n_f));
                // Wall plane is parallel to the prism's internal bevel
                // triangle (v_face, corner_k, corner_{k+1}). That triangle
                // sits on the bisector plane between f and the intruding
                // face, whose normal is at angle (π/2 − theta_intr/2) from
                // n_f. So α = theta_intr/2 = asin(|n_tri · n_f|), which
                // matches the regular-edge formula acos(n_f · n_adj)/2.
                const e1 = vsub(ck.pt, v_face);
                const e2 = vsub(ck1.pt, v_face);
                const n_tri = vnormalize(vXprd(e1, e2));
                const dot = Math.max(0, Math.min(1, Math.abs(vdot(n_tri, n_f))));
                const alpha = Math.asin(dot);
                const aOuter = vsub(outerVi[ck.vertexIdx], smult(margin - thickness, outDir));
                const aInner = vsub(innerVi[ck.vertexIdx], smult(margin, outDir));
                wallData.push({ aOuter, aInner, edgeDir, outDir, alpha });
            }
        }

        // Each perimeter corner = intersection of the two adjacent walls'
        // shifted lines at the given vertical level, then lifted by vertY*upDir.
        const buildPerimeter = (anchor, baseOffset, vertY) => {
            const out = [];
            for (let k = 0; k < M; k++) {
                const wPrev = wallData[(k - 1 + M) % M];
                const wCurr = wallData[k];
                const oPrev = baseOffset + vertY * Math.tan(wPrev.alpha);
                const oCurr = baseOffset + vertY * Math.tan(wCurr.alpha);
                const p1 = vadd(anchor(wPrev), smult(oPrev, wPrev.outDir));
                const p2 = vadd(anchor(wCurr), smult(oCurr, wCurr.outDir));
                const cross = vXprd(wPrev.edgeDir, wCurr.edgeDir);
                const cm2 = vdot(cross, cross);
                let inter;
                if (cm2 < 1e-12) {
                    inter = p2;
                } else {
                    const t = vdot(vXprd(vsub(p2, p1), wCurr.edgeDir), cross) / cm2;
                    inter = vadd(p1, smult(t, wPrev.edgeDir));
                }
                out.push(vadd(inter, smult(vertY, upDir)));
            }
            return out;
        };

        const aOuter = w => w.aOuter;
        const aInner = w => w.aInner;
        const outerBottom = buildPerimeter(aOuter, margin - thickness, 0);
        const outerTop    = buildPerimeter(aOuter, margin - thickness, height);
        const innerBottom = buildPerimeter(aInner, margin, 0);
        const innerTop    = buildPerimeter(aInner, margin, height);

        // Four rings of M points; bottom rings have count[v]-1 duplicate slots
        // per multi-corner vertex (the notch walls collapse to a point at z=0),
        // which is fine — the corresponding rim quads are zero-area.
        const pt = [...outerBottom, ...outerTop, ...innerBottom, ...innerTop];
        const OB = 0, OT = M, IB = 2 * M, IT = 3 * M;
        const idx = [];
        const hasFlange = baseWidth > 0;
        for (let k = 0; k < M; k++) {
            const j = (k + 1) % M;
            // Outer wall: only the unobstructed full span when there's no
            // flange. With flange, the outer wall's lower portion (OB→OTh) is
            // interior to the flange slab, so we emit only OTh→OT below.
            if (!hasFlange) {
                idx.push([OB + k, OB + j, OT + j, OT + k]);
            }
            // Inner wall (cavity side):
            idx.push([IT + k, IT + j, IB + j, IB + k]);
            // Bottom rim (toward clay):
            idx.push([IB + k, IB + j, OB + j, OB + k]);
            // Top rim:
            idx.push([OT + k, OT + j, IT + j, IT + k]);
        }

        // Bottom flange: a thin slab on the cavity-wall side filling
        // z ∈ [0, thickness], extending baseWidth inward from the cavity
        // wall. Increases the cutter↔clay contact area so finger pressure
        // doesn't dent the clay.
        if (hasFlange) {
            const flangeBot   = buildPerimeter(aOuter, margin - thickness - baseWidth - flangeInset, 0);
            const flangeTop   = buildPerimeter(aOuter, margin - thickness - baseWidth - flangeInset, thickness);
            const cavAtThick  = buildPerimeter(aOuter, margin - thickness - flangeInset, thickness);
            const FB = pt.length;          pt.push(...flangeBot);
            const FT = pt.length;          pt.push(...flangeTop);
            const OTh = pt.length;         pt.push(...cavAtThick);
            for (let k = 0; k < M; k++) {
                const j = (k + 1) % M;
                // Underside of flange at z=0 (toward clay):
                idx.push([FB + k, OB + k, OB + j, FB + j]);
                // Top of flange at z=thickness (toward cutter top):
                idx.push([OTh + k, FT + k, FT + j, OTh + j]);
                // Outer vertical wall of the flange:
                idx.push([FB + k, FB + j, FT + j, FT + k]);
                // Outer wall of the mold body above the flange: OTh→OT.
                // The lower portion OB→OTh is interior to the solid (blade
                // material meets flange material there), so it's not emitted.
                idx.push([OTh + k, OTh + j, OT + j, OT + k]);
            }
        }
        return { pt, idx };
    }

    // Mold piece for face fi: same shape family as the cookie cutter, but
    // with margin = 0 so the cavity sits exactly on the polygon edge and
    // the wall material extends outward from the polyhedron face. The
    // build-plate transform in ui.js flips the model so the face polygon
    // lands face-down on the bed and the walls rise straight up.
    getMoldPolyhedron(fi, opts = {}) {
        const moldWidth = opts.moldWidth ?? 1;
        const moldHeight = opts.moldHeight ?? 0.2;
        return this.getCutterPolyhedron(fi, {
            ...opts,
            margin: 0,
            baseWidth: moldWidth,
            flangeInset: 0,
            height: moldHeight,
        });
    }

    // Triangular tab on the bisector wall of face fi at edge `edgeIdx`,
    // positioned at edge fraction `frac`. The triangle has its long base
    // along the edge (length 2·rm/sin(22.5°), matching the mold.scad
    // shield base) and its apex at 2·rm in the wall's slope direction.
    // Extruded `thickness` perpendicular to the wall plane, into fi's
    // mold body. `kind` ('male' | 'female') is currently visual-only —
    // both kinds emit the same triangle; caller distinguishes by colour.
    // Snap-fit / female cylindrical hole will be added later.
    // Clamps `tabRadius` if the base wouldn't fit between `frac` and the
    // nearer edge end.
    getMoldTab(fi, edgeIdx, frac, kind, opts = {}) {
        const thickness = opts.thickness ?? 0.15;
        let rm = opts.tabRadius ?? 0.5;
        const angleDeg = opts.angle ?? 55;

        const f = this.faces[fi];
        const Nf = f.length;
        const v_i = this.points[f[edgeIdx]];
        const v_j = this.points[f[(edgeIdx + 1) % Nf]];
        const n_f = this.getNorm(fi);
        const upDir = smult(-1, n_f);

        const edgeVec = vsub(v_j, v_i);
        const edgeLen = vnorm(edgeVec);
        const edgeDir = smult(1 / edgeLen, edgeVec);
        const outDir = vnormalize(vXprd(edgeDir, n_f));

        // Bevel half-angle with adjacent face.
        let alpha = 0;
        const adj = this.findVOtherFaceContaining(
            f[edgeIdx], f[(edgeIdx + 1) % Nf], fi);
        if (adj) {
            const n_adj = this.getNorm(adj[0]);
            const dot = Math.max(-1, Math.min(1, vdot(n_f, n_adj)));
            alpha = Math.acos(dot) / 2;
        }

        // Wall plane basis: edgeDir along edge; sDir along the slope (in
        // upDir + tan(α)·outDir direction); wDir perpendicular to wall.
        // With margin=0 in getMoldPolyhedron, the external wall lies on
        // the bisector plane and fi's mold body is on the +wDir side, so
        // we extrude the tab in +wDir to keep it inside fi's body.
        const sDir = vnormalize(vadd(upDir, smult(Math.tan(alpha), outDir)));
        const wDir = vnormalize(vXprd(edgeDir, sDir));

        // Clamp tabRadius if its base would run past either edge end.
        const sinHalfAngle = Math.sin((angleDeg / 2) * Math.PI / 180);
        const halfBaseFull = rm / sinHalfAngle;
        const slack = Math.min(frac, 1 - frac) * edgeLen;
        if (halfBaseFull > slack) {
            const clamped = slack * sinHalfAngle * 0.95;
            console.warn(
                `getMoldTab face=${fi} edge=${edgeIdx} frac=${frac} kind=${kind}: ` +
                `tabRadius=${rm.toFixed(3)} too large for edge length ${edgeLen.toFixed(3)}, ` +
                `clamped to ${clamped.toFixed(3)}`);
            rm = clamped;
        }
        const halfBase = rm / sinHalfAngle;

        // 2D shield polygon (matches mold.scad's male/female outline,
        // shifted so the flat base sits on the edge at y=0). Apex angle is
        // governed by `angle`: dome arc goes from (180−angle)° to angle°,
        // centred at (0, rm); base corners at (±rm/sin(angle/2), 0).
        const poly2D = [];
        poly2D.push([-halfBase, 0]);
        for (let aDeg = 180 - angleDeg; aDeg >= angleDeg; aDeg -= 10) {
            const ar = aDeg * Math.PI / 180;
            poly2D.push([rm * Math.cos(ar), rm + rm * Math.sin(ar)]);
        }
        poly2D.push([halfBase, 0]);
        const baseCenter = vadd(v_i, smult(frac, edgeVec));
        // Match the wall's depth in wDir: a slab between the cavity and
        // external wall planes (parallel, separated by `thickness` in
        // outDir) is `thickness · cos α` deep along wDir. Tab back is
        // then flush with wall back so the tab doesn't protrude.
        const tabWDirDepth = thickness * Math.cos(alpha);

        // Solid extruded shield, identical for male and female. (The female
        // hole is cut out later by manifold using the wall-hole cylinder, so
        // both tab kinds share the same body.) Front face is on the bisector;
        // outward normal must point in -wDir (away from the tab body
        // extruded in +wDir). CCW walking of the polygon in (edgeDir, sDir)
        // gives a +wDir cross product, so we REVERSE the polygon order
        // for the front. The back face at +wDir·depth wants outward in
        // +wDir, so it keeps the CCW (forward) order.
        const front3D = poly2D.map(([x, y]) =>
            vadd(baseCenter, vadd(smult(x, edgeDir), smult(y, sDir))));
        const back3D = front3D.map(p => vadd(p, smult(tabWDirDepth, wDir)));
        const N_poly = poly2D.length;
        const pt = [...front3D, ...back3D];
        const idx = [];
        const front = [];
        for (let k = N_poly - 1; k >= 0; k--) front.push(k);
        idx.push(front);
        const back = [];
        for (let k = 0; k < N_poly; k++) back.push(k + N_poly);
        idx.push(back);
        for (let k = 0; k < N_poly; k++) {
            const j = (k + 1) % N_poly;
            idx.push([k, j, j + N_poly, k + N_poly]);
        }
        return { pt, idx };
    }

    // RSnapY snap-fit lobes (SnapLib.0.36.scad, RSnapY module).
    // Builds `Lobi` raised lobes around a +Y axis at radius r2, each lobe
    // formed by rotate-extruding the SCAD 7-vertex snap profile through
    // Theta = 180/Lobi degrees. Returns {pt, idx} in local coords with the
    // snap's base sitting at Y=0.
    //
    // Snap dimensions follow mold.scad: cantilever length `l` and engagement
    // depth `h` scale with print thickness (so the snap flexes consistently
    // regardless of `rm`); only the lobe radius `r2` scales with `rm`.
    //   l = 3.1·thickness, h = 1.5·thickness, r2 = 0.6·rm.
    getMoldSnap(opts = {}) {
        const rm = opts.tabRadius ?? 0.5;
        const thickness = opts.thickness ?? 0.15;
        const l  = opts.snapL    ?? 3.4 * thickness;
        const h  = opts.snapH    ?? 1.5 * thickness;
        const aDeg = opts.snapAngle ?? 30;
        const Lobi = opts.snapLobi  ?? 2;
        const r2 = opts.snapR2 ?? 0.6 * rm;
        const f  = opts.snapF  ?? 1;
        const K2 = opts.snapK2 ?? 2;
        const eps = 0.03;                           // PLA elongation at break
        const segPerLobe = opts.snapSegments ?? 12;

        const Theta = Math.PI / Lobi;
        const y = (1.64 / f) * K2 * eps * l * l / r2;
        if (!((r2 - h) > y) || !(h < r2)) {
            console.warn(
                `getMoldSnap: SnapLib check failed (y=${y.toFixed(4)} ` +
                `r2-h=${(r2 - h).toFixed(4)} h=${h} r2=${r2})`);
        }
        const p = y;
        const aRad = aDeg * Math.PI / 180;

        // 2D polygon = SCAD's polygon([...]) after mirror([1,-1,0]) and
        // translate([r2,0,0]). x = radial; y = axial along the snap.
        const poly = [
            [r2, 0],
            [r2, l],
            [r2 + y, l],
            [r2 + y, l + p],
            [r2 - h / 4, l + p + (y + h / 4) / Math.tan(aRad)],
            [r2 - h / 2, l],
            [r2 - h, 0],
        ];
        const N_poly = poly.length;
        const pt = [];
        const idx = [];

        // Rotate the lobe pattern by (Theta/2 + π/2) so the axis of symmetry
        // BETWEEN adjacent lobes (the gap centreline — perpendicular to the
        // line through the lobes' midpoints) aligns with the snap's local Z.
        // The buildFaceMold look-at rotation then pins local Z to print up,
        // putting that gap centreline vertical for support-free printing.
        const lobeOffset = Theta / 2 + Math.PI / 2;
        for (let lobeIdx = 0; lobeIdx < Lobi; lobeIdx++) {
            const startAngle = 2 * Theta * lobeIdx + lobeOffset;
            const ringStart = pt.length;
            for (let s = 0; s <= segPerLobe; s++) {
                const angle = startAngle + (s / segPerLobe) * Theta;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                for (const [px, py] of poly) {
                    pt.push([px * cosA, py, -px * sinA]);
                }
            }
            for (let s = 0; s < segPerLobe; s++) {
                const ring0 = ringStart + s * N_poly;
                const ring1 = ringStart + (s + 1) * N_poly;
                for (let k = 0; k < N_poly; k++) {
                    const j = (k + 1) % N_poly;
                    idx.push([ring0 + k, ring0 + j, ring1 + j, ring1 + k]);
                }
            }
            // The 7-vertex snap profile is concave (the hook indents at
            // vertex 4–5), so a fan triangulation from vertex 0 produces
            // crossing triangles that show up as a "missing point" sliver
            // at the lobe ends. Split the cap into two convex pieces
            // sharing the shoulder edge 1↔5: stem quad [0,1,5,6] and hook
            // pentagon [1,2,3,4,5].
            const endRing = ringStart + segPerLobe * N_poly;
            // Start cap: reversed winding (outward normal = -lobe-axis).
            idx.push([ringStart + 6, ringStart + 5, ringStart + 1, ringStart + 0]);
            idx.push([ringStart + 5, ringStart + 4, ringStart + 3, ringStart + 2, ringStart + 1]);
            // End cap: forward winding (outward normal = +lobe-axis).
            idx.push([endRing + 0, endRing + 1, endRing + 5, endRing + 6]);
            idx.push([endRing + 1, endRing + 2, endRing + 3, endRing + 4, endRing + 5]);
        }
        return { pt, idx };
    }

    computeFdir(f,fidx,ep) {
        let res=[]
        f.forEach((p1,lvidx)=>{
            let p2= lvidx == f.length-1? f[0] : f[lvidx+1];
            let p0= lvidx==0 ? f[f.length-1]: f[lvidx-1];
            let of0=this.findVOtherFaceContaining(p1,p0,fidx);
            let of2=this.findVOtherFaceContaining(p1,p2,fidx);
            let dir=null,n=this.getNorm(fidx);
            if(of0==null&& of2==null) {//use normal
                dir=n;
            } else if (of0==null) {
                dir=n;
            } else if(of2==null) {
                dir=n;
            } else {
                dir=_computeVDir(this.points[p1],
                    this.points[of2[1]],
                    this.points[p2],
                    this.points[p0],
                    this.points[of0[1]],false);
            }
            res.push(vadd(this.points[p1],smult(ep/vdot(dir,n),dir)));
            // showSph(res[lvidx],BABYLON.Color3.Red());
        });
        return res;
    }
    getDir(f1,f2,f3) {
        let n1=this.getNorm(f1);
        let n2=this.getNorm(f2);
        let n3=this.getNorm(f3);
        let res =vnormalize(vadd(vadd(vXprd(n2,n1),vXprd(n3,n2)),vXprd(n1,n3)));
        //console.log("--->"+vdot(n1,res)+","+vdot(n2,res)+","+vdot(n3,res));
        return res;
    }
    getDist(p,f) {
        return Math.abs(vdot ( vsub(p,this.points[this.faces[f][0]]) , this.getNorm(f) ));
    }
    // Checks whether a point is within the domain polytope of a face
    // i.e if there is a chance this face might be a governor of a seam going through this point
    isWithinDPolytope(pt,fidx) {
        let f=this.faces[fidx];
        let fn=this.getNorm(fidx);
        if(vdot(fn,vsub(pt,this.points[f[0]]) <0)) return false;
        return !this.faces[fidx].some((p1,p1i)=>{
            let p2i=(p1i==this.faces[fidx].length-1?0:p1i+1);
            let n=vXprd(fn,vsub(this.points[f[p2i]],this.points[p1]));
            let vd=vdot(n,vsub(pt,this.points[p1]));
            return vd<0;
        });

    }
    getNorm(p0,p1,p2) {
        if(p2===undefined) {
            let f=this.faces[p0];
            p1=this.points[f[1]];
            p2=this.points[f[2]];
            p0=this.points[f[0]];
        } 
        return vnormalize(vXprd(vsub(p1,p0),vsub(p2,p0))); 
    }
}





function _computeVDir(p0,p1,p2,p3,p4,debug=false,tw=false) {
    let n1=vXprd(vsub(p0,p2),vbissec(p0,p2,p1,p3,false));
    let n2=vXprd(vsub(p0,p3),vbissec(p0,p3,p2,p4,tw));
    let res= vnormalize(vXprd(n2,n1));

    if(debug) {
        console.log(p0+"\n"+p1+"\n"+p2+"\n"+p3+"\n");
        showSph(vadd(p0,vnormalize(n1)),BABYLON.Color3.Blue());
        showSph(vadd(p0,vnormalize(n2)),BABYLON.Color3.Magenta());
        showSph(vadd(p0,vbissec(p0,p2,p1,p3,false)),BABYLON.Color3.Yellow());
        showSph(vadd(p0,vbissec(p0,p3,p2,p4,tw)),BABYLON.Color3.Purple());
    }
    return res;
}
function showSph(p,c,txt=null) {
    // Our built-in 'sphere' shape.
    let s = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: SphD, segments: 10}, scene);

    // Move the sphere upward 1/2 its height
    s.position = BABYLON.Vector3.Zero().fromArray(p);;
    let m = new BABYLON.StandardMaterial("mat", scene);
    m.diffuseColor = c;
    s.material = m;
    if(txt!= null) {
        s.actionManager =new BABYLON.ActionManager(scene);
        s.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, 
            function () { console.log(txt); }));
    }    
}
function global(p,wm) {
    return BABYLON.Vector3.TransformCoordinates(
        BABYLON.Vector3.Zero().fromArray(p),wm);
}