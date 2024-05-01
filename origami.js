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

class Origami {            
    points=null;
    faces=null;
    name="";
    planMode=false;
    faceMeshes=[];
    VSelMeshes=null;
    ESelMeshes=[];
    selectedF=null;
    selectedE=-1;
    selectedV=-1;
    constructor(scene,pts,fa,na="") {
        this.name=na;
        this.points=pts;
        this.faces=fa;
        fa.forEach((f,idx)=>this.createFaceMesh(f,idx,scene));
    }
    switch(ui) {
        if(this.planMode) {
            this.planMode=false;
            ui.switchMode(false);
            this.faceMeshes.forEach((fm,i)=>{
                fm.rotationQuaternion=BABYLON.Quaternion.Zero();
                fm.position=BABYLON.Vector3.Zero();
            });
        } else {
            this.planMode=true;
            ui.switchMode(true);
            this.faceMeshes.forEach((fm,i)=>{
                fm.rotationQuaternion=this.getRot(this.faces[i]);
                fm.position=this.getCenter(this.faces[i]).scale(-1);
            });
        }
    }
    getCenter(f) {
        let sum=[0,0,0];
        for(let p of f) sum=vadd(sum,this.points[p]);
        return BABYLON.Vector3.Zero().fromArray(smult(1/f.length,sum));
    }
    email() {
        const toSend=JSON.stringify({name:this.name, pt:this.points, f:this.faces});
        window.location.href = "mailto:?subject=Origami: " + this.name+"&body="+toSend;
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
        
        const Triangle = { "name":"Triangular Prism", "category":["Prism"], 
            "vertex":this.computeFaceVertex(f),
            "face":[[0,1,2],[3,5,4],[0,2,5,3],[2,1,4,5],[1,0,3,4]]};
        //console.log(Triangle.vertex); 
        const Prism = BABYLON.MeshBuilder.CreatePolyhedron("h", {custom: Triangle}, scene);
        Prism.actionManager =new BABYLON.ActionManager(scene);
        let _t=this;
        Prism.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, 
            function (evt) { _t.selectFace(idx,scene); }));
        Prism.setPivotPoint(this.getCenter(f));    

        const material = new BABYLON.StandardMaterial("material", scene);
        material.diffuseColor = Palette[idx%Palette.length];
        Prism.material = material;
        this.faceMeshes[idx]=Prism;
    }
    computeFaceVertex(f) {
        const e=0.02; //face thickness

        let p0=this.points[f[0]],p1=this.points[f[1]],p2=this.points[f[2]];
        let p02=vsub(p2,p0);
        let p01=vsub(p1,p0);                      
        let norm = smult(e,vnormalize(vXprd(p02,p01)));
    
        return [vsub(p0,norm), vsub(p1,norm), vsub(p2,norm),
                vadd(p0,norm), vadd(p1,norm), vadd(p2,norm)]; 
    }
    translateV(dir,scene) {
        if(this.selectedF==null|| this.selectedF==-1) return;
        if(this.planMode ) {
            let sel=this.faces.indexOf(this.selectedF);
            this.faceMeshes[sel].position.addInPlace( new BABYLON.Vector3(dir[0]*0.1,0,dir[1]*0.1));

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
    }
    rotateFace(angle,scene) {
        if(this.selectedF==null) return;
        if(this.planMode) {
            let sel=this.faces.indexOf(this.selectedF);
            this.faceMeshes[sel].rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0,1,0),angle*Math.PI/180).multiplyInPlace(this.faceMeshes[sel].rotationQuaternion);
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
    }
    

    updateVertex(v,idx,scene) {
        let orig=this;
        this.faces.forEach((f,i)=>{
            f.some( (pt,j)=>{
                if(pt==idx) {
                    orig.faceMeshes[i].dispose();
                    this.createFaceMesh(f,i,scene);
                    return true;
                }
                return false;
            });
        });
    }
    selectFace(i,scene) {
        let f=this.faces[i];
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
            this.selectedF=f;/*
            this.VSelMeshes[0].isVisible=true;
            
            const __m=this.VSelMeshes[0],__f=this.faceMeshes[i],__t=this;
            __m.isPickable=false;
            __f.isPickable=false;

            scene.onPointerMove = function (evt, result) {
                    var pickResult = scene.pick(evt.offsetX, evt.offsetY);
                    if (pickResult.hit && pickResult.pickedMesh.name == "ground") {                       
                        __m.position= pickResult.pickedPoint;
                        __f.position=pickResult.pickedPoint.add(__t.getCenter(f).scale(-1));
                }
            }
            return;
            */
        } else {
            this.reComputeESel(f);
            for(let j=f.length;j<10;++j) {
                this.VSelMeshes[j].isVisible = false;
            }
            this.selectedF=f;
            this.selectEdge(-1,scene);
            this.selectVertex(-1,scene);
            console.log("Selected "+f);
        }
    }
    unselectFace(scene) {
        for(let j=0;j<10;++j) {
            this.VSelMeshes[j].isVisible = false;
        }
        this.ESelMeshes.forEach(m=>m.dispose());
        this.ESelMeshes=[];
        this.selectedF=null;
        this.selectEdge(-1,scene);
        this.selectVertex(-1,scene); 
    }
    reComputeESel(f) {
        this.ESelMeshes.forEach(m=>m.dispose());
        this.ESelMeshes=[];
        for(let j=0;j<f.length;++j) {
            let p= this.points[f[j]];
            this.VSelMeshes[j].position = new BABYLON.Vector3(p[0], p[1], p[2]);
            this.VSelMeshes[j].isVisible=true;                   
            this.ESelMeshes.push(this.getEdgeCyl(f,j,scene));
        }
    }
    getEdgeCyl(f,edgeIdx,scene) {
            let p1=new BABYLON.Vector3().fromArray(this.points[f[edgeIdx]]);
            let p2=new BABYLON.Vector3().fromArray(this.points[f[(edgeIdx+1)%f.length]]);
            let distance = BABYLON.Vector3.Distance(p1,p2 )-SphD;
        
            let cylinder = BABYLON.MeshBuilder.CreateCylinder("cylinder", 
                {height:distance, diameterTop:0.1, diameterBottom:0.1, tessellation:6, subdivisions:1}, scene);
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
        this.VSelMeshes.forEach((m,idx)=> { m.material.diffuseColor=(i==idx?BABYLON.Color3.Yellow():BABYLON.Color3.White()); });
        this.selectedV=i;
        if(i>=0) console.log("Selected V"+this.selectedF[i]);
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
        let mid=p1.add(p2.subtract(p1).scale(0.5));
        //let lines = BABYLON.MeshBuilder.CreateLines("lines", { points:[mid,mid.add(cam)] }, scene);
        let newPt=mid.add(cam.applyRotationQuaternion(BABYLON.Quaternion.RotationAxis(base,120*Math.PI/180)).scale(0.707));
        //console.log(newPt);
        let newFace=[p2i,p1i,this.points.length];
        this.points.push([newPt.x,newPt.y,newPt.z]);
        this.faces.push(newFace);               
        this.createFaceMesh(newFace,this.faces.length-1,scene);
        this.selectFace(this.faces.length-1,scene);
    }
    extendFace(scene) {
        if(this.selectedE<0) return;
        let p1i=this.selectedE, p2i=(this.selectedE+1)%f.length;
        let p1=new BABYLON.Vector3().fromArray(this.points[p1i]);
        let p2=new BABYLON.Vector3().fromArray(this.points[p2i]);

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
    closeFacefromV(scene) {
        if(this.selectedV <0) return;
        let curV=this.selectedF[this.selectedV];
        let fe=this.findFreeEdges(curV);
        if(fe.size != 2) return;
        let newFace=[curV];
        fe.forEach( v=> {newFace.push(v);});
        this.faces.push(newFace);               
        this.createFaceMesh(newFace,this.faces.length-1,scene);
        this.selectFace(this.faces.length-1,scene);

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
        for(const v of toBeDeleted) this.delPt(v);
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
        const n= vnormalize(vXprd(v1,v2));
        const fwd=vnormalize(vadd(v1,v2));
        return BABYLON.Quaternion.FromLookDirectionLH(BABYLON.Vector3.Zero().fromArray(fwd),BABYLON.Vector3.Zero().fromArray(n)).invert();
    }
    getFlatCoords() {
        let am=[],res=[];
        for(let f of this.faceMeshes) { const lam = f.clone(); lam.setEnabled(false); am.push(lam);}
        
        for(let i=0;i<this.faces.length;++i) {
            res[i]=[];
            let f=this.faces[i];
            am[i].rotationQuaternion = this.getRot(f);
            let c=[0,0,0];
            for(let p of f) c=vadd(c,this.points[p]);
            c= smult(-1/f.length,c);
            let wm=new BABYLON.Matrix();
            wm= am[i].computeWorldMatrix(true);
            am[i].position=BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Zero().fromArray(c),wm);
            wm=am[i].computeWorldMatrix(false);
            res[i]=am[i].position;
        }
        return res;
    }
    
}