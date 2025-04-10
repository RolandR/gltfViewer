
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
	
	//const tools = new GlbTools({progressMonitor: toolsPMon});

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
			glb = result.json;
			
			let triangles = [];
			
			for(let m in glb.meshes){
				let mesh = glb.meshes[m];
				for(let p in mesh.processedPrimitives){
					let primitive = mesh.processedPrimitives[p];
					primitive.colors = new Uint8Array(primitive.indexView.length*3);
					
					// triangles
					for(let i = 0; i < primitive.indexView.length/4; i += 3){
						
						let color = [
							Math.random()*100+156,
							Math.random()*100+156,
							Math.random()*100+156,
						];
						
						primitive.colors.set(color, (primitive.indexView[i+0])*3);
						primitive.colors.set(color, (primitive.indexView[i+1])*3);
						primitive.colors.set(color, (primitive.indexView[i+2])*3);
						
						let triangle = {
							mesh: mesh,
							primitive: primitive,
							points: [
								primitive.indexView[i+0],
								primitive.indexView[i+1],
								primitive.indexView[i+2],
							],
							originalColor: color,
						};
						
						triangles.push(triangle);
						
					}
				}
			}
			
			console.log(triangles);
			
			let trianglesContainer = document.getElementById("triangles");
			
			for(let t in triangles){
				let triangle = triangles[t];
				
				let triangleEl = document.createElement("div");
				triangleEl.className = "triangleInfo";
				triangleEl.innerHTML = triangle.points[0] +", "+ triangle.points[1] +", "+ triangle.points[2] + "<br>";
				triangleEl.innerHTML += "in mesh "+triangle.mesh.name;
				
				triangleEl.onmouseover = function(e){
					let color = [255, 0, 0];
					triangle.primitive.colors.set(color, (triangle.points[0])*3);
					triangle.primitive.colors.set(color, (triangle.points[1])*3);
					triangle.primitive.colors.set(color, (triangle.points[2])*3);
				}
				
				triangleEl.onmouseleave = function(e){
					let color = triangle.originalColor;
					triangle.primitive.colors.set(color, (triangle.points[0])*3);
					triangle.primitive.colors.set(color, (triangle.points[1])*3);
					triangle.primitive.colors.set(color, (triangle.points[2])*3);
				}
				
				let coplanarButton = document.createElement("button");
				coplanarButton.innerHTML = "Find coplanar faces";
				
				coplanarButton.onclick = function(){
					let coplanarTriangles = findCoplanarTriangles(triangles, triangle);
					let color = [255, 255, 0];

					for(let i in coplanarTriangles){
						let triangle = coplanarTriangles[i];
						triangle.originalColor = color;
						triangle.primitive.colors.set(color, (triangle.points[0])*3);
						triangle.primitive.colors.set(color, (triangle.points[1])*3);
						triangle.primitive.colors.set(color, (triangle.points[2])*3);
					}
				}
				
				triangleEl.appendChild(coplanarButton);
				
				trianglesContainer.appendChild(triangleEl);
			}
			
			enableRenderingButton.style.display = "block";
			enableRenderingButton.onclick = function(){
				viewerPMon.start().then(function(){
					viewer.showFile(result).then(function(){
						enableRenderingButton.style.display = "none";
					});
				});
			}
			
			processButton.style.display = "block";
			processButton.onclick = function(){
				
			};
		});
		
	}
	
	function findCoplanarTriangles(triangles, triangle){
		let returnTriangles = [];
		for(let t in triangles){
			let candidate = triangles[t];
			if(
				candidate.primitive.normalView[candidate.points[0]*3+0] == triangle.primitive.normalView[triangle.points[0]*3+0] &&
				candidate.primitive.normalView[candidate.points[0]*3+1] == triangle.primitive.normalView[triangle.points[0]*3+1] &&
				candidate.primitive.normalView[candidate.points[0]*3+2] == triangle.primitive.normalView[triangle.points[0]*3+2]
			){
				returnTriangles.push(candidate);
			}
		}
		return returnTriangles;
	}
	
}