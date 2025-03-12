
main();

function main(){

	const canvasContainer = document.getElementById("canvasContainer");
	const fileInput = document.getElementById("fileUpload");
	const fileInputLabel = document.getElementById("fileUploadButton");
	
	const informationEl = document.getElementById("fileInformation");
	
	const toolsContainer = document.getElementById("toolsContainer");
	const processButton = document.getElementById("processFileButton");
	const enableRenderingButton = document.getElementById("enableRenderingButton");
	
	const largestMeshesContainer = document.getElementById("largestMeshes");
	const materialsContainer = document.getElementById("materials");
	
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
		updateFileDetails();
		updateLargestMeshes();
		updateMaterials();
	}
	
	function updateFileDetails(){
		informationEl.innerHTML = "<h2>"+glb.json.info.fileName+"</h2>";
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
	
	function updateLargestMeshes(){
		let meshSizes = tools.getBiggestMeshes(glb.json);
		let count = 100;
		count = Math.min(count, meshSizes.length);
		
		let outString = "";
		
		
		outString += "<table>";
		outString += "<caption>";
		outString += "<h2>Biggest meshes</h2>";
		outString += "</caption>";
		outString += "<thead>";
		outString += "<tr>";
		outString += "<th scope=\"column\">#</th>";
		outString += "<th scope=\"column\">Tris</th>";
		outString += "<th scope=\"column\">Mesh name</th>";
		outString += "</tr>";
		outString += "</thead>";
		outString += "<tbody>";
		
		for(let i = 0; i < count; i++){
			outString += "<tr>";
			outString += "<th scope=\"row\" class=\"number\">"+(i+1)+".</td>";
			outString += "<td class=\"number\">"+meshSizes[i].totalSize+"</td>";
			outString += "<td>"+meshSizes[i].nodeName+"</td>";
			
			/*if(meshSizes[i].primitiveSizes.length > 1){
				outString += " (";
				for(let p in meshSizes[i].primitiveSizes){
					if(p != 0){
						outString += ", ";
					}
					outString += meshSizes[i].primitiveSizes[p];
				}
				outString += ")";
			}*/
			outString += "</tr>";
		}
		
		outString += "</tbody>";
		outString += "</table>";
		
		largestMeshesContainer.innerHTML += outString;
	}
	
	function updateMaterials(){
		materialsContainer.innerHTML += "<h2>Materials</h2>";
		
		for(let i in glb.json.materials){
			let material = glb.json.materials[i];
			
			let materialElement = document.createElement("div");
			materialElement.className = "material";
			
			let r = material.pbrMetallicRoughness.baseColorFactor[0]*255;
			let g = material.pbrMetallicRoughness.baseColorFactor[1]*255;
			let b = material.pbrMetallicRoughness.baseColorFactor[2]*255;
			let a = material.pbrMetallicRoughness.baseColorFactor[3];
			
			let color = "rgb("+r+", "+g+", "+b+")";
			let colorA = "rgba("+r+", "+g+", "+b+", "+a+")";
			let gradient = "linear-gradient(to right, "+colorA+", "+colorA+" 50%, "+color+" 50%, "+color+")";
			let background = gradient + ", url(\"./img/alpha-checkerboard.png\")";
			
			let colorSwab = document.createElement("div");
			colorSwab.className = "colorSwab";
			colorSwab.style.background = background;
			colorSwab.style.backgroundSize = "auto, 10px";
			
			let materialProperties = document.createElement("div");
			materialProperties.className = "materialProperties";
			
			let content = "<div>"
			content += "<p>metallicFactor: "+material.pbrMetallicRoughness.metallicFactor+"</p>";
			content += "<p>roughnessFactor: "+material.pbrMetallicRoughness.roughnessFactor+"</p>";
			content += "<p>alpha: "+a+"</p>";
			content += "</div>";
			
			materialProperties.innerHTML = content;
			materialProperties.appendChild(colorSwab);
			
			materialProperties.onclick = function(){
				
				material.pbrMetallicRoughness.baseColorFactor[0] = 1.0;
				material.pbrMetallicRoughness.baseColorFactor[1] = 0.0;
				material.pbrMetallicRoughness.baseColorFactor[2] = 0.0;
				material.pbrMetallicRoughness.baseColorFactor[3] = 1.0;
				
			};
			
			let title = "";
			title += i;
			title += ": ";
			title += material.name;
			
			materialElement.innerHTML = title;
			materialElement.appendChild(materialProperties);
			
			
			materialsContainer.appendChild(materialElement);
			
		}
	}
	
}