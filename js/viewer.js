
const fileInput = document.getElementById("fileUpload");
const cameraZInput = document.getElementById("cameraZInput");
const offsetYInput = document.getElementById("offsetYInput");
const imagesContainer = document.getElementById("imagesContainer");

const canvasContainer = document.getElementById("canvasContainer");
const canvas = document.getElementById("renderCanvas");

const defaultTexture = document.getElementById("defaultTexture");

/*const context = canvas.getContext("2d");
const size = Math.min(canvasContainer.clientWidth, canvasContainer.clientHeight);
canvas.width = size;
canvas.height = size;
context.strokeStyle = "#0f0";
context.fillStyle = "#fff";*/

let gl;
let shaderTexts = {};

let glb = {};
let buffers = [];
let scenes = [];
let nodes = [];
let materials = [];
let images = [];
let textures = [];

let angle = 0;
let scale = 0.5;
let offsetY = 0;
let cameraZ = 1.8;

let outstandingImageCount = 0;
let outstandingResourceCount = 0;

const frameCounterEl = document.getElementById("frameCounter");
let frameCounter = 0;

setInterval(
	function(){
		frameCounterEl.innerHTML = frameCounter + " FPS";
		frameCounter = 0;
	},
	1000
);

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

function initIfResourcesAreLoaded(){
	if(outstandingResourceCount === 0){
		
		gl = new Renderer("renderCanvas");
		gl.loadSkybox(skyboxTextures);
		
	}
};

function loadFile(url, callback){
    var request = new XMLHttpRequest();
    request.overrideMimeType("text/plain");
    request.open('GET', url, true);

    request.onreadystatechange = function (){
        if (request.readyState == 4){
            if (request.status == 200){
                callback(request.responseText);
            } else {
				console.error("File is sad ("+request.status+"): "+url);
            }
        }
    };

    request.send();
}

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

cameraZInput.oninput = function(e){
	cameraZ = parseFloat(cameraZInput.value);
}

offsetYInput.oninput = function(e){
	offsetY = parseFloat(offsetYInput.value);
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

fileInput.onchange = function(e){
	e.preventDefault();
	
	const loadingStatus = document.getElementById("loadingStatus");
	const loadingContent = document.getElementById("loadingContent");
	const loadingBar = document.getElementById("loadingBar");
	
	loadingStatus.className = "";
	loadingBar.style.width = "0%";
	loadingStatus.style.display = "block";
	loadingContent.innerHTML = "Loading...<br>";
	
	const file = fileInput.files[0];
	
	const reader = new FileReader();
	
	reader.addEventListener("progress", function(e){
		let progress = ~~((e.loaded/e.total)*60);
		
		loadingBar.style.width = progress+"%";
	});
	
	reader.onload = function(){
		
		loadingContent.innerHTML += "<br>File uploaded, processing...";
		loadingBar.style.width = "60%";
		
		
		loadedFile = reader.result;
		
		setTimeout(function(){processFile(loadedFile);}, 200);
	}
	
	setTimeout(function(){reader.readAsArrayBuffer(file);}, 100);
}

function processFile(file){
	console.log(file);
	let view = new DataView(file);
	const decoder = new TextDecoder();
	let json = {};
	
	const magic = file.slice(0, 4);
	console.log("Magic bytes: " + decoder.decode(magic));
	console.log("Version: " + view.getUint32(1*4, true));
	console.log("File length: " + view.getUint32(2*4, true));
	
	let jsonText = "";
	
	let i = 3*4;
	while(i < view.byteLength){
		let chunkLength = view.getUint32(i, true);
		let chunkType = decoder.decode(file.slice(i+4, i+8));
		console.log("chunkData length: " + chunkLength);
		console.log("Chunk type: " + chunkType);
		
		if(chunkType.toLowerCase() == "json"){
			jsonText = decoder.decode(file.slice(i+8, i+8+chunkLength));
		} else {
			buffers.push(file.slice(i+8, i+8+chunkLength));
		}
		
		i += 8+chunkLength;
	}
	
	if(jsonText){
		glb = JSON.parse(jsonText);
		console.log(glb);
	} else {
		console.log("aint no json text; aborting");
		return;
	}
	
	processBuffers();
	processBufferViews();
	processImages();
}

function finishProcessingIfFilesAreLoaded(){
	if(outstandingImageCount === 0){
		finishProcessing();
	}
}

function finishProcessing(){
	processTextures();
	processMaterials();
	processMeshes();
	processScenes();
	render();
	
	setTimeout(function(){
		loadingStatus.className = "fading";
		setTimeout(function(){
			loadingStatus.style.display = "none";
		}, 500);
	}, 100);
}

function processScenes(){
	for(let i in glb.scenes){
		scenes[i] = {
			nodes: processNodes(glb.scenes[i].nodes)
		};
	}
	
	gl.addScene(scenes[0]);
}

function processNodes(nodes){
	let outNodes = [];
	for(let n in nodes){
		let node = {};
		node.name = glb.nodes[nodes[n]].name;
		node.mesh = glb.nodes[nodes[n]].mesh;
		if(glb.nodes[nodes[n]].matrix){
			node.matrix = glb.nodes[nodes[n]].matrix;
		} else {
			node.matrix = [
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1
			];
			
			if(glb.nodes[nodes[n]].translation){
				node.matrix = multiplyMatrices(node.matrix, makeTranslationMatrix(glb.nodes[nodes[n]].translation));
			}
			
			if(glb.nodes[nodes[n]].rotation){
				node.matrix = multiplyMatrices(node.matrix, makeMatrixFromQuaternion(glb.nodes[nodes[n]].rotation));
			}
			
			if(glb.nodes[nodes[n]].scale){
				node.matrix = multiplyMatrices(node.matrix, makeScaleMatrix(glb.nodes[nodes[n]].scale));
			}
		}
		node.children = processNodes(glb.nodes[nodes[n]].children);
		outNodes.push(node);
		
	}
	return outNodes;
}

function processBuffers(){
	for(let i in glb.buffers){
		glb.buffers[i].bufferData = buffers[i];
	}
}

function processBufferViews(){
	for(let i in glb.bufferViews){
		let bv = glb.bufferViews[i];
		bv.view = new DataView(glb.buffers[bv.buffer].bufferData, bv.byteOffset, bv.byteLength);
	}
}

function processImages(){
	if(glb.images){
		for(let i in glb.images){
			let img = glb.images[i];
			let imageData = new Blob([glb.bufferViews[img.bufferView].view], {type: img.mimeType});
			let imageUrl = URL.createObjectURL(imageData);
			let imgEl = new Image;
			imagesContainer.appendChild(imgEl);
			
			outstandingImageCount++;
			imgEl.onload = function(){
				outstandingImageCount--;
				finishProcessingIfFilesAreLoaded();
			}
			
			imgEl.src = imageUrl;
			img.image = imgEl;
			
			images[i] = imgEl;
			//console.log(imgEl);
		}
	} else {
		finishProcessingIfFilesAreLoaded();
	}
}

function processTextures(){
	for(let t in glb.textures){
		let tex = glb.textures[t];
		
		let sampler = glb.samplers[tex.sampler];
		let img = images[tex.source];
		//console.log(img, img.width, img.height);
		
		gl.addTexture({
			id: t,
			img: img,
			sampler: sampler
		});
	}
}

function processMaterials(){
	if(glb.materials){
		for(let m in glb.materials){
			let mat = glb.materials[m];
			
			let material = {
				id: m,
				name: "default",
				pbrMetallicRoughness: {
					baseColorTexture: {
						index: 0,
						texCoord: 0
					},
					baseColorFactor: [1, 1, 1, 1],
					metallicFactor: 1,
					roughnessFactor: 1
				},
				/*normalTexture:{
					id: 0,
					scale: 0
				}*/
				emissiveFactor: [0, 0, 0],
				alphaMode: "OPAQUE",
				alphaCutoff: 0.5,
				doubleSided: false
			};
			
			if(mat.name){
				material.name = mat.name;
			}
			if(mat.pbrMetallicRoughness){
				if(mat.pbrMetallicRoughness.baseColorTexture){
					if(mat.pbrMetallicRoughness.baseColorTexture.index){
						material.pbrMetallicRoughness.baseColorTexture.index = mat.pbrMetallicRoughness.baseColorTexture.index;
					}
					if(mat.pbrMetallicRoughness.baseColorTexture.texCoord){
						material.pbrMetallicRoughness.baseColorTexture.texCoord = mat.pbrMetallicRoughness.baseColorTexture.texCoord;
					}
				}
				if(mat.pbrMetallicRoughness.baseColorFactor){
					material.pbrMetallicRoughness.baseColorFactor = mat.pbrMetallicRoughness.baseColorFactor;
				}
				if(mat.pbrMetallicRoughness.metallicFactor){
					material.pbrMetallicRoughness.metallicFactor = mat.pbrMetallicRoughness.metallicFactor;
				}
				if(mat.pbrMetallicRoughness.roughnessFactor){
					material.pbrMetallicRoughness.roughnessFactor = mat.pbrMetallicRoughness.roughnessFactor;
				}
			}
			if(mat.emissiveFactor){
				material.emissiveFactor = mat.emissiveFactor;
			}
			/*if(mat.normalTexture){
				if(mat.normalTexture.id){
					
				}
			}*/
			if(mat.alphaMode){
				material.alphaMode = mat.alphaMode;
			}
			if(mat.alphaCutoff){
				material.alphaCutoff = mat.alphaCutoff;
			}
			if(mat.doubleSided){
				material.doubleSided = mat.doubleSided;
			}
			
			materials[m] = material;
			
			gl.addMaterial(material);
		}
	}
}

function processMeshes(){
	if(glb.meshes){
		for(let m in glb.meshes){
			let mesh = glb.meshes[m];
			let primitives = [];
			
			for(let p in mesh.primitives){
				
				let indexAccessor = glb.accessors[mesh.primitives[p].indices];
				let indexBufferView = glb.bufferViews[indexAccessor.bufferView];
				
				let indexByteStride;
				let indexView;
				
				if(gltfEnums.dataTypes[indexAccessor.componentType] == "UNSIGNED_SHORT"){
					indexByteStride = 2; // 2 bytes for Uint16
					indexView = new Uint16Array(indexBufferView.byteLength/2);
					for(let i = 0; i < indexBufferView.byteLength/2; i++){
						indexView[i] = indexBufferView.view.getUint16(i*2, true);
					}
				} else if(gltfEnums.dataTypes[indexAccessor.componentType] == "UNSIGNED_INT"){
					indexByteStride = 4; // 4 bytes for Uint32
					indexView = new Uint32Array(indexBufferView.byteLength/4);
					for(let i = 0; i < indexBufferView.byteLength/4; i++){
						indexView[i] = indexBufferView.view.getUint32(i*4, true);
					}
				} else {
					console.error("Unsupported component type for indices: "+gltfEnums.dataTypes[indexAccessor.componentType]);
				}
				
				if(indexBufferView.byteStride){
					indexByteStride = indexBufferView.byteStride;
				}
					
				let positionAccessor = glb.accessors[mesh.primitives[p].attributes.POSITION];
				
				//console.log(positionAccessor.max);
				
				let sizes = [
					positionAccessor.max[0] - positionAccessor.min[0],
					positionAccessor.max[1] - positionAccessor.min[1],
					positionAccessor.max[2] - positionAccessor.min[2]
				]
				
				let maxSize = Math.max(...sizes);
				
				let offsets = [
					(positionAccessor.max[0] + positionAccessor.min[0])/2,
					(positionAccessor.max[1] + positionAccessor.min[1])/2,
					(positionAccessor.max[2] + positionAccessor.min[2])/2
				]
				
				//console.log(sizes, offsets);
				
				let positionBufferView = glb.bufferViews[positionAccessor.bufferView];
				let positionByteStride = 4*3; // 4 bytes for float32, *3 for VEC3
				if(positionBufferView.byteStride){
					positionByteStride = positionBufferView.byteStride;
				}
				let positionView = new Float32Array(positionBufferView.byteLength/4);
				for(let i = 0; i < positionBufferView.byteLength/4; i += 3){
					for(let j = 0; j < 3; j++){
						//positionView[i+j] = (positionBufferView.view.getFloat32((i+j)*4, true)-offsets[j])/maxSize;
						positionView[i+j] = positionBufferView.view.getFloat32((i+j)*4, true);
					}
				}
				
				let normalAccessor = glb.accessors[mesh.primitives[p].attributes.NORMAL];
				let normalBufferView = glb.bufferViews[normalAccessor.bufferView];
				let normalByteStride = 4*3; // 4 bytes for float32, *3 for VEC3
				if(normalBufferView.byteStride){
					normalByteStride = normalBufferView.byteStride;
				}
				let normalView = new Float32Array(normalBufferView.byteLength/4);
				for(let i = 0; i < normalBufferView.byteLength/4; i++){
					normalView[i] = normalBufferView.view.getFloat32(i*4, true);
				}
				
				let texCoordView;
				let texCoordByteStride;
				let texCoordComponentType;
				
				if(mesh.primitives[p].attributes.TEXCOORD_0 !== undefined){
					let texCoordAccessor = glb.accessors[mesh.primitives[p].attributes.TEXCOORD_0]; //note: this isn't necessarily always TEXCOORD_0. In this case, we'd fall flat on our face.
					let texCoordBufferView = glb.bufferViews[texCoordAccessor.bufferView];
					texCoordByteStride = 4*2; // 4 bytes for float32, *2 for VEC2
					if(texCoordBufferView.byteStride){
						texCoordByteStride = texCoordBufferView.byteStride;
					}
					texCoordView = new Float32Array(texCoordBufferView.byteLength/4);
					for(let i = 0; i < texCoordBufferView.byteLength/4; i++){
						texCoordView[i] = texCoordBufferView.view.getFloat32(i*4, true);
					}
					texCoordComponentType = texCoordAccessor.componentType;
				} else {
					//console.warn("TEXCOORD_0 is undefined:");
					//console.warn(mesh.primitives[p].attributes);
					texCoordView = new Float32Array(indexBufferView.byteLength/4);
					texCoordByteStride = 4*2;
					texCoordComponentType = 5126;
					
				}
				
				primitives.push({
					indexView: indexView,
					indexByteStride: indexByteStride,
					indexComponentType: indexAccessor.componentType,
					positionView: positionView,
					positionByteStride: positionByteStride,
					positionComponentType: positionAccessor.componentType,
					normalView: normalView,
					normalByteStride: normalByteStride,
					normalComponentType: normalAccessor.componentType,
					texCoordView: texCoordView,
					texCoordByteStride: texCoordByteStride,
					texCoordComponentType: texCoordComponentType,
					material: mesh.primitives[p].material
				});
			}
			
			let outMesh = {
				id: m,
				name: mesh.name,
				primitives: primitives
			}
			
			gl.addMesh(outMesh);
		}
	}
}

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

function renderScene(scene){
	//context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = "#000";
	context.fillRect(0, 0, canvas.width, canvas.height);
	
	/*let transform = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	];*/
	
	let transform = [
		Math.cos(angle), 0, Math.sin(angle), 0,
		0, 1, 0, 0,
		-Math.sin(angle), 0, Math.cos(angle), 0,
		0, 0, 0, 1
	];
	
	for(let n in scene.nodes){
		renderNode(scene.nodes[n], transform);
	}
	
	//angle += 0.01;
}

function renderNode(node, transform){
	let localTransform = multiplyMatrices(transform, node.matrix);
	//console.log(localTransform);
	if(node.mesh !== undefined){
		let mesh = glb.meshes[node.mesh];
		for(let p in mesh.primitives){
			
			/*let r = ((m+3)*57)%200 + 56;
			let g = ((m+2)*185)%200 + 56;
			let b = ((m+6)*107)%200 + 56;
			let color = "rgb("+r+", "+g+", "+b+")";*/
			let color = "#0f0";
			context.strokeStyle = color;
			
			let positions = mesh.primitives[p].positions;
			if(positions){
				for(let i = 0; i < positions.length; i += 3){
					if(!positions[i+3]){
						break;
					}
					let triangle = [];
					for(let v = 0; v < 3; v++){
						//let x = positions[i+v][0];
						//let y = positions[i+v][1];
						//let z = positions[i+v][2];
						
						//y = y*-1 + offsetY;
						//x = x * Math.cos(angle) - z * Math.sin(angle);
						
						let pos = [positions[i+v][0], positions[i+v][1], positions[i+v][2]];
						//pos[1] = pos[1] * -1 + offsetY;
						
						let point = makeTranslationMatrix(pos);
						point = multiplyMatrices(localTransform, point);
						
						let x = point[12];
						let y = point[13];
						
						y = y*-1 + offsetY;
						
						//console.log(x, y);
						
						x = (x*scale+0.5)*canvas.width;
						y = (y*scale+0.5)*canvas.height;
						
						triangle[v] = [x, y];
					}
					context.beginPath();
					context.moveTo(triangle[0][0], triangle[0][1]);
					context.lineTo(triangle[1][0], triangle[1][1]);
					context.lineTo(triangle[2][0], triangle[2][1]);
					context.closePath();
					context.stroke();
					/*context.beginPath();
					context.fillRect(triangle[0][0], triangle[0][1], 1, 1);
					context.fillRect(triangle[1][0], triangle[1][1], 1, 1);
					context.fillRect(triangle[2][0], triangle[2][1], 1, 1);*/
					//context.fill();
					//console.log(triangle);
				}
			}
		}
	}
	
	for(let c in node.children){
		renderNode(node.children[c], localTransform);
	}
}