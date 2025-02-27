
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
let meshes = [];

let flatMeshes = [];

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
		//console.log(jsonText);
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
	
	flattenMeshes();
	console.log(flatMeshes);
	
	buildNewFile();
	
	setTimeout(function(){
		loadingStatus.className = "fading";
		setTimeout(function(){
			loadingStatus.style.display = "none";
		}, 500);
	}, 100);
}

function buildNewFile(){
	let json = {
		asset: {
			generator: "Roland's GLTF converter thingy!",
			version: "2.0"
		},
		scene: 0,
		scenes: [],
		nodes: [],
		materials: [],
		meshes: [],
		accessors: [],
		bufferViews: [],
		buffers: []
	}
	
	let bufferViews = [];
	let offset = 0;
	
	json.scenes[0] = {
		name: scenes[0].name,
		nodes: []
	}
	
	for(let i in flatMeshes){
		
		json.nodes.push({
			name: flatMeshes[i].nodeName,
			mesh: i*1
		});
		json.scenes[0].nodes.push(json.nodes.length-1); // TODO: use actual node structure
		
		let mesh = flatMeshes[i];
		
		let outMesh = {
			name: mesh.name,
			primitives: []
		};
		
		
		
		for(let p in mesh.primitives){
			
			outMesh.primitives[p] = {
				attributes: {}
			};
			
			let pointer;
			
			/*======== indices ========*/
			bufferViews.push(mesh.primitives[p].indices);
			pointer = bufferViews.length - 1;
			
			json.bufferViews.push({
				buffer: 0,
				byteLength: bufferViews[pointer].byteLength,
				byteOffset: offset,
				target: 34963 // indices (ELEMENT_ARRAY_BUFFER)
			});
			offset += bufferViews[pointer].byteLength;
			
			json.accessors.push({
				bufferView: pointer,
				byteOffset: 0,
				type: "SCALAR",
				componentType: 5123,
				count: mesh.primitives[p].indices.length
			});
			outMesh.primitives[p].indices = pointer;
			
			/*======== positions ========*/
			bufferViews.push(mesh.primitives[p].positions);
			pointer = bufferViews.length - 1;
			
			json.bufferViews.push({
				buffer: 0,
				byteLength: bufferViews[pointer].byteLength,
				byteOffset: offset,
				target: 34962 // positions (ARRAY_BUFFER)
			});
			offset += bufferViews[pointer].byteLength;
			
			let min = [
				mesh.primitives[p].positions[0],
				mesh.primitives[p].positions[1],
				mesh.primitives[p].positions[2],
			];
			let max = [
				mesh.primitives[p].positions[0],
				mesh.primitives[p].positions[1],
				mesh.primitives[p].positions[2],
			];
			
			for(let i = 0; i < mesh.primitives[p].positions.length; i += 3){
				min[0] = Math.min(mesh.primitives[p].positions[i+0], min[0]);
				max[0] = Math.max(mesh.primitives[p].positions[i+0], max[0]);
				
				min[1] = Math.min(mesh.primitives[p].positions[i+1], min[1]);
				max[1] = Math.max(mesh.primitives[p].positions[i+1], max[1]);
				
				min[2] = Math.min(mesh.primitives[p].positions[i+2], min[2]);
				max[2] = Math.max(mesh.primitives[p].positions[i+2], max[2]);
			}
			
			json.accessors.push({
				bufferView: pointer,
				byteOffset: 0,
				type: "VEC3",
				componentType: 5126,
				count: mesh.primitives[p].positions.length/3,
				min: min,
				max: max
			});
			outMesh.primitives[p].attributes.POSITION = pointer;
			
			/*======== normals ========*/
			bufferViews.push(mesh.primitives[p].normals);
			pointer = bufferViews.length - 1;
			
			json.bufferViews.push({
				buffer: 0,
				byteLength: bufferViews[pointer].byteLength,
				byteOffset: offset,
				target: 34962 // positions (ARRAY_BUFFER)
			});
			offset += bufferViews[pointer].byteLength;
			
			json.accessors.push({
				bufferView: pointer,
				byteOffset: 0,
				type: "VEC3",
				componentType: 5126,
				count: mesh.primitives[p].normals.length/3
			});
			outMesh.primitives[p].attributes.NORMAL = pointer;
			
			/*======== texCoords ========*/
			bufferViews.push(mesh.primitives[p].texCoords);
			pointer = bufferViews.length - 1;
			
			json.bufferViews.push({
				buffer: 0,
				byteLength: bufferViews[pointer].byteLength,
				byteOffset: offset,
				target: 34962 // positions (ARRAY_BUFFER)
			});
			offset += bufferViews[pointer].byteLength;
			
			json.accessors.push({
				bufferView: pointer,
				byteOffset: 0,
				type: "VEC2",
				componentType: 5126,
				count: mesh.primitives[p].texCoords.length/2
			});
			outMesh.primitives[p].attributes.TEXCOORD_0 = pointer;
			
			outMesh.primitives[p].material = 0; // todo: use materials
		}
		
		json.meshes.push(outMesh);
	}
	
	let bufferLength = offset;
	
	json.buffers[0] = {
		byteLength: bufferLength
	};
	
	json.materials[0] = {
		doubleSided: false,
		name: "default",
		pbrMetallicRoughness: {
			baseColorFactor: [0.8, 0.8, 0.8, 1],
			metallicFactor: 0,
			roughnessFactor: 0.5
		}
	}
	
	/*======== create buffer ========*/
	//let buffer = new Blob(bufferViews);
	
	console.log(json);
	
	let jsonString = JSON.stringify(json);
	
	const encoder = new TextEncoder();
	let encodedText = encoder.encode(jsonString);
	
	if(encodedText.byteLength%4 !== 0){
		// the gltf standard wants the length of a every chunk to be a multiple of 4 bytes.
		// let's add spaces to the json string to comply with that.
		
		let missingSpaces = 4-encodedText.byteLength%4;
		let spaces = " ".repeat(missingSpaces);
		jsonString += spaces;
		encodedText = encoder.encode(jsonString);
	}
	
	let fileLength = 12 + 8 + encodedText.length + 8 + bufferLength;
	
	let fileHeader = new Uint32Array(3);
	fileHeader[0] = 0x46546C67;
	fileHeader[1] = 2;
	fileHeader[2] = fileLength;
	
	let jsonHeader = new Uint32Array(2);
	jsonHeader[0] = encodedText.length;
	jsonHeader[1] = 0x4E4F534A;
	
	let bufferHeader = new Uint32Array(2);
	bufferHeader[0] = bufferLength;
	bufferHeader[1] = 0x004E4942;
	
	let fileBlob = new Blob([
		fileHeader,
		jsonHeader,
		encodedText,
		bufferHeader,
		...bufferViews
	], {type: "model/glb"});
	
	console.log(fileLength);
	console.log(fileBlob);
	
	let objectUrl = URL.createObjectURL(fileBlob);
	
	let downloadLink = document.createElement("a");
	downloadLink.innerHTML = "Download GLB";
	downloadLink.download = "output.glb";
	downloadLink.href = objectUrl;
	structureContainer.appendChild(downloadLink);
	
	
	
}

function processScenes(){
	for(let i in glb.scenes){
		scenes[i] = {
			nodes: processNodes(glb.scenes[i].nodes)
		};
	}
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

function flattenMeshes(){
	for(let s in scenes){
		for(let n in scenes[s].nodes){
			flattenNodes(scenes[s].nodes[n]);
		}
	}
}

function transformPositions(positions, matrix, isNormal){
	
	let out = new Float32Array(positions.length);
	
	let v4 = 1.0;
	if(isNormal){
		v4 = 0.0;
	}
	
	for(let i = 0; i < positions.length; i += 3){
		let vec = [
			positions[i  ],
			positions[i+1],
			positions[i+2],
			v4
		];
		
		let transformedVec = multiplyMatrixByVector(matrix, vec);
		
		if(isNormal){
			transformedVec = normalizeVec4([transformedVec[0], transformedVec[1], transformedVec[2], 0.0]);
		}
		
		out[i  ] = transformedVec[0];
		out[i+1] = transformedVec[1];
		out[i+2] = transformedVec[2];
		
		/*out[i  ] = positions[i+0];
		out[i+1] = positions[i+1];
		out[i+2] = positions[i+2];*/
	}
	
	return out;
}

function flattenNodes(node){
	if(node.mesh !== undefined){
		let mesh = meshes[node.mesh];
		let flatMesh = {};
		flatMesh.id = node.mesh;
		flatMesh.nodeName = node.name;
		flatMesh.name = mesh.name;
		flatMesh.primitives = [];
		
		let modelMatrix = node.matrix;
		
		for(let p in mesh.processedPrimitives){
			let primitive = {};
			primitive.indices = mesh.processedPrimitives[p].indexView;
			
			primitive.positions = transformPositions(mesh.processedPrimitives[p].positionView, modelMatrix, false);
			primitive.normals = transformPositions(mesh.processedPrimitives[p].normalView, modelMatrix, true);
			primitive.texCoords = mesh.processedPrimitives[p].texCoordView;
			
			
			flatMesh.primitives.push(primitive);
		}
		
		flatMeshes.push(flatMesh);
	}
	
	for(let c in node.children){
		flattenNodes(node.children[c]);
	}
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
				
				let texCoordView = 0;
				let texCoordByteStride = 0;
				
				if(mesh.primitives[p].attributes.TEXCOORD_0 === undefined){
					//console.error(mesh.primitives[p].attributes);
					
				} else {
					
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
			}
			mesh.processedPrimitives = primitives;
			meshes[m] = mesh;
		}
	}
}