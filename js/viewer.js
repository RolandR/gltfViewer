
function Viewer(canvasContainer, options){

	const canvas = document.createElement("canvas");
	canvas.id = "renderCanvas";
	canvas.width = canvasContainer.clientWidth;
	canvas.height = canvasContainer.clientHeight;
	
	canvasContainer.appendChild(canvas);

	let gl;
	let shaderTexts = {};
	let parser = new GlbParser();
	let glb = {};

	let angle = 0;
	let scale = 0.5;
	let offsetY = 0;
	let cameraZ = 1.8;

	let outstandingImageCount = 0;
	let outstandingResourceCount = 0;
	
	let frameCounter = 0;

	if(options.showFrameCounter){
		const frameCounterEl = document.createElement("div");
		frameCounterEl.id = "frameCounter";
		canvasContainer.appendChild(frameCounterEl);

		setInterval(
			function(){
				frameCounterEl.innerHTML = frameCounter + " FPS";
				frameCounter = 0;
			},
			1000
		);
	}

	let skyboxTextures = {
		up: null,
		dn: null,
		ft: null,
		bk: null,
		lf: null,
		rt: null
	};

	let position = [0, 0, -1];
	let rotationX = 0;
	let rotationY = 0;
	let currentRotationX = 0;
	let currentRotationY = 0;

	let mouseDown = false;
	let startX = 0;
	let startY = 0;

	loadResources();
	
	async function showFile(file){
		glb = await parser.loadFile(file);
		
		sendFileToGl(glb);
	}
	
	async function sendFileToGl(glb){
		
		let json = glb.json;
		
		gl.addScene(json.scenes[json.scene]);
		
		for(let t in json.textures){
			let tex = json.textures[t];
			
			let sampler = json.samplers[tex.sampler];
			let img = json.images[tex.source].image;
			
			gl.addTexture({
				id: t,
				img: img,
				sampler: sampler
			});
		}
		
		for(let m in json.materials){
			gl.addMaterial(json.materials[m]);
		}
		
		for(let m in json.meshes){
			let mesh = json.meshes[m];
			let outMesh = {
				id: m,
				name: mesh.name,
				primitives: mesh.processedPrimitives
			}
			
			gl.addMesh(outMesh);
		}
		
		render();
		
	}

	function initIfResourcesAreLoaded(){
		if(outstandingResourceCount === 0){
			
			gl = new Renderer(canvas, shaderTexts);
			gl.loadSkybox(skyboxTextures);
			
		}
	};

	function loadResources(){
		
		let shaderSources = [
			["vertexShader", "js/shaders/vertex.glsl"],
			["fragmentShader", "js/shaders/fragment.glsl"],
			["skyboxVertexShader", "js/shaders/skyboxVertex.glsl"],
			["skyboxFragmentShader", "js/shaders/skyboxFragment.glsl"],
		];
		
		outstandingResourceCount += 6; // skybox images
		outstandingResourceCount += shaderSources.length; // shaders
		
		// load shaders
		
		for(let i in shaderSources){
			loadFile(shaderSources[i][1], function(responseText){
				shaderTexts[shaderSources[i][0]] = responseText;
				outstandingResourceCount--;
				initIfResourcesAreLoaded();
			});
		}
		
		// load skybox textures
		for(let img in skyboxTextures){
			skyboxTextures[img] = document.createElement("img");
			skyboxTextures[img].onload = function(){
				outstandingResourceCount--;
				initIfResourcesAreLoaded();
			};
		}
		
		skyboxTextures.up.id = "skybox-up";
		skyboxTextures.dn.id = "skybox-dn";
		skyboxTextures.ft.id = "skybox-ft";
		skyboxTextures.bk.id = "skybox-bk";
		skyboxTextures.lf.id = "skybox-lf";
		skyboxTextures.rt.id = "skybox-rt";
		
		skyboxTextures.up.src = "skybox/skybox-up.jpg";
		skyboxTextures.dn.src = "skybox/skybox-dn.jpg";
		skyboxTextures.ft.src = "skybox/skybox-ft.jpg";
		skyboxTextures.bk.src = "skybox/skybox-bk.jpg";
		skyboxTextures.lf.src = "skybox/skybox-lf.jpg";
		skyboxTextures.rt.src = "skybox/skybox-rt.jpg";
	}

	canvas.addEventListener("mousedown", function(e){
		startX = e.clientX;
		startY = e.clientY;
		mouseDown = true;
		e.preventDefault();
	});

	window.addEventListener("mousemove", function(e){
		if(mouseDown){
			var deltaX = startX-e.clientX;
			var deltaY = startY-e.clientY;

			currentRotationY = deltaX/100;
			currentRotationX = deltaY/100;
			
			//update();
			
			//e.preventDefault();
		}
	});

	window.addEventListener("mouseup", function(e){
		mouseDown = false;
		rotationX += currentRotationX;
		rotationY += currentRotationY;
		
		currentRotationX = 0;
		currentRotationY = 0;
		
		//e.preventDefault();
	});

	canvas.addEventListener('wheel', function(e) {
		
		scale -= scale * 0.001 * e.deltaY;
		
		e.preventDefault();
	});

	function render(){
		
		let fieldOfViewInRadians = 40/180*Math.PI;
		let aspectRatio = canvas.width/canvas.height;
		let near = 0.001;
		let far = 5;
		
		let f = 1.0 / Math.tan(fieldOfViewInRadians / 2);
		let rangeInv = 1 / (near - far);
		
		let modelTransform = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		];
		
		let scaleTransform = [
			scale, 0, 0, 0,
			0, scale, 0, 0,
			0, 0, scale, 0,
			0, 0, 0, 1
		];
		
		let offsetTransform = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, offsetY, 0, 1
		];
		
		modelTransform = multiplyArrayOfMatrices([
			modelTransform,
			scaleTransform,
			offsetTransform
			//rotateTransform
		]);
		
		let viewTransforms = [
			[
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1
			]
		];
		
		let sin = Math.sin;
		let cos = Math.cos;
		let a;
		
		a = rotationY + currentRotationY;
		viewTransforms.push([
			 cos(a),   0, sin(a),   0,
				  0,   1,      0,   0,
			-sin(a),   0, cos(a),   0,
				  0,   0,      0,   1
		]);
		
		a = rotationX + currentRotationX;
		viewTransforms.push([
			1,       0,        0,     0,
			0,  cos(a),  sin(a),     0,
			0,  -sin(a),   cos(a),     0,
			0,       0,        0,     1
		]);
		
		viewTransforms.push([
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			position[0], position[1], position[2], 1
		]);
		
		viewTransform = multiplyArrayOfMatrices(viewTransforms);

		let perspectiveTransform = [
			f / aspectRatio, 0,                          0,   0,
			0,               f,                          0,   0,
			0,               0,    (near + far) * rangeInv,  -1,
			0,               0,  near * far * rangeInv * 2,   0
		];
		
		/*let perspectiveTransform = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		];*/
		
		gl.render(modelTransform, viewTransform, perspectiveTransform);
		frameCounter++;
		
		requestAnimationFrame(render);
	}
	
	return {
		showFile: showFile
	};
}