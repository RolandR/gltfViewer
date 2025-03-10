
main();

function main(){

	const canvasContainer = document.getElementById("canvasContainer");
	const fileInput = document.getElementById("fileUpload");
	
	const informationEl = document.getElementById("fileInformation");
	
	const toolsContainer = document.getElementById("toolsContainer");
	const processButton = document.getElementById("processFileButton");

	const pMon = new ProgressMonitor(document.body, {
		itemsCount: 5,
		title: "Loading .glb file..."
	});
	
	const viewer = new Viewer(canvasContainer, {showFrameCounter: true, progressMonitor: pMon});
	const tools = new GlbTools({progressMonitor: pMon});

	const parser = new GlbParser(pMon);
	
	let glb;

	fileInput.onchange = function(e){
		e.preventDefault();
		
		parser.loadFile(fileInput.files[0]).then(function(result){
			glb = result;
			//viewer.showFile(glb);
			pMon.finish(0, 500);
			
			showDetails();
			
			processButton.style.display = "block";
			processButton.onclick = function(){
				let objectUrl = tools.process(glb);
				
				let downloadLink = document.createElement("a");
				downloadLink.innerHTML = "Download GLB";
				downloadLink.download = "output.glb";
				downloadLink.href = objectUrl;
				downloadLink.id = "downloadButton";
				toolsContainer.appendChild(downloadLink);
			};
		});
		
	}
	
	function showDetails(){
		informationEl.innerHTML += "<h2>"+glb.json.info.fileName+"</h2>";
		informationEl.innerHTML += ""+glb.json.info.fileSizeHumanReadable+"";
	}

}