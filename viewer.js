
const fileInput = document.getElementById("fileUpload");
const imagesContainer = document.getElementById("imagesContainer");

let glb = {};
let buffers = [];

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
	displayMeshes();
	
	setTimeout(function(){
		loadingStatus.className = "fading";
		setTimeout(function(){
			loadingStatus.style.display = "none";
		}, 500);
	}, 100);
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
				let positionAccessor = glb.accessors[mesh.primitives[p].attributes.POSITION];
				//console.log(positionAccessor);
				if(positionAccessor.componentType == 5126 && positionAccessor.type.toUpperCase() == "VEC3"){
					let bufferView = glb.bufferViews[positionAccessor.bufferView];
					let view = bufferView.view;
					let byteStride = 4; // 4 bytes for float32
					if(bufferView.byteStride){
						byteStride = bufferView.byteStride;
					}
					let count = positionAccessor.count;
					
					let positions = [];
					
					for(let i = 0; i < count; i++){
						positions.push([]);
						for(let c = 0; c < 3; c++){
							positions[i][c] = view.getFloat32(i*byteStride+c*4, true);
						}
					}
					
					mesh.primitives[p].positions = positions;
					
					//console.log(positions);
					
				} else {
					console.log("Accessor type not implemented yet: "+positionAccessor.type +", "+positionAccessor.componentType);
				}
			}
		}
	}
}

function displayMeshes(){
	const canvasContainer = document.getElementById("canvasContainer");
	const canvas = document.getElementById("renderCanvas");
	const context = canvas.getContext("2d");
	canvas.width = canvasContainer.clientWidth;
	//canvas.height = canvasContainer.clientHeight;
	canvas.height = canvas.width;
	context.strokeStyle = "#fff";
	
	if(glb.meshes){
		for(let mesh of glb.meshes){
			for(let p in mesh.primitives){
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
							
							x = (x + 1.5)/3*canvas.width;
							y = (y + 1.5)/3*canvas.height;
							
							triangle[v] = [x, y];
						}
						context.moveTo(triangle[0][0], triangle[0][1]);
						context.lineTo(triangle[1][0], triangle[1][1]);
						context.lineTo(triangle[2][0], triangle[2][1]);
						context.closePath();
						context.stroke();
						console.log(triangle);
					}
				}
			}
		}
	}
}