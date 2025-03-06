
main();

function main(){

	const canvasContainer = document.getElementById("canvasContainer");
	const fileInput = document.getElementById("fileUpload");
	
	const informationEl = document.getElementById("fileInformation");

	const pMon = new ProgressMonitor(document.body, {
		itemsCount: 5,
		title: "Loading .glb file..."
	});
	
	const viewer = new Viewer(canvasContainer, {showFrameCounter: true, progressMonitor: pMon});

	const parser = new GlbParser(pMon);
	
	let glb;

	fileInput.onchange = function(e){
		e.preventDefault();
		
		parser.loadFile(fileInput.files[0]).then(function(result){
			glb = result;
			viewer.showFile(glb);
			showDetails();
		});
		
	}
	
	function showDetails(){
		informationEl.innerHTML += "<h2>"+glb.json.info.fileName+"</h2>";
		informationEl.innerHTML += ""+glb.json.info.fileSizeHumanReadable+"";
	}

}