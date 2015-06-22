var BVH = { REVISION:'0.1a'};

BVH.TO_RAD = Math.PI / 180;
window.URL = window.URL || window.webkitURL;

BVH.Reader = function(){
	this.debug = true;
	this.type = "";
	this.data = null;
	this.root = null;
	this.numFrames = 0;
	this.secsPerFrame = 0;
	this.play = false;
    this.ghost = true;
	this.channels = null;
	this.lines = "";
	
	this.speed = 1;

	this.nodes = null;
	
	this.frame = 0;
	this.oldFrame = 0;
	this.startTime = 0;
	
	this.position = new THREE.Vector3( 0, 0, 0 );
	this.scale = 1;

	this.tmpOrder = "";
	this.tmpAngle = [];

	this.skeleton = null;
    this.joint = null;
	this.bones = [];
    this.line_geos = [];
	this.boneSize = 1.5;

	this.material = new THREE.MeshBasicMaterial({ color: 0x0000cc });
    this.line_material = new THREE.MeshNormalMaterial({ shading: THREE.SmoothShading });
    this.ghostMaterial = new THREE.MeshBasicMaterial({color: 0x0000cc, opacity:0.3, transparent:true});
    this.ghostaLineMaterial = new THREE.MeshNormalMaterial({ shading: THREE.SmoothShading, opacity:0.4, transparent:true})
    
    this.ghostArray = [];
    this.ghostLineArray = [];
    this.ghost_count = 0;

},

BVH.Reader.prototype = {
    constructor: BVH.Reader,

    load:function(fname){
    	this.type = fname.substring(fname.length-3,fname.length);

    	var _this = this;
		var xhr = new XMLHttpRequest();
		xhr.open( 'GET', fname, true );

		if(this.type === 'bvh'){ // direct from file
			xhr.onreadystatechange = function(){ if ( this.readyState == 4 ){ _this.parseData(this.responseText.split(/\s+/g));}};			
	    } 
	    xhr.send( null );
    },
    parseData:function(data){
    	this.data = data;
		this.channels = [];
		this.nodes = [];
		var done = false;
		while (!done) {
			switch (this.data.shift()) {
			case 'ROOT':
			    if(this.root !== null) this.clearNode();

				this.root = this.parseNode(this.data);
				this.root.position.copy(this.position);
				this.root.scale.set(this.scale,this.scale,this.scale);

				if(this.debug){
					this.addSkeleton( this.nodes.length );
				}
				break;
			case 'MOTION':
				this.data.shift();
				this.numFrames = parseInt( this.data.shift() );
				this.data.shift();
				this.data.shift();
				this.secsPerFrame = parseFloat(this.data.shift());
				done = true;
			}
		}
		this.startTime = Date.now();
		this.play = true;
    },
    reScale:function (s) {
    	this.scale = s;
    	this.root.scale.set(this.scale,this.scale,this.scale);
    },
    rePosition:function (v) {
    	this.position = v;
    	this.root.position.copy(this.position);
    },

    addSkeleton:function ( n ) {
    	this.skeleton = new THREE.Object3D();
        this.joint = new THREE.Object3D();
    	this.bones = [];
        this.line_geos = [];

    	var n = this.nodes.length, node, bone;
        var geo = new THREE.SphereGeometry(1.0,32,32);
    	//geo.applyMatrix( new THREE.Matrix4().makeTranslation( 0, 0, 0.5 ) );  

    	for(var i=0; i<n; i++){
    		node = this.nodes[i];
    		if ( node.name !== 'Site' ){
                bone = new THREE.Mesh(geo, this.material);
    			bone.castShadow = true;
    			bone.rotation.order = 'XYZ';
	    		bone.name = node.name;
                this.joint.add(bone);
	    		this.bones[i] = bone;
                if(node.children.length)
                {
                    var target = new THREE.Vector3().setFromMatrixPosition( node.children[0].matrixWorld );
                    var line_geometry, line_mesh;
                    if(node.name == 'Head')
                    {
                        line_geometry = new THREE.SphereGeometry(1.0,32,32);
                        line_mesh = new THREE.Mesh( line_geometry, this.line_material );             
                    }
                    else
                    {
                        line_geometry = new THREE.CylinderGeometry( this.boneSize*.5, this.boneSize*.5, 1, 16 );
                        line_mesh = new THREE.Mesh( line_geometry, this.line_material ); 
                    }
                    this.line_geos[i] = line_mesh;
                    this.skeleton.add(line_mesh);
                }
    	    }
    	}
    	scene.add( this.skeleton );
        scene.add( this.joint );
        if(this.ghost == true) this.ghost_count = 0;
    },
    
    updateSkeleton:function (  ) {
    	var mtx, node, bone;
    	var n = this.nodes.length;
    	var target;
    	for(var i=0; i<n; i++){
    		node = this.nodes[i];
    		bone = this.bones[i];
    		if ( node.name !== 'Site' ){
	    		mtx = node.matrixWorld;
	    		bone.position.setFromMatrixPosition( mtx );
                this.bones[i].scale.set(this.boneSize*0.5, this.boneSize*0.5, this.boneSize*0.5);
	    		if(node.children.length)
                {
	    			target = new THREE.Vector3().setFromMatrixPosition( node.children[0].matrixWorld );
                    var direction = new THREE.Vector3().subVectors( bone.position, target );
                    if(node.name !== 'Head')
                        this.line_geos[i].scale.set(this.boneSize*.5, direction.length(), this.boneSize*.5);
                    else
                        this.line_geos[i].scale.set(this.boneSize, this.boneSize*1.5, this.boneSize);
                    var mid_pos = new THREE.Vector3();
                    mid_pos.x = (bone.position.x + target.x)/2;
                    mid_pos.y = (bone.position.y + target.y)/2;
                    mid_pos.z = (bone.position.z + target.z)/2;
                    this.line_geos[i].position.set(mid_pos.x, mid_pos.y, mid_pos.z);
                    var up = new THREE.Vector3(0, 1, 0);
                    var crossVecs = new THREE.Vector3();
                    crossVecs.crossVectors(up,direction);
                    crossVecs.normalize();
                    var dotVecs = Math.acos(direction.dot(up)/(direction.length()*up.length()));
                    var q = new THREE.Quaternion();
                    q.setFromAxisAngle(crossVecs, dotVecs);
                    q.normalize();
                    this.line_geos[i].useQuaternion = true;
                    this.line_geos[i].quaternion.set(q.x, q.y, q.z, q.w);
	    		}
	    	}
    	}
    },
    
    createGhost:function()
    {
        var mtx, node;
    	var n = this.nodes.length;
    	var target;
        var ghost_joint = new THREE.Object3D();
        var ghost_skeleton = new THREE.Object3D();
     	for(var i=0; i<n; i++){
    		node = this.nodes[i];
    		if ( node.name !== 'Site' ){
	    		mtx = node.matrixWorld;
                var geo = new THREE.SphereGeometry(1.0,32,32);
                var ghost_bone = new THREE.Mesh(geo, this.ghostMaterial);
                ghost_bone.position.setFromMatrixPosition( mtx );
                ghost_bone.scale.set(this.boneSize*0.5, this.boneSize*0.5, this.boneSize*0.5);
                ghost_joint.add(ghost_bone);
	    		if(node.children.length)
                {
	    			target = new THREE.Vector3().setFromMatrixPosition( node.children[0].matrixWorld );
                    var line_geometry, line_mesh;
                    if(node.name == 'Head')
                    {
                        line_geometry = new THREE.SphereGeometry(1.0,32,32);
                        line_mesh = new THREE.Mesh( line_geometry, this.ghostaLineMaterial );             
                    }
                    else
                    {
                        line_geometry = new THREE.CylinderGeometry( this.boneSize*.5, this.boneSize*.5, 1, 16 );
                        line_mesh = new THREE.Mesh( line_geometry, this.ghostaLineMaterial ); 
                    }    
                    var direction = new THREE.Vector3().subVectors( ghost_bone.position, target );
                    if(node.name !== 'Head')
                        line_mesh.scale.set(this.boneSize*.5, direction.length(), this.boneSize*.5);
                    else
                        line_mesh.scale.set(this.boneSize, this.boneSize*1.5, this.boneSize);
                    var mid_pos = new THREE.Vector3();
                    mid_pos.x = (ghost_bone.position.x + target.x)/2;
                    mid_pos.y = (ghost_bone.position.y + target.y)/2;
                    mid_pos.z = (ghost_bone.position.z + target.z)/2;
                    line_mesh.position.set(mid_pos.x, mid_pos.y, mid_pos.z);
                    var up = new THREE.Vector3(0, 1, 0);
                    var crossVecs = new THREE.Vector3();
                    crossVecs.crossVectors(up,direction);
                    crossVecs.normalize();
                    var dotVecs = Math.acos(direction.dot(up)/(direction.length()*up.length()));
                    var q = new THREE.Quaternion();
                    q.setFromAxisAngle(crossVecs, dotVecs);
                    q.normalize();                    
                    line_mesh.useQuaternion = true;
                    line_mesh.quaternion.set(q.x, q.y, q.z, q.w);
                    ghost_skeleton.add(line_mesh);   
	    		}
	    	}
    	}
        this.ghostArray[this.ghost_count] = ghost_joint;
        this.ghostLineArray[this.ghost_count] = ghost_skeleton;
        scene.add(this.ghostArray[this.ghost_count]);
        scene.add(this.ghostLineArray[this.ghost_count]);
        this.ghost_count++;
    },
    
	transposeName:function(name){
		if(name==="hip") name = "Hips";
		if(name==="abdomen") name = "Spine1";
		if(name==="chest") name = "Chest";
		if(name==="neck") name = "Neck";
		if(name==="head") name = "Head";
		if(name==="lCollar") name = "LeftCollar";
		if(name==="rCollar") name = "RightCollar";
		if(name==="lShldr") name = "LeftUpArm";
		if(name==="rShldr") name = "RightUpArm";
		if(name==="lForeArm") name = "LeftLowArm";
		if(name==="rForeArm") name = "RightLowArm";
		if(name==="lHand") name = "LeftHand";
		if(name==="rHand") name = "RightHand";
		if(name==="lFoot") name = "LeftFoot";
		if(name==="rFoot") name = "RightFoot";
		if(name==="lThigh") name = "LeftUpLeg";
		if(name==="rThigh") name = "RightUpLeg";
		if(name==="lShin") name = "RightLowLeg";
		if(name==="rShin") name = "LeftLowLeg";

		// leg
		if(name==="RightHip") name = "RightUpLeg";
		if(name==="LeftHip") name = "LeftUpLeg";
		if(name==="RightKnee") name = "RightLowLeg";
		if(name==="LeftKnee") name = "LeftLowLeg";
		if(name==="RightAnkle") name = "RightFoot";
		if(name==="LeftAnkle") name = "LeftFoot";
		// arm
		if(name==="RightShoulder") name = "RightUpArm";
		if(name==="LeftShoulder") name = "LeftUpArm";
		if(name==="RightElbow") name = "RightLowArm";
		if(name==="LeftElbow") name = "LeftLowArm";
		if(name==="RightWrist") name = "RightHand";
		if(name==="LeftWrist") name = "LeftHand";

		if(name==="rcollar") name = "RightCollar";
		if(name==="lcollar") name = "LeftCollar";

		if(name==="rtoes") name = "RightToe";
		if(name==="ltoes") name = "LeftToe";

		if(name==="upperback") name = "Spine1";
		
		return name;
	},
    parseNode:function(data){
    	var name, done, n, node, t;
		name = data.shift();
		name = this.transposeName(name);
		node = new THREE.Object3D();
		node.name = name;

		done = false;
		while ( !done ) {
			switch ( t = data.shift()) {
				case 'OFFSET':
					node.position.set( parseFloat( data.shift() ), parseFloat( data.shift() ), parseFloat( data.shift() ) );
					node.offset = node.position.clone();
					break;
				case 'CHANNELS':
					n = parseInt( data.shift() );
					for ( var i = 0;  0 <= n ? i < n : i > n;  0 <= n ? i++ : i-- ) { 
						this.channels.push({ node: node, prop: data.shift() });
					}
					break;
				case 'JOINT':
				case 'End':
					node.add( this.parseNode(data) );
					break;
				case '}':
					done = true;
			}
		}
		this.nodes.push(node);
		return node;
    },
    clearNode:function(){
    	var i;

    	if(this.nodes){

	    	for (i=0; i<this.nodes.length; i++){
				this.nodes[i] = null;
			}
			this.nodes.length = 0;

			if(this.bones.length > 0){
		    	for ( i=0; i<this.bones.length; i++){
					if(this.bones[i]){
						this.bones[i].geometry.dispose();
					}
				}
				this.bones.length = 0;
		        scene.remove( this.skeleton );
                scene.remove( this.joint );
                this.clearGhostArray();    
		   }
		}
    },
    animate:function(){
        
    	debugTell( "frame:"+this.frame + "  frames:"+this.numFrames);
    	var ch;
		var n =  this.frame % this.numFrames * this.channels.length;
		var ref = this.channels;
		var isRoot = false;

		for ( var i = 0, len = ref.length; i < len; i++) {
			ch = ref[ i ];
			if(ch.node.name === "Hips") isRoot = true;
			else isRoot = false;


			switch ( ch.prop ) {
				case 'Xrotation':
				    this.autoDetectRotation(ch.node, "X", parseFloat(this.data[n]));
					//ch.node.rotation.x = (parseFloat(this.data[n])) * BVH.TO_RAD;
					break;
				case 'Yrotation':
				    this.autoDetectRotation(ch.node, "Y", parseFloat(this.data[n]));
					//ch.node.rotation.y = (parseFloat(this.data[n])) * BVH.TO_RAD;
					break;
				case 'Zrotation':
				    this.autoDetectRotation(ch.node, "Z", parseFloat(this.data[n]));
					//ch.node.rotation.z = (parseFloat(this.data[n])) * BVH.TO_RAD;
					break;
				case 'Xposition':
				    if(isRoot) ch.node.position.x = ch.node.offset.x + parseFloat(this.data[n])+ this.position.x;
					else ch.node.position.x = ch.node.offset.x + parseFloat(this.data[n]);
					break;
				case 'Yposition':
				    if(isRoot) ch.node.position.y = ch.node.offset.y + parseFloat(this.data[n])+ this.position.y;
					else ch.node.position.y = ch.node.offset.y + parseFloat(this.data[n]);
					break;
				case 'Zposition':
				    if(isRoot) ch.node.position.z = ch.node.offset.z + parseFloat(this.data[n])+ this.position.z;
					else ch.node.position.z = ch.node.offset.z + parseFloat(this.data[n]);
				break;
			}

			n++;
		}
		if(this.bones.length > 0) 
        {
            this.updateSkeleton();
            if(this.frame % (20*Math.ceil(this.numFrames/1000)) ==0 && this.frame !==0 && this.ghost == true)
            {
                this.createGhost();
            }
        }
		if(this.ghost == false)
        {
            this.clearGhostArray();           
        }
    },
    clearGhostArray:function()
    {
        for(var i=0;i<this.ghost_count;i++)
        {
            scene.remove(this.ghostArray[i]);
            scene.remove(this.ghostLineArray[i]);
        }
        this.ghost_count = 0;
        this.ghostArray = [];
        this.ghostLineArray = [];
    },
    autoDetectRotation:function(Obj, Axe, Angle){

    	this.tmpOrder+=Axe;
    	var angle = Angle * BVH.TO_RAD;

    	if(Axe === "X")this.tmpAngle[0] = angle;
    	else if(Axe === "Y")this.tmpAngle[1] = angle;
    	else this.tmpAngle[2] = angle;

    	if(this.tmpOrder.length===3){
    		var e = new THREE.Euler( this.tmpAngle[0], this.tmpAngle[1], this.tmpAngle[2], this.tmpOrder );
    		Obj.setRotationFromEuler(e);

    		Obj.updateMatrixWorld();

    		this.tmpOrder = "";
    		this.tmpAngle.length = 0;
    	}

    },
    update:function(){
    	if ( this.play ) { 
			this.frame = ((((Date.now() - this.startTime) / this.secsPerFrame / 1000) )*this.speed)| 0;
			if(this.oldFrame!==0)this.frame += this.oldFrame;
			if(this.frame > this.numFrames ){this.frame = 0;this.oldFrame=0; this.startTime =Date.now(); this.clearGhostArray(); }

			this.animate();
		}
    },
    next:function(){
    	this.play = false;
    	this.frame ++;
    	if(this.frame > this.numFrames )this.frame = 0;
    	this.animate();
    },
    prev:function(){
    	this.play = false;
    	this.frame --;
    	if(this.frame<0)this.frame = this.numFrames;
    	this.animate();
    }

}

BVH.DistanceTest = function( p1, p2 ){
    var x = p2.x-p1.x;
    var y = p2.y-p1.y;
    var z = p2.z-p1.z;
    var d = Math.sqrt(x*x + y*y + z*z);
    if(d<=0)d=0.1;
    return d;
}

