

function GlbTools(options){
	
	let pMon = options.progressMonitor;
	
	let flattenedNodesCount = 0;
	
	async function process(toProcess){
		let glb = toProcess.json;
		let originalJson = toProcess.originalJson;
		
		fixMaterials(glb);
		
		applyStoreyToScenes(glb);
		
		await pMon.postMessage("Flattening nodes...", "info", glb.nodes.length);
		
		let flatMeshes = await flattenMeshes(glb);
		
		await pMon.finishItem();
		await pMon.postMessage("Combining meshes...", "info", glb.meshes.length);
		
		let combinedMeshes = await combineMeshes(glb, flatMeshes);
		
		await pMon.finishItem();
		await pMon.postMessage("Building new file...");
		
		let fileUrl = await buildNewFile(
			glb,
			originalJson,
			combinedMeshes.flatMeshes,
			combinedMeshes.newScene,
			combinedMeshes.newNodes
		);
		
		await pMon.postMessage("Done!", "success");
		//await pMon.finish(0, 500);
		
		return fileUrl;
		
	}
	
	function fixMaterials(glb){
		for(let i in glb.materials){
			let material = glb.materials[i];
			
			switch(material.name){
				case "Glas Normalglas":
					material.pbrMetallicRoughness.baseColorFactor = [0.2, 0.2, 0.2, 0.5];
					material.pbrMetallicRoughness.metallicFactor = 0.9;
					material.pbrMetallicRoughness.roughnessFactor = 0.02;
				break;
				case "Glas Riffelglas":
					material.pbrMetallicRoughness.baseColorFactor = [0.5, 0.5, 0.5, 0.5];
					material.pbrMetallicRoughness.metallicFactor = 0.9;
					material.pbrMetallicRoughness.roughnessFactor = 0.1;
				break;
				case "Glas Milchglas":
					material.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 0.5];
					material.pbrMetallicRoughness.metallicFactor = 0.9;
					material.pbrMetallicRoughness.roughnessFactor = 0.1;
				break;
				case "Metall Chrom":
					material.pbrMetallicRoughness.metallicFactor = 0.9;
					material.pbrMetallicRoughness.roughnessFactor = 0.02;
				break;
				case "Metall Aluminium, matt":
					material.pbrMetallicRoughness.metallicFactor = 0.7;
					material.pbrMetallicRoughness.roughnessFactor = 0.9;
				break;
				case "Metall Stahl matt":
					material.pbrMetallicRoughness.metallicFactor = 0.7;
					material.pbrMetallicRoughness.roughnessFactor = 0.9;
				break;
				case "Linoleum, beige":
					material.pbrMetallicRoughness.metallicFactor = 0.1;
					material.pbrMetallicRoughness.roughnessFactor = 0.3;
				break;
				case "Metall Stahl, verzinkt":
					material.pbrMetallicRoughness.metallicFactor = 0.6;
					material.pbrMetallicRoughness.roughnessFactor = 0.8;
				break;
				default:
					material.pbrMetallicRoughness.metallicFactor = 0.1;
					material.pbrMetallicRoughness.roughnessFactor = 0.9;
					console.log("default");
				break;
			}
			
			console.log(material);
		}
	}

	async function combineMeshes(glb, flatMeshes){
		
		let newMeshes = [];
		let newNodes = [];
		
		let storeys = [
			//"NoStorey",
			"U1.UG",
			"01.OG",
			"02.OG",
			"03.OG",
			"04.OG",
			"00.EG",
			"05.OG",
			"06.DA"
		];
		
		let newScene = {
			name: glb.scenes[0].name,
			nodes: []
		};
		
		for(let s in storeys){
			newNodes[s] = {
				name: storeys[s],
				children: []
			}
			newScene.nodes.push(parseInt(s));
		}
		
		let processedMeshesCount = 0;
		
		for(let s in storeys){
			let storeyMeshes = getMeshesByStorey(flatMeshes, storeys[s]);
			
			let ifcClasses = getIfcClasses(storeyMeshes);
			
			for(let i in ifcClasses){
				let classMeshes = getMeshesByIfcClass(storeyMeshes, ifcClasses[i]);
				
				let classNode = {
					name: storeys[s]+"/"+ifcClasses[i],
					children: []
				};
				
				newNodes.push(classNode);
				newNodes[s].children.push(newNodes.length-1);
				
				for(let mat in glb.materials){
					let materialMeshes = getMeshesByMaterial(classMeshes, mat);
					if(materialMeshes.length > 0){
						
						processedMeshesCount += materialMeshes.length;
						
						let materialName = glb.materials[mat].name;
						let meshName = storeys[s]+"/"+ifcClasses[i]+"/"+materialName;
						
						let combinedMesh = mergeMeshes(materialMeshes, meshName);
						combinedMesh.primitives[0].material = mat;
						newMeshes.push(combinedMesh);
						
						newNodes.push({
							name: meshName,
							mesh: newMeshes.length-1
						});
						classNode.children.push(newNodes.length-1);
						
						await pMon.updateCount(processedMeshesCount);
					}
				}
			}
		}
		
		return {
			flatMeshes: newMeshes,
			newScene: newScene,
			newNodes: newNodes
		};
	}

	async function buildNewFile(glb, originalJson, flatMeshes, newScene, newNodes){
		
		
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
		
		json.scenes[0] = newScene;
		json.nodes = newNodes;
		
		let pointer = -1;
		
		await pMon.postMessage("Preparing buffers...", "info", flatMeshes.length);
		
		for(let i in flatMeshes){
			
			/*json.nodes.push({
				name: flatMeshes[i].nodeName,
				mesh: i*1
			});
			json.scenes[0].nodes.push(json.nodes.length-1); // TODO: use actual node structure*/
			
			
			let mesh = flatMeshes[i];
			
			let outMesh = {
				name: mesh.name,
				primitives: []
			};
			
			for(let p in mesh.primitives){
				
				outMesh.primitives[p] = {
					attributes: {}
				};
				let buf;
				
				/*======== indices ========*/
				buf = mesh.primitives[p].indices;
				bufferViews.push(buf);
				pointer++;
				
				json.bufferViews.push({
					buffer: 0,
					byteLength: buf.byteLength,
					byteOffset: offset,
					target: 34963 // indices (ELEMENT_ARRAY_BUFFER)
				});
				offset += buf.byteLength;
				if(offset%4 !== 0){
					// the gltf standard wants every bufferView offset to be a multiple of 4 bytes.
					// let's add empty bytes between bufferViews to comply with that.
					bufferViews.push(new Uint8Array(4-offset%4));
					offset += 4-offset%4;
				}
				
				json.accessors.push({
					bufferView: pointer,
					byteOffset: 0,
					type: "SCALAR",
					componentType: 5125, // 5125 = Uint32
					count: mesh.primitives[p].indices.length
				});
				outMesh.primitives[p].indices = pointer;
				
				/*======== positions ========*/
				buf = mesh.primitives[p].positions;
				bufferViews.push(buf);
				pointer++;
				
				json.bufferViews.push({
					buffer: 0,
					byteLength: buf.byteLength,
					byteOffset: offset,
					target: 34962 // positions (ARRAY_BUFFER)
				});
				offset += buf.byteLength;
				if(offset%4 !== 0){
					// the gltf standard wants every bufferView offset to be a multiple of 4 bytes.
					// let's add empty bytes between bufferViews to comply with that.
					bufferViews.push(new Uint8Array(4-offset%4));
					offset += 4-offset%4;
				}
				
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
				buf = mesh.primitives[p].normals;
				bufferViews.push(buf);
				pointer++;
				
				json.bufferViews.push({
					buffer: 0,
					byteLength: buf.byteLength,
					byteOffset: offset,
					target: 34962 // positions (ARRAY_BUFFER)
				});
				offset += buf.byteLength;
				if(offset%4 !== 0){
					// the gltf standard wants every bufferView offset to be a multiple of 4 bytes.
					// let's add empty bytes between bufferViews to comply with that.
					bufferViews.push(new Uint8Array(4-offset%4));
					offset += 4-offset%4;
				}
				
				json.accessors.push({
					bufferView: pointer,
					byteOffset: 0,
					type: "VEC3",
					componentType: 5126,
					count: mesh.primitives[p].normals.length/3
				});
				outMesh.primitives[p].attributes.NORMAL = pointer;
				
				/*======== texCoords ========*/
				if(mesh.primitives[p].texCoords){
					buf = mesh.primitives[p].texCoords;
					bufferViews.push(buf);
					pointer++;
					
					json.bufferViews.push({
						buffer: 0,
						byteLength: buf.byteLength,
						byteOffset: offset,
						target: 34962 // positions (ARRAY_BUFFER)
					});
					offset += buf.byteLength;
					if(offset%4 !== 0){
						// the gltf standard wants every bufferView offset to be a multiple of 4 bytes.
						// let's add empty bytes between bufferViews to comply with that.
						bufferViews.push(new Uint8Array(4-offset%4));
						offset += 4-offset%4;
					}
					
					json.accessors.push({
						bufferView: pointer,
						byteOffset: 0,
						type: "VEC2",
						componentType: 5126,
						count: mesh.primitives[p].texCoords.length/2
					});
					outMesh.primitives[p].attributes.TEXCOORD_0 = pointer;
				}
				
				outMesh.primitives[p].material = parseInt(mesh.primitives[p].material);
			}
			
			json.meshes.push(outMesh);
			
			await pMon.updateCount(i+1);
		}
		
		await pMon.postMessage("Encoding JSON data...");
		
		let bufferLength = offset;
		
		json.buffers[0] = {
			byteLength: bufferLength
		};
		
		json.materials = glb.materials;
		
		/*======== create buffer ========*/
		
		//console.log(json);
		
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
		
		await pMon.postMessage("Creating file blob...");
		
		let fileBlob = new Blob([
			fileHeader,
			jsonHeader,
			encodedText,
			bufferHeader,
			...bufferViews
		], {type: "model/glb"});
		
		await pMon.postMessage("Done!", "success");
		await pMon.finish(0, 500);
		
		return(URL.createObjectURL(fileBlob));
		
	}

	function applyStoreyToScenes(glb){
		for(let i in glb.scenes){
			applyStoreyToNodes(glb.scenes[i].nodes, "NoStorey");
		}
	}

	function applyStoreyToNodes(nodes, storey){
		for(let n in nodes){
			let node = nodes[n];
			if(node.name.substring(0, 17) == "IfcBuildingStorey"){
				storey = node.name.substring(18);
			}
			
			node.storey = storey;
			
			applyStoreyToNodes(nodes[n].children, storey);
		}
	}

	async function flattenMeshes(glb){
		let flatMeshes = [];
		
		for(let s in glb.scenes){
			for(let n in glb.scenes[s].nodes){
				await flattenNodes(glb, glb.scenes[s].nodes[n], flatMeshes);
			}
		}
		
		return flatMeshes;
	}

	async function flattenNodes(glb, node, flatMeshes){
		// apply all transforms and split meshes into new meshes for each primitive
		
		if(node.mesh !== undefined){
			let mesh = glb.meshes[node.mesh];
			let modelMatrix = node.matrix;
			for(let p in mesh.processedPrimitives){
				
				let flatMesh = {};
				//flatMesh.id = node.mesh;
				flatMesh.nodeName = node.name+"/"+p;
				flatMesh.name = mesh.name+"/"+p;
				flatMesh.storey = node.storey;
				
				flatMesh.primitives = [];
			
				let primitive = {};
				primitive.indices = mesh.processedPrimitives[p].indexView;
				
				primitive.positions = transformPositions(mesh.processedPrimitives[p].positionView, modelMatrix, false);
				primitive.normals = transformPositions(mesh.processedPrimitives[p].normalView, modelMatrix, true);
				primitive.texCoords = mesh.processedPrimitives[p].texCoordView;
				
				primitive.material = mesh.processedPrimitives[p].material;
				
				flatMesh.primitives.push(primitive);
				
				flatMeshes.push(flatMesh);
				
			}
		}
		
		flattenedNodesCount++;
		await pMon.updateCount(flattenedNodesCount);
		
		for(let c in node.children){
			await flattenNodes(glb, node.children[c], flatMeshes);
		}
		
		return;
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
			
			let result = multiplyMatrixByVector(matrix, vec);
			
			if(isNormal){
				result = normalizeVec4([result[0], result[1], result[2], 0.0]);
			}
			
			out[i  ] = result[0];
			out[i+1] = result[1];
			out[i+2] = result[2];
			
			if(!isNormal && result[3] != 1.0){
				console.warn("vec4.w should be 1.0, but is "+result[3]);
			}
		}
		
		return out;
	}

	function getMeshesByMaterial(meshes, materialId){
		// Note: This only works properly if meshes have been split by primitives.
		return meshes.filter(function(mesh){return mesh.primitives[0].material == materialId});
	}

	function getMeshesByStorey(meshes, storey){
		// Note: This only works properly if meshes have been flattened and all that stuff.
		return meshes.filter(function(mesh){return mesh.storey == storey});
	}

	function mergeMeshes(meshes, name){
		// Note: This has to be done after meshes have been split by primitives.
		
		let newMesh = {};
		//newMesh.name = meshes[0].name+".MERGED";
		//newMesh.nodeName = meshes[0].nodeName+".MERGED";
		
		newMesh.name = name;
		newMesh.nodeName = name;
		
		let totalSizes = {
			indices: 0,
			positions: 0,
			normals: 0,
			texCoords: 0
		}
		
		totalSizes = meshes.reduce(
			function(accumulator, currentValue){
				accumulator.indices += currentValue.primitives[0].indices.length;
				accumulator.positions += currentValue.primitives[0].positions.length;
				accumulator.normals += currentValue.primitives[0].normals.length;
				if(currentValue.primitives[0].texCoords){
					accumulator.texCoords += currentValue.primitives[0].texCoords.length;
				}
				
				return accumulator;
			},
			totalSizes
		);
		
		newMesh.primitives = [{
			indices: new Uint32Array(totalSizes.indices),
			positions: new Float32Array(totalSizes.positions),
			normals: new Float32Array(totalSizes.normals),
			texCoords: null // TODO: later maybe
		}];
		
		let indexOffset = 0;
		let positionOffset = 0;
		
		for(let m in meshes){
		
			newMesh.primitives[0].indices.set(
				meshes[m].primitives[0].indices.map(
					(num) => num+(positionOffset/3)
				),
				indexOffset
			);
			
			newMesh.primitives[0].positions.set(
				meshes[m].primitives[0].positions,
				positionOffset
			);
			
			newMesh.primitives[0].normals.set(
				meshes[m].primitives[0].normals,
				positionOffset
			);
			
			indexOffset += meshes[m].primitives[0].indices.length;
			positionOffset += meshes[m].primitives[0].positions.length;
			
		}
		
		return newMesh;
		
	}

	function getBiggestMeshes(glb){
		let meshSizes = [];
		for(let i in glb.meshes){
			let mesh = glb.meshes[i];
			let primitiveSizes = [];
			let totalSize = 0;
			for(let p in mesh.processedPrimitives){
				primitiveSizes.push(mesh.processedPrimitives[p].indexView.length/3);
				totalSize += mesh.processedPrimitives[p].indexView.length/3;
			}
			let maxSize = Math.max(...primitiveSizes);
			meshSizes.push({
				nodeName: mesh.nodeName,
				maxSize: maxSize,
				totalSize: totalSize,
				primitiveSizes: primitiveSizes
			});
		}
		
		meshSizes.sort(function(a, b){
			if(a.totalSize > b.totalSize){
				return -1;
			} else if(a.totalSize < b.totalSize){
				return 1;
			} else {
				return 0;
			}
		});
		
		/*
		console.log(count+" biggest meshes by total triangle count:");
		
		for(let i = 0; i < count; i++){
			let outString = (i+1)+".) "+meshSizes[i].totalSize+": "+meshSizes[i].nodeName+"";
			if(meshSizes[i].primitiveSizes.length > 1){
				outString += " (";
				for(let p in meshSizes[i].primitiveSizes){
					if(p != 0){
						outString += ", ";
					}
					outString += meshSizes[i].primitiveSizes[p];
				}
				outString += ")";
			}
			console.log(outString);
		}
		*/
		
		return meshSizes;
	}

	function listNumberedNodes(){
		const regex = /^.*\.\d{3}$/;
		let list = [];
		
	}
	
	function getIfcClasses(meshes){
		let types = {};
		
		for(let i in meshes){
			let slashIndex = meshes[i].nodeName.indexOf("/");
			if(slashIndex !== -1){
				let ifcClass = meshes[i].nodeName.substring(0, slashIndex);
				types[ifcClass] = 1;
			}
		}
		
		return Object.keys(types);
	}
	
	function getMeshesByIfcClass(meshes, ifcClassToMatch){
		let outMeshes = [];
		
		for(let i in meshes){
			let slashIndex = meshes[i].nodeName.indexOf("/");
			if(slashIndex !== -1){
				let ifcClass = meshes[i].nodeName.substring(0, slashIndex);
				if(ifcClass == ifcClassToMatch){
					outMeshes.push(meshes[i]);
				}
			}
		}
		
		return outMeshes;
	}
	
	return {
		process: process,
		getBiggestMeshes: getBiggestMeshes
	};
	
}