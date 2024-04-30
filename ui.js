class Ui {
    ui;
    lang="fr";
    keyCB={};
    Controls={};
    
    cb= {
        "up"        : ()=>theOrigami.translateV([0,1],scene),
        "down"      : ()=>theOrigami.translateV([0,-1],scene),
        "left"      : ()=>theOrigami.translateV([-1,0],scene),
        "right"     : ()=>theOrigami.translateV([1,0],scene),
        "rot+"      : ()=>theOrigami.rotateFace(5,scene),
        "rot-"      : ()=>theOrigami.rotateFace(-5,scene),
        "extend"    : ()=>theOrigami.extendFace(scene),                 
        "new"       : ()=>theOrigami.newFace(scene),
        "close"     : ()=>theOrigami.closeFacefromV(scene),
        "del"       : ()=>theOrigami.deleteFace(scene),
        "esc"       : ()=>theOrigami.unselectFace(scene),
        "save"      : ()=>theOrigami.save(),
        "open"      : ()=>theOrigami.open(scene),
        "mail"  	: ()=>theOrigami.email(),
        "import"    : ()=>theOrigami.import() 
    }
    i18n = {
        "fr": {
            "up"        : ["↑","z"], 
            "down"      : ["↓","s"],
            "left"      : ["←","q"],
            "right"     : ["→","d"],
            "rot+"      : ["↻","r"],
            "rot-"      : ["↺","t"],
            "extend"    : ["","x"],                 
            "new"       : ["nouveau","n"],
            "close"     : ["fermer","f"],
            "del"       : ["effacer","Backspace"],
            "esc"       : ["unselect","Escape"],
            "save"      : ["enregisrer","e"],
            "open"      : ["ouvrir","o"],
            "mail"  	: ["📧","m"],
            "import"    : ["importer","i"]
        },
        "en": {
            "up"        : ["↑","w"],
            "down"      : ["↓","s"],
            "left"      : ["←","a"],
            "right"     : ["→","d"],
            "rot+"      : ["↻","r"],
            "rot-"      : ["↺","t"],
            "extend"    : ["","x"],                 
            "new"       : ["new","n"],
            "close"     : ["close","c"],
            "del"       : ["delete","Delete"],
            "esc"       : ["unselect","Escape"],
            "save"      : ["save","v"],
            "open"      : ["open","o"],
            "mail"  	: ["📧","m"],
            "import"    : ["import","i"]
        }
    }
    setLang(l) {
        this.lang=l;
        this.keyCB={};
        for(const k of Object.getOwnPropertyNames(this.i18n[this.lang])) { 
            this.keyCB[this.i18n[this.lang][k][1]]=this.cb[k];
            if(this.Controls[k] != null) this.Controls[k].textBlock.text=this.i18n[this.lang][k][0]+"("+this.i18n[this.lang][k][1]+")";
        }
    }
    createButton(name) {
        const b = BABYLON.GUI.Button.CreateSimpleButton(name, this.i18n[this.lang][name][0]+"("+this.i18n[this.lang][name][1]+")");
        b.cornerRadius = 10;
        b.color = "White";
        b.thickness = 1;
        b.background = "Grey";
        b.onPointerClickObservable.add(this.cb[name]);
        b.paddingLeft=5; b.paddingRight=5;
        b.paddingTop=5; b.paddingBottom=5;
        this.Controls[name]=b;       
        return b; 
    }
    constructor(scene) {
        // GUI
        ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        nameLbl = new BABYLON.GUI.TextBlock();
        nameLbl.text = "";
        nameLbl.color = "white";
        nameLbl.fontSize = 30;
        nameLbl.textVerticalAlignment=BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        nameLbl.top=10
        ui.addControl(nameLbl);    

        let tlgrid=new BABYLON.GUI.Grid(); 
        tlgrid.horizontalAlignment=BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        tlgrid.verticalAlignment=BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        tlgrid.top=5;tlgrid.left=5;tlgrid.width=0.4;
        tlgrid.addColumnDefinition(60,true);tlgrid.addColumnDefinition(60,true);tlgrid.addColumnDefinition(60,true);
        tlgrid.addColumnDefinition(40,true);tlgrid.addColumnDefinition(60,true);
        tlgrid.addColumnDefinition(40,true);tlgrid.addColumnDefinition(100,true);
        tlgrid.addRowDefinition(40,true);tlgrid.addRowDefinition(40,true);
        ui.addControl(tlgrid);
        tlgrid.addControl(this.createButton("up"),0,1);
        tlgrid.addControl(this.createButton("down"),1,1);
        tlgrid.addControl(this.createButton("left"),1,0);
        tlgrid.addControl(this.createButton("right"),1,2);
        tlgrid.addControl(this.createButton("rot-"),0,4);
        tlgrid.addControl(this.createButton("rot+"),1,4);
        tlgrid.addControl(this.createButton("close"),0,6);
        let nouv=this.createButton("new");
        nouv.horizontalAlignment=BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        nouv.verticalAlignment=BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        nouv.width="120px";nouv.height="40px";
        ui.addControl(nouv);
        let panel = new BABYLON.GUI.Grid();
        panel.addRowDefinition(40,true);
        panel.addColumnDefinition(0.35); panel.addColumnDefinition(0.22); panel.addColumnDefinition(0.18);panel.addColumnDefinition(0.25);
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment=BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        panel.width="400px"; panel.height="40px";
        
        panel.addControl(this.createButton("save"),0,0);
        panel.addControl(this.createButton("open"),0,1);
        panel.addControl(this.createButton("mail"),0,2);
        panel.addControl(this.createButton("import"),0,3);
        ui.addControl(panel);  
        
        //language selection
        let langPanel = new BABYLON.GUI.StackPanel();
        langPanel.addControl(this.addRadio("fr", langPanel,true));
        langPanel.addControl(this.addRadio("en", langPanel));

        let rect = new BABYLON.GUI.Rectangle();
        rect.width = "100px";
        rect.height = "70px";
        rect.left=5;
        rect.thickness=0;
        rect.horizontalAlignment=BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        rect.verticalAlignment=BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        rect.addControl(langPanel);
        ui.addControl(rect);
        // Activate the clipboard events listener
        ui.registerClipboardEvents();

        // Add event listener to onClipboardObservable
        ui.onClipboardObservable.add((ev) => {                   
            if(ev.type === BABYLON.ClipboardEventTypes.COPY){
                console.log(ev);
                ev.event.clipboardData.setData("text/plain", "pt = "+JSON.stringify(theOrigami.points)+";\nf = "+JSON.stringify(theOrigami.faces)+";\n");

            }
        });
        

        scene.onKeyboardObservable.add((kbInfo) => {
            console.log(this.keyCB)
            //console.log(kbInfo.event.key);
            if( kbInfo.type == BABYLON.KeyboardEventTypes.KEYDOWN 
                    && this.keyCB[kbInfo.event.key]) 
                this.keyCB[kbInfo.event.key]();
        });
        this.setLang(this.lang);
    }
    addRadio(text, parent,check=false) {
        const button = new BABYLON.GUI.RadioButton();
        button.width = "20px";
        button.height = "20px";
        button.color = "white";
        button.background = "green";     
        button.isChecked=check;
        const _ui=this;
        button.onIsCheckedChangedObservable.add(function(state) {
            if (state) {
                _ui.setLang(text);
            }
        }); 
        const header = BABYLON.GUI.Control.AddHeader(button, text, "80px", { isHorizontal: true, controlFirst: true });
        header.height = "30px";
        header.color="White";
        return header;   
    }

}

//Modal callbacks

const openModal = new bootstrap.Modal('#openDialog');       
        const  pattern = (active,name,i) => `<a class="list-group-item list-group-item-action ${active}" id="list-${i}-list" data-bs-toggle="list" href="#list-${i}" role="tab" aria-controls="list-${i}">${name}</a>`;
        const theList=document.getElementById("openList");

        document.getElementById('openButton').addEventListener("click",e => {
            let selected=theList.querySelector('.active').innerHTML;
            const toOpen=JSON.parse(localStorage[selected]);
            openModal.hide();
            theOrigami.disposeAll();
            theOrigami=new Origami(scene,toOpen.pt,toOpen.f,selected);                   
        });

        const saveModal = new bootstrap.Modal('#saveDialog');
        const txt=document.getElementById("origamiName"); 
        document.getElementById('saveButton').addEventListener("click",e => {
            theOrigami.name=document.getElementById("origamiName").value;
            nameLbl.text=theOrigami.name;
            saveModal.hide();
            let saved=[];
            if(localStorage.hasOwnProperty("saved")) saved = JSON.parse(localStorage.saved);
            if(!saved.includes(theOrigami.name)) {saved.push(theOrigami.name); localStorage.saved=JSON.stringify(saved);}
            let value = { pt:theOrigami.points, f:theOrigami.faces};
            localStorage.setItem(theOrigami.name,JSON.stringify(value));
        });

        const importModal=new bootstrap.Modal('#importDialog');
        const impName = document.getElementById("importName");
        const impDat = document.getElementById("importData");
        document.getElementById('importButton').addEventListener("click",e => {
            if(impName.value==null || impName.value=="") { alert("Entrez un nom avant import"); return;}
            let toImport=null;
            try { toImport=JSON.parse(impDat.value);}
            catch(e) {
                alert("Données invalides!"); return; 
            }
            importModal.hide();
            let saved=[];
            if(localStorage.hasOwnProperty("saved")) saved = JSON.parse(localStorage.saved);
            if(!saved.includes(impName.value)) {saved.push(impName.value); localStorage.saved=JSON.stringify(saved);} 
            let value = { pt:toImport.pt, f:toImport.f};
            localStorage.setItem(impName.value,JSON.stringify(value));
        });




