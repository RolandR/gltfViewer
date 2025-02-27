
const fileInput = document.getElementById("fileUpload");
const imagesContainer = document.getElementById("imagesContainer");

const structureContainer = document.getElementById("structureContainer");

let glb = {};
let buffers = [];
let scenes = [];
let nodes = [];
let materials = [];
let images = [];
let textures = [];

let outstandingImageCount = 0;

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
		
		setTimeout(function(){processFile(file, loadedFile);}, 200);
	}
	
	setTimeout(function(){reader.readAsArrayBuffer(file);}, 100);
}

function processFile(file, fileData){
	console.log(file);
	let view = new DataView(fileData);
	const decoder = new TextDecoder();
	let json = {};
	
	const magic = fileData.slice(0, 4);
	console.log("Magic bytes: " + decoder.decode(magic));
	console.log("Version: " + view.getUint32(1*4, true));
	console.log("File length: " + view.getUint32(2*4, true));
	
	let fileInfo = document.createElement("div");
	fileInfo.className = "info fileInfo";
	fileInfo.innerHTML = "<h2>" + file.name + "</h2>";
	fileInfo.innerHTML += "File length: " + view.getUint32(2*4, true) + "<br>";
	fileInfo.innerHTML += "Magic bytes: " + decoder.decode(magic) + "<br>";
	fileInfo.innerHTML += "Version: " + view.getUint32(1*4, true);
	
	structureContainer.appendChild(fileInfo);
	
	
	
	let jsonText = "";
	
	let i = 3*4;
	while(i < view.byteLength){
		let chunkLength = view.getUint32(i, true);
		let chunkType = decoder.decode(fileData.slice(i+4, i+8));
		console.log("chunkData length: " + chunkLength);
		console.log("Chunk type: " + chunkType);
		
		let chunkInfo = document.createElement("div");
		chunkInfo.className = "info chunkInfo";
		chunkInfo.innerHTML = "Chunk type: " + chunkType + "<br>";
		chunkInfo.innerHTML += "chunkData length: " + chunkLength;
		
		structureContainer.appendChild(chunkInfo);
		
		if(chunkType.toLowerCase() == "json"){
			jsonText = decoder.decode(fileData.slice(i+8, i+8+chunkLength));
		} else {
			buffers.push(fileData.slice(i+8, i+8+chunkLength));
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
	
	setTimeout(function(){
		loadingStatus.className = "fading";
		setTimeout(function(){
			loadingStatus.style.display = "none";
		}, 500);
	}, 100);
}

function processScenes(){
	for(let i in glb.scenes){
		let sceneInfo = document.createElement("div");
		sceneInfo.className = "info sceneInfo";
		sceneInfo.innerHTML = "<h2>Scene " + i + "</h2>";
		
		scenes[i] = {
			nodes: processNodes(glb.scenes[i].nodes, sceneInfo)
		};
		
		structureContainer.appendChild(sceneInfo);
	}
}

function processNodes(nodes, infoContainer){
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
		
		let nodeInfo = document.createElement("div");
		nodeInfo.className = "info nodeInfo";
		nodeInfo.innerHTML = "<h3>" + node.name + "</h3>";
		if(node.mesh !== undefined){
			nodeInfo.innerHTML += "Mesh ID: " + node.mesh;
		}
		
		node.children = processNodes(glb.nodes[nodes[n]].children, nodeInfo);
		outNodes.push(node);
		
		infoContainer.appendChild(nodeInfo);
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
		}
	}
}

function processMeshes(){
	if(glb.meshes){
		for(let m in glb.meshes){
			let mesh = glb.meshes[m];
			let primitives = [];
			
			let meshInfo = document.createElement("div");
			meshInfo.className = "info meshInfo";
			meshInfo.innerHTML = "<h3>" + mesh.name + "</h2>";
			meshInfo.innerHTML += "ID: " + m + "<br>";
			
			for(let p in mesh.primitives){
				
				let indexAccessor = glb.accessors[mesh.primitives[p].indices];
				let indexBufferView = glb.bufferViews[indexAccessor.bufferView];
				let indexByteStride = 2; // 2 bytes for Uint16
				if(indexBufferView.byteStride){
					indexByteStride = indexBufferView.byteStride;
				}
				let indexView = new Uint16Array(indexBufferView.byteLength/2);
				for(let i = 0; i < indexBufferView.byteLength/2; i++){
					indexView[i] = indexBufferView.view.getUint16(i*2, true);
				}
					
				let positionAccessor = glb.accessors[mesh.primitives[p].attributes.POSITION];
				let positionBufferView = glb.bufferViews[positionAccessor.bufferView];
				let positionByteStride = 4*3; // 4 bytes for float32, *3 for VEC3
				if(positionBufferView.byteStride){
					positionByteStride = positionBufferView.byteStride;
				}
				let positionView = new Float32Array(positionBufferView.byteLength/4);
				for(let i = 0; i < positionBufferView.byteLength/4; i++){
					positionView[i] = positionBufferView.view.getFloat32(i*4, true);
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
				
				if(mesh.primitives[p].attributes.TEXCOORD_0 === undefined){
					console.error(mesh.primitives[p].attributes);
				}
				
				let texCoordAccessor = glb.accessors[mesh.primitives[p].attributes.TEXCOORD_0]; //note: this isn't necessarily always TEXCOORD_0. In this case, we'd fall flat on our face.
				let texCoordBufferView = glb.bufferViews[texCoordAccessor.bufferView];
				let texCoordByteStride = 4*2; // 4 bytes for float32, *2 for VEC2
				if(texCoordBufferView.byteStride){
					texCoordByteStride = texCoordBufferView.byteStride;
				}
				let texCoordView = new Float32Array(texCoordBufferView.byteLength/4);
				for(let i = 0; i < texCoordBufferView.byteLength/4; i++){
					texCoordView[i] = texCoordBufferView.view.getFloat32(i*4, true);
				}
				
				primitives.push({
					indexView: indexView,
					indexByteStride: indexByteStride,
					positionView: positionView,
					positionByteStride: positionByteStride,
					normalView: normalView,
					normalByteStride: normalByteStride,
					texCoordView: texCoordView,
					texCoordByteStride: texCoordByteStride,
					material: mesh.primitives[p].material
				});
				
				let primitiveInfo = document.createElement("div");
				primitiveInfo.className = "info primitiveInfo";
				primitiveInfo.innerHTML += "Material: " + materials[mesh.primitives[p].material].name + "<br>";
				meshInfo.appendChild(primitiveInfo);
			}
			
			structureContainer.appendChild(meshInfo);
			
			let outMesh = {
				id: m,
				name: mesh.name,
				primitives: primitives
			}
		}
	}
}