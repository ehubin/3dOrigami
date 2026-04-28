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
        try {
            this.medial = (typeof computeMedialTracing === "function")
                ? computeMedialTracing(this, maxThickness)
                : null;
        } catch (e) {
            console.warn("Medial axis computation failed:", e);
            this.medial = null;
        }
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

        for (let i = 0; i < N; i++) {
            const v_i = f[i];
            const v_next = f[(i + 1) % N];
            const v_pos = this.points[v_i];

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

            seamInfo.forEach(info => {
                const corner = this._traverseToDepth(info.seam, v_pos, fi, d, n_f, p_f, medial, sameVec, 0);
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