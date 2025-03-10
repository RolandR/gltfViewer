
main();

function main(){

	const canvasContainer = document.getElementById("canvasContainer");
	const fileInput = document.getElementById("fileUpload");
	const fileInputLabel = document.getElementById("fileUploadButton");
	
	const informationEl = document.getElementById("fileInformation");
	
	const toolsContainer = document.getElementById("toolsContainer");
	const processButton = document.getElementById("processFileButton");
	const enableRenderingButton = document.getElementById("enableRenderingButton");
	
	const viewerPMon = new ProgressMonitor(canvasContainer, {
		itemsCount: 1,
		title: "Preparing renderer..."
	});
	const viewer = new Viewer(canvasContainer, {showFrameCounter: true, progressMonitor: viewerPMon});
	
	const toolsPMon = new ProgressMonitor(document.body, {
		itemsCount: 3,
		title: "Processing..."
	});
	const tools = new GlbTools({progressMonitor: toolsPMon});

	const pMon = new ProgressMonitor(document.body, {
		itemsCount: 5,
		title: "Loading .glb file..."
	});
	const parser = new GlbParser(pMon);
	
	let glb;

	fileInput.onchange = function(e){
		e.preventDefault();
		
		fileInputLabel.style.display = "none";
		
		parser.loadFile(fileInput.files[0]).then(function(result){
			glb = result;
			
			enableRenderingButton.style.display = "block";
			enableRenderingButton.onclick = function(){
				viewerPMon.start().then(function(){
					viewer.showFile(glb).then(function(){
						enableRenderingButton.style.display = "none";
					});
				});
			}
			
			showDetails();
			
			processButton.style.display = "block";
			processButton.onclick = function(){
				toolsPMon.start().then(async function(){
					processButton.style.display = "none";
					let objectUrl = await tools.process(glb);
					
					console.log(objectUrl);
					
					let downloadLink = document.createElement("a");
					downloadLink.innerHTML = "Download GLB";
					downloadLink.download = "output.glb";
					downloadLink.href = objectUrl;
					downloadLink.id = "downloadButton";
					toolsContainer.appendChild(downloadLink);
					downloadLink.className = "fresh";
					setTimeout(function(){
						downloadLink.className = "";
					}, 100);
				});
			};
		});
		
	}
	
	function showDetails(){
		informationEl.innerHTML += "<h2>"+glb.json.info.fileName+"</h2>";
		informationEl.innerHTML += "<p>File size: "+glb.json.info.fileSizeHumanReadable+"</p>";
		informationEl.innerHTML += "<p>Accessors: "+glb.json.accessors.length+"</p>";
		informationEl.innerHTML += "<p>BufferViews: "+glb.json.bufferViews.length+"</p>";
		informationEl.innerHTML += "<p>Buffers: "+glb.json.buffers.length+"</p>";
		if(glb.json.images){
			informationEl.innerHTML += "<p>Images: "+glb.json.images.length+"</p>";
		} else {
			informationEl.innerHTML += "<p>Images: "+"none"+"</p>";
		}
		if(glb.json.materials){
			informationEl.innerHTML += "<p>Materials: "+glb.json.materials.length+"</p>";
		} else {
			informationEl.innerHTML += "<p>Materials: "+"none"+"</p>";
		}
		informationEl.innerHTML += "<p>Meshes: "+glb.json.meshes.length+"</p>";
		informationEl.innerHTML += "<p>Nodes: "+glb.json.nodes.length+"</p>";
		informationEl.innerHTML += "<p>Scenes: "+glb.json.scenes.length+"</p>";
	}

}