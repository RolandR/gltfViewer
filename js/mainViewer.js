

let canvasContainer = document.getElementById("canvasContainer");
const fileInput = document.getElementById("fileUpload");

const viewer = new Viewer(canvasContainer, {showFrameCounter: true});


fileInput.onchange = function(e){
	e.preventDefault();
	
	viewer.showFile(fileInput.files[0]);
}