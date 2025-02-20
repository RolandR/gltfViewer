
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
	// not implemented here: byteStride
	for(let i in glb.bufferViews){
		let bv = glb.bufferViews[i];
		bv.view = new DataView(glb.buffers[bv.buffer].bufferData, bv.byteOffset, bv.byteLength);
	}
}

function processImages(){
	for(var img of glb.images){
		let imageData = new Blob([glb.bufferViews[img.bufferView].view], {type: img.mimeType});
		let imageUrl = URL.createObjectURL(imageData);
		let imgEl = new Image;
		imagesContainer.appendChild(imgEl);
		imgEl.src = imageUrl;
		img.image = imgEl;
	}
}