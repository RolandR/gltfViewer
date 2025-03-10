

function GlbParser(pMon){
	
	let originalJson = {};
	let glb = {};
	
	const imagesContainer = document.getElementById("imagesContainer");
	
	let nodesProcessed = 0;
	
	let globalMax = [];
	let globalMin = [];
	
	async function loadFile(file){
		
		const reader = new FileReader();
		
		await pMon.start();
		await pMon.postMessage("Loading file from disk...");
		
		reader.addEventListener("progress", function(e){
			let progress = e.loaded/e.total;
			pMon.updateProgress(progress);
		});
		
		let readFile = new Promise((resolve, reject) => {
			reader.onload = function(){
				resolve(reader.result);
			};
		});
		
		reader.readAsArrayBuffer(file);
		
		let loadedFile = await readFile;
		
		await pMon.updateProgress(1);
		await pMon.finishItem();
		await pMon.postMessage("Processing file...");
		
		await processFile(file, loadedFile);
		
		return {
			originalJson: originalJson,
			json: glb
		};
		
	}

	async function processFile(file, fileData){
		
		await pMon.postMessage("Decoding...");
		
		console.log(file);
		let view = new DataView(fileData);
		const decoder = new TextDecoder();
		let json = {};
		
		const magic = fileData.slice(0, 4);
		console.log("Magic bytes: " + decoder.decode(magic));
		console.log("Version: " + view.getUint32(1*4, true));
		console.log("File length: " + view.getUint32(2*4, true));
		
		let jsonText = "";
		
		let binaryBuffers = [];
		
		let i = 3*4;
		while(i < view.byteLength){
			let chunkLength = view.getUint32(i, true);
			let chunkType = decoder.decode(fileData.slice(i+4, i+8));
			console.log("chunkData length: " + chunkLength);
			console.log("Chunk type: " + chunkType);
			
			if(chunkType.toLowerCase() == "json"){
				jsonText = decoder.decode(fileData.slice(i+8, i+8+chunkLength));
			} else {
				binaryBuffers.push(fileData.slice(i+8, i+8+chunkLength));
			}
			
			i += 8+chunkLength;
		}
		
		if(jsonText){
			originalJson = JSON.parse(jsonText);
			glb = JSON.parse(jsonText);
			
			console.log("Original JSON:");
			console.log(originalJson);
			console.log("Processed JSON:");
			console.log(glb);
			
		} else {
			console.error("aint no json text; aborting");
			await pMon.postMessage("Error: No JSON text found", "error");
			return;
		}
		
		glb.info = {};
		glb.info.fileName = file.name;
		glb.info.fileSize = file.size;
		
		const k = 1024;
		const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
		const decimal = 2;
		const n = Math.floor(Math.log(file.size) / Math.log(k));
		const fileSize = parseFloat((file.size / Math.pow(k, n)).toFixed(decimal))+" "+sizes[n];
		
		glb.info.fileSizeHumanReadable = fileSize;
		
		glb.info.globalMax = globalMax;
		glb.info.globalMin = globalMin;
		
		
		for(let b in binaryBuffers){
			glb.buffers[b].bufferData = binaryBuffers[b];
		}
		
		await pMon.postMessage("Processing bufferViews...");
		processBufferViews();
		
		await processImages();
		processTextures();
		
		await pMon.finishItem();
		await pMon.postMessage("Processing materials...");
		processMaterials();
		
		await processMeshes();
		
		await pMon.finishItem();
		
		await processScenes();
		
		await pMon.postMessage("Done!", "success");
		await pMon.finish(0, 500);
		
		return;
	}

	async function processScenes(){
		
		await pMon.postMessage("Processing scene nodes...", "info", glb.nodes.length);
		
		let identityMatrix = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		];
		
		for(let i in glb.scenes){
			glb.scenes[i] = {
				nodes: await processNodes(glb.scenes[i].nodes, identityMatrix)
			};
		}
		
		if(glb.scene === undefined){
			glb.scene = 0;
		}
		
	}

	async function processNodes(nodes, parentTransform){
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
			
			node.matrix = multiplyMatrices(parentTransform, node.matrix);
			
			nodesProcessed++;
			await pMon.updateCount(nodesProcessed);
			
			node.children = await processNodes(glb.nodes[nodes[n]].children, node.matrix);
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
			await pMon.postMessage("Processing images...", "info", glb.images.length);
			
			for(let i in glb.images){
				i = parseInt(i);
				
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
				
				await pMon.updateCount(i+1);
			}
		} else {
			await pMon.postMessage("This file contains no images.");
		}
		
		return Promise.allSettled(promises);
	}
	
	function processTextures(){
		if(glb.textures === undefined){
			glb.textures = [];
		}
		if(glb.samplers === undefined){
			glb.samplers = [{
				magFilter: 9729,
				minFilter: 9987,
				wrapS: 10497,
				wrapT: 10497
			}];
		}
		
		for(let s in glb.samplers){
			if(glb.samplers[s].magFilter === undefined){
				glb.samplers[s].magFilter = 9729;
			}
			if(glb.samplers[s].minFilter === undefined){
				glb.samplers[s].minFilter = 9987;
			}
			if(glb.samplers[s].wrapS === undefined){
				glb.samplers[s].wrapS = 10497;
			}
			if(glb.samplers[s].wrapT === undefined){
				glb.samplers[s].wrapT = 10497;
			}
		}
		
		for(let t in glb.textures){
			let tex = glb.textures[t];
			
			tex.id = t;
			tex.samp = glb.samplers[tex.sampler];
			tex.img = glb.images[tex.source].image;
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
						/*baseColorTexture: {
							index: 0,
							texCoord: 0
						},*/
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
					if(mat.pbrMetallicRoughness.baseColorTexture !== undefined){
						material.pbrMetallicRoughness.baseColorTexture = mat.pbrMetallicRoughness.baseColorTexture;
						if(mat.pbrMetallicRoughness.baseColorTexture.index){
							material.pbrMetallicRoughness.baseColorTexture.index = mat.pbrMetallicRoughness.baseColorTexture.index;
						}
						if(mat.pbrMetallicRoughness.baseColorTexture.texCoord){
							material.pbrMetallicRoughness.baseColorTexture.texCoord = mat.pbrMetallicRoughness.baseColorTexture.texCoord;
						}
						glb.textures[material.pbrMetallicRoughness.baseColorTexture.index].type = "colors";
					} else {
						
						let colors = [0, 255, 0, 255];
						if(mat.pbrMetallicRoughness.baseColorFactor){
							colors = mat.pbrMetallicRoughness.baseColorFactor.map((i) => i*255);
						}
						
						glb.textures.push({
							isFakeTexture: true,
							img: new Uint8Array(colors),
							sampler: 0,
							samp: glb.samplers[0],
							type: "colors"
						});
						
						let texId = glb.textures.length-1;
						glb.textures[texId].id = texId;
						
						material.pbrMetallicRoughness.baseColorTexture = {
							index: texId,
							texCoord: 0
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
				if(mat.normalTexture !== undefined){
					material.normalTexture = mat.normalTexture;
					if(mat.normalTexture.index !== undefined){
						material.normalTexture.index = mat.normalTexture.index;
					}
					if(mat.normalTexture.texCoord !== undefined){
						material.normalTexture.texCoord = mat.normalTexture.texCoord;
					}
					glb.textures[material.normalTexture.index].type = "normal";
				} else {
					
					let flatNormals = [128, 128, 255];
					
					glb.textures.push({
						isFakeTexture: true,
						img: new Uint8Array(flatNormals),
						sampler: 0,
						samp: glb.samplers[0],
						type: "normal"
					});
					
					let texId = glb.textures.length-1;
					glb.textures[texId].id = texId;
					
					material.normalTexture = {
						index: texId,
						texCoord: 0
					}
				}
				
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

	async function processMeshes(){
		if(glb.meshes){
			await pMon.postMessage("Processing meshes...", "info", glb.meshes.length);
			
			for(let m in glb.meshes){
				m = parseInt(m);
				
				let mesh = glb.meshes[m];
				let primitives = [];
				
				for(let p in mesh.primitives){
					
					let indexAccessor = glb.accessors[mesh.primitives[p].indices];
					let indexBufferView = glb.bufferViews[indexAccessor.bufferView];
					
					let indexView;
					
					// read indices according to their component type, but always store them internally as Uint32
					if(gltfEnums.dataTypes[indexAccessor.componentType] == "UNSIGNED_SHORT"){
						indexView = new Uint32Array(indexBufferView.byteLength*2);
						for(let i = 0; i < indexBufferView.byteLength/2; i++){
							indexView[i] = indexBufferView.view.getUint16(i*2, true);
						}
					} else if(gltfEnums.dataTypes[indexAccessor.componentType] == "UNSIGNED_INT"){
						indexView = new Uint32Array(indexBufferView.byteLength);
						for(let i = 0; i < indexBufferView.byteLength/4; i++){
							indexView[i] = indexBufferView.view.getUint32(i*4, true);
						}
					} else {
						console.error("Unsupported component type for indices: "+gltfEnums.dataTypes[indexAccessor.componentType]);
					}
					
					let indexComponentType = 5125; // UNSIGNED_INT
					
					let indexByteStride = 4; // 4 bytes for Uint32
					if(indexBufferView.byteStride){
						indexByteStride = indexBufferView.byteStride;
					}
						
					let positionAccessor = glb.accessors[mesh.primitives[p].attributes.POSITION];
					
					//console.log(positionAccessor.max);
					
					if(globalMax[0] === undefined){
						globalMax[0] = positionAccessor.max[0];
						globalMax[1] = positionAccessor.max[1];
						globalMax[2] = positionAccessor.max[2];
						
						globalMin[0] = positionAccessor.min[0];
						globalMin[1] = positionAccessor.min[1];
						globalMin[2] = positionAccessor.min[2];
					} else {
						globalMax[0] = Math.max(globalMax[0], positionAccessor.max[0]);
						globalMax[1] = Math.max(globalMax[1], positionAccessor.max[1]);
						globalMax[2] = Math.max(globalMax[2], positionAccessor.max[2]);
						
						globalMin[0] = Math.min(globalMin[0], positionAccessor.min[0]);
						globalMin[1] = Math.min(globalMin[1], positionAccessor.min[1]);
						globalMin[2] = Math.min(globalMin[2], positionAccessor.min[2]);
					}
					
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
						indexComponentType: indexComponentType,
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
				
				await pMon.updateCount(m+1);
			}
		} else {
			await pMon.postMessage("This file contains no meshes!", "warn");
		}
		
		console.log(globalMax);
		console.log(globalMin);
		
		return;
	}
	
	return {
		loadFile: loadFile
	};
	
}