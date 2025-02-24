
const fileInput = document.getElementById("fileUpload");
const scaleInput = document.getElementById("scaleInput");
const offsetYInput = document.getElementById("offsetYInput");
const imagesContainer = document.getElementById("imagesContainer");

const canvasContainer = document.getElementById("canvasContainer");
const canvas = document.getElementById("renderCanvas");
const context = canvas.getContext("2d");
const size = Math.min(canvasContainer.clientWidth, canvasContainer.clientHeight);
canvas.width = size;
canvas.height = size;
context.strokeStyle = "#0f0";
context.fillStyle = "#fff";

let glb = {};
let buffers = [];
let scenes = [];
let nodes = [];

let angle = 0;
let scale = 0.5;
let offsetY = 0;

scaleInput.oninput = function(e){
	scale = parseFloat(scaleInput.value);
}

offsetYInput.oninput = function(e){
	offsetY = parseFloat(offsetYInput.value);
	console.log(offsetY);
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
	processMeshes();
	processScenes();
	//displayMeshes();
	
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
	console.log(scenes);
}

function processNodes(nodes){
	let outNodes = [];
	for(let n in nodes){
		let node = {};
		node.name = glb.nodes[nodes[n]].name;
		node.mesh = glb.nodes[nodes[n]].mesh;
		node.rotation = glb.nodes[nodes[n]].rotation;
		node.scale = glb.nodes[nodes[n]].scale;
		node.translation = glb.nodes[nodes[n]].translation;
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
		for(let img of glb.images){
			let imageData = new Blob([glb.bufferViews[img.bufferView].view], {type: img.mimeType});
			let imageUrl = URL.createObjectURL(imageData);
			let imgEl = new Image;
			imagesContainer.appendChild(imgEl);
			imgEl.src = imageUrl;
			img.image = imgEl;
		}
	}
}

function processMeshes(){
	if(glb.meshes){
		for(let mesh of glb.meshes){
			for(let p in mesh.primitives){
				let indexAccessor = glb.accessors[mesh.primitives[p].indices];
				let positionAccessor = glb.accessors[mesh.primitives[p].attributes.POSITION];
				
				console.log(indexAccessor);
				console.log(positionAccessor);
				console.log("-------");
				//console.log(positionAccessor);
				if(indexAccessor.componentType == 5123 && indexAccessor.type.toUpperCase() == "SCALAR"){
					let indexBufferView = glb.bufferViews[indexAccessor.bufferView];
					let indexView = indexBufferView.view;
					let indexByteStride = 2; // 2 bytes for Uint16
					if(indexBufferView.byteStride){
						indexByteStride = indexBufferView.byteStride;
					}
					
					let positionBufferView = glb.bufferViews[positionAccessor.bufferView];
					let positionView = positionBufferView.view;
					let positionByteStride = 4*3; // 4 bytes for float32, *3 for VEC3
					if(positionBufferView.byteStride){
						positionByteStride = positionBufferView.byteStride;
					}
					
					let count = indexAccessor.count;
					
					let positions = [];
					
					for(let i = 0; i < count; i++){
						positions.push([]);
						let index = indexView.getUint16(i*indexByteStride, true);
						for(let c = 0; c < 3; c++){
							positions[i][c] = positionView.getFloat32(index*positionByteStride+c*4, true);
						}
					}
					
					mesh.primitives[p].positions = positions;
					
					//console.log(positions);
					
				} else {
					console.log("Accessor type not implemented yet: "+indexAccessor.type +", "+indexAccessor.componentType);
				}
			}
		}
	}
}

function displayMeshes(){
	context.clearRect(0, 0, canvas.width, canvas.height);
	if(glb.meshes){
		for(let m in glb.meshes){
			let mesh = glb.meshes[m];
			for(let p in mesh.primitives){
				
				let r = ((m+3)*57)%200 + 56;
				let g = ((m+2)*185)%200 + 56;
				let b = ((m+6)*107)%200 + 56;
				let color = "rgb("+r+", "+g+", "+b+")";
				context.strokeStyle = color;
				
				let positions = mesh.primitives[p].positions;
				if(positions){
					for(let i = 0; i < positions.length; i += 3){
						if(!positions[i+3]){
							break;
						}
						let triangle = [];
						for(let v = 0; v < 3; v++){
							let x = positions[i+v][0];
							let y = positions[i+v][1];
							let z = positions[i+v][2];
							
							y = y*-1 + offsetY;
							
							x = x * Math.cos(angle) - z * Math.sin(angle);
							
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
	}
	
	angle += 0.01;
	requestAnimationFrame(displayMeshes);
}