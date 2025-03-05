

function GlbParser(){
	
	let originalJson = {};
	let glb = {};
	
	const imagesContainer = document.getElementById("imagesContainer");
	
	
	async function loadFile(file){
		
		const loadingStatus = document.getElementById("loadingStatus");
		const loadingContent = document.getElementById("loadingContent");
		const loadingBar = document.getElementById("loadingBar");
		
		loadingStatus.className = "";
		loadingBar.style.width = "0%";
		loadingStatus.style.display = "block";
		loadingContent.innerHTML = "Loading...<br>";
		
		const reader = new FileReader();
		
		reader.addEventListener("progress", function(e){
			let progress = ~~((e.loaded/e.total)*60);
			
			loadingBar.style.width = progress+"%";
		});
		
		let readFile = new Promise((resolve, reject) => {
			reader.onload = function(){
			
				loadingContent.innerHTML += "<br>File uploaded, processing...";
				loadingBar.style.width = "60%";
				let result = reader.result;
				
				resolve(result);
			};
		});
		
		reader.readAsArrayBuffer(file);
		
		let loadedFile = await readFile;
		
		await processFile(loadedFile);
		
		return {
			originalJson: originalJson,
			json: glb
		};
		
	}

	async function processFile(file){
		console.log(file);
		let view = new DataView(file);
		const decoder = new TextDecoder();
		let json = {};
		
		const magic = file.slice(0, 4);
		console.log("Magic bytes: " + decoder.decode(magic));
		console.log("Version: " + view.getUint32(1*4, true));
		console.log("File length: " + view.getUint32(2*4, true));
		
		let jsonText = "";
		
		let binaryBuffers = [];
		
		let i = 3*4;
		while(i < view.byteLength){
			let chunkLength = view.getUint32(i, true);
			let chunkType = decoder.decode(file.slice(i+4, i+8));
			console.log("chunkData length: " + chunkLength);
			console.log("Chunk type: " + chunkType);
			
			if(chunkType.toLowerCase() == "json"){
				jsonText = decoder.decode(file.slice(i+8, i+8+chunkLength));
			} else {
				binaryBuffers.push(file.slice(i+8, i+8+chunkLength));
			}
			
			i += 8+chunkLength;
		}
		
		if(jsonText){
			originalJson = JSON.parse(jsonText);
			glb = JSON.parse(jsonText);
			console.log(glb);
		} else {
			console.error("aint no json text; aborting");
			return;
		}
		
		for(let b in binaryBuffers){
			glb.buffers[b].bufferData = binaryBuffers[b];
		}
		
		processBufferViews();
		await processImages();
		processMaterials();
		processMeshes();
		processScenes();
		
		setTimeout(function(){
			loadingStatus.className = "fading";
			setTimeout(function(){
				loadingStatus.style.display = "none";
			}, 500);
		}, 100);
		
		return;
	}

	function processScenes(){
		for(let i in glb.scenes){
			glb.scenes[i] = {
				nodes: processNodes(glb.scenes[i].nodes)
			};
		}
		
		if(glb.scene === undefined){
			glb.scene = 0;
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

	function processBufferViews(){
		for(let i in glb.bufferViews){
			let bv = glb.bufferViews[i];
			bv.view = new DataView(glb.buffers[bv.buffer].bufferData, bv.byteOffset, bv.byteLength);
		}
	}

	async function processImages(){
		
		let promises = [];
		
		if(glb.images){
			for(let i in glb.images){
				let img = glb.images[i];
				let imageData = new Blob([glb.bufferViews[img.bufferView].view], {type: img.mimeType});
				let imageUrl = URL.createObjectURL(imageData);
				let imgEl = new Image;
				imagesContainer.appendChild(imgEl);
				
				promises.push(new Promise((resolve, reject) => {
					imgEl.onload = function(){
						resolve();
					};
				}));
				
				imgEl.src = imageUrl;
				img.image = imgEl;
				
				//images[i] = imgEl;
			}
		} else {
			
		}
		
		return Promise.allSettled(promises);
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
				
				//materials[m] = material;
				glb.materials[m] = material;
				
				//gl.addMaterial(material);
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
				
				mesh.processedPrimitives = primitives;
			}
		}
	}
	
	return {
		loadFile: loadFile
	};
	
}