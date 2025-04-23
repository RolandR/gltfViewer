
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
			let faces = [];
			
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
							edges: [
								[
									[
										primitive.positionView[primitive.indexView[i+0]*3+0],
										primitive.positionView[primitive.indexView[i+0]*3+1],
										primitive.positionView[primitive.indexView[i+0]*3+2],
									], [
										primitive.positionView[primitive.indexView[i+1]*3+0],
										primitive.positionView[primitive.indexView[i+1]*3+1],
										primitive.positionView[primitive.indexView[i+1]*3+2],
									],
								],
								[
									[
										primitive.positionView[primitive.indexView[i+1]*3+0],
										primitive.positionView[primitive.indexView[i+1]*3+1],
										primitive.positionView[primitive.indexView[i+1]*3+2],
									], [
										primitive.positionView[primitive.indexView[i+2]*3+0],
										primitive.positionView[primitive.indexView[i+2]*3+1],
										primitive.positionView[primitive.indexView[i+2]*3+2],
									],
								],
								[
									[
										primitive.positionView[primitive.indexView[i+2]*3+0],
										primitive.positionView[primitive.indexView[i+2]*3+1],
										primitive.positionView[primitive.indexView[i+2]*3+2],
									], [
										primitive.positionView[primitive.indexView[i+0]*3+0],
										primitive.positionView[primitive.indexView[i+0]*3+1],
										primitive.positionView[primitive.indexView[i+0]*3+2],
									],
								],
							],
							originalColor: color,
						};
						
						triangles.push(triangle);
						
					}
				}
			}
			
			faces = findAllFaces(triangles);
			
			for(let f in faces){
				let edges = calculateEdges(faces[f]);
				faces[f].edges = edges.edges;
				faces[f].outsideEdges = edges.outsideEdges;
			}
			
			console.log(triangles);
			console.log(faces);
			
			let facesContainer = document.getElementById("faces");
			let faceCountEl = document.getElementById("faceCount");
			faceCountEl.innerHTML = "("+faces.length+")";
			
			for(let f in faces){
				let face = faces[f];
				
				let faceEl = document.createElement("div");
				faceEl.className = "faceInfo";
				faceEl.innerHTML = face.triangles.length + " triangles<br>";
				faceEl.innerHTML += face.edges.length + " edges<br>";
				faceEl.innerHTML += face.outsideEdges.length + " outside edges<br>";
				
				faceEl.onmouseover = function(e){
					for(let t in face.triangles){
						let triangle = face.triangles[t];
						let color = [255, 0, 0];
						triangle.primitive.colors.set(color, (triangle.points[0])*3);
						triangle.primitive.colors.set(color, (triangle.points[1])*3);
						triangle.primitive.colors.set(color, (triangle.points[2])*3);
					}
				}
				
				faceEl.onmouseleave = function(e){
					for(let t in face.triangles){
						let triangle = face.triangles[t];
						let color = triangle.originalColor;
						triangle.primitive.colors.set(color, (triangle.points[0])*3);
						triangle.primitive.colors.set(color, (triangle.points[1])*3);
						triangle.primitive.colors.set(color, (triangle.points[2])*3);
					}
				}
				
				facesContainer.appendChild(faceEl);
			}
			
			enableRenderingButton.style.display = "block";
			enableRenderingButton.onclick = function(){
				viewerPMon.start().then(function(){
					viewer.showFile(result).then(function(){
						enableRenderingButton.style.display = "none";
					});
				});
			}
			
		});
		
	}
	
	function calculateEdges(face){
		/*
			Find all unique edges of all triangles of a face, as well as the edges forming the face's border.
			
			Perhaps there would be a more performant way to find these if
			we include this in the findPolygon() function.
		*/
		
		let distanceThreshold = 0.0001; // todo: find out if this value is reasonable
		
		let edges = [];
		
		for(let t in face.triangles){
			let triangle = face.triangles[t];
			
			for(let e in triangle.edges){
				let edge = triangle.edges[e];
				
				let edgeAlreadyExists = false;
				
				for(let ee in edges){
					let existingEdge = edges[ee];
					
					if(
						// check if two edges are identical
						(
							// point A0 equals point B0 and point A1 equals point B1
							Math.abs(edge[0][0] - existingEdge.points[0][0]) <= distanceThreshold &&
							Math.abs(edge[0][1] - existingEdge.points[0][1]) <= distanceThreshold &&
							Math.abs(edge[0][2] - existingEdge.points[0][2]) <= distanceThreshold &&
							
							Math.abs(edge[1][0] - existingEdge.points[1][0]) <= distanceThreshold &&
							Math.abs(edge[1][1] - existingEdge.points[1][1]) <= distanceThreshold &&
							Math.abs(edge[1][2] - existingEdge.points[1][2]) <= distanceThreshold
						) || (
							// point A0 equals point B1 and point A1 equals point B0
							Math.abs(edge[0][0] - existingEdge.points[1][0]) <= distanceThreshold &&
							Math.abs(edge[0][1] - existingEdge.points[1][1]) <= distanceThreshold &&
							Math.abs(edge[0][2] - existingEdge.points[1][2]) <= distanceThreshold &&
							
							Math.abs(edge[1][0] - existingEdge.points[0][0]) <= distanceThreshold &&
							Math.abs(edge[1][1] - existingEdge.points[0][1]) <= distanceThreshold &&
							Math.abs(edge[1][2] - existingEdge.points[0][2]) <= distanceThreshold
						)
					){
						existingEdge.triangles.push(triangle);
						edgeAlreadyExists = true;
						break;
					}
				}
				
				if(!edgeAlreadyExists){
					let newEdge = {
						points: edge,
						triangles: [triangle],
					};
					edges.push(newEdge);
				}
			}
		}
		
		// An edge is an outside edge if it's part of only one triangle.
		// (it may also be an "outside edge" to a hole in a face)
		let outsideEdges = edges.filter((edge) => edge.triangles.length === 1);
		
		return {
			edges: edges,
			outsideEdges: outsideEdges,
		};
		
	}
	
	function findAllFaces(triangles){
		/*
			Find all polygon faces formed by all the triangles in the list.
		*/
		
		let trianglesAlreadyInFaces = new Set();
		let faces = [];
		
		for(let t in triangles){
			let triangle = triangles[t];
			if(trianglesAlreadyInFaces.has(triangle)){
				continue;
			}
			
			let face = {
				triangles: findPolygon(triangles, triangle),
				color: [
					Math.random()*100+50,
					Math.random()*100+50,
					Math.random()*100+50,
				],
			};
			
			for(let ft in face.triangles){
				let triangle = face.triangles[ft];
				triangle.originalColor = face.color;
				triangle.primitive.colors.set(face.color, (triangle.points[0])*3);
				triangle.primitive.colors.set(face.color, (triangle.points[1])*3);
				triangle.primitive.colors.set(face.color, (triangle.points[2])*3);
				
				trianglesAlreadyInFaces.add(triangle);
			}
			
			faces.push(face);
		}
		
		return faces;
		
	}
	
	function findCoplanarTriangles(triangles, triangle){
		
		/*
			
			Two triangles are coplanar if they have the same normal vectors,
			AND if the vector from some point in triangle A to some point in triangle B
			is perpendicular to the normal vector (dot product == 0).
			
			In this function, we only test one vertex normal of each triangle, instead
			of calculating the triangle normal. This assumes flat shading where all three
			vector normals are identical, and could lead to problems with smooth shading
			where this isn't the case.
			
		*/
		
		const dotProductThreshold = 0.0001; // todo: find out if this value is reasonable
		
		
		let returnTriangles = [];
		let candidateNormal = new Float32Array(3);
		let triangleNormal = new Float32Array(3);
		let trianglePoint = new Float32Array(3);
		let candidatePoint = new Float32Array(3);
		let candidateTriangleVector = new Float32Array(3);
		
		for(let t in triangles){
			let candidate = triangles[t];
			
			candidateNormal[0] = candidate.primitive.normalView[candidate.points[0]*3+0];
			candidateNormal[1] = candidate.primitive.normalView[candidate.points[0]*3+1];
			candidateNormal[2] = candidate.primitive.normalView[candidate.points[0]*3+2];
			
			triangleNormal[0] = triangle.primitive.normalView[triangle.points[0]*3+0];
			triangleNormal[1] = triangle.primitive.normalView[triangle.points[0]*3+1];
			triangleNormal[2] = triangle.primitive.normalView[triangle.points[0]*3+2];
			
			if(
				candidateNormal[0] === triangleNormal[0] && // todo: maybe add some tolerance
				candidateNormal[1] === triangleNormal[1] &&
				candidateNormal[2] === triangleNormal[2]
			){
				
				trianglePoint[0] = triangle.primitive.positionView[triangle.points[0]*3+0];
				trianglePoint[1] = triangle.primitive.positionView[triangle.points[0]*3+1];
				trianglePoint[2] = triangle.primitive.positionView[triangle.points[0]*3+2];
				
				candidatePoint[0] = candidate.primitive.positionView[candidate.points[0]*3+0];
				candidatePoint[1] = candidate.primitive.positionView[candidate.points[0]*3+1];
				candidatePoint[2] = candidate.primitive.positionView[candidate.points[0]*3+2];
				
				candidateTriangleVector[0] = trianglePoint[0] - candidatePoint[0];
				candidateTriangleVector[1] = trianglePoint[1] - candidatePoint[1];
				candidateTriangleVector[2] = trianglePoint[2] - candidatePoint[2];
				
				let dotProduct = dotProductVec3(candidateTriangleVector, candidateNormal);
				
				if(Math.abs(dotProduct) < dotProductThreshold){
					returnTriangles.push(candidate);
				} else {
					
				}
			} else {
				
			}
		}
		return returnTriangles;
	}
	
	function findPolygon(triangles, triangle){
		
		/*
		
			Find a polygon face of contiguous coplanar triangles.
			NOTE: In this case, a face can contain triangles from different meshes.
			This is intended behaviour for now, but we'll have to see if it actually makes sense.
		
		*/
		
		let distanceThreshold = 0.0001; // todo: find out if this value is reasonable
		
		let candidateTriangles = findCoplanarTriangles(triangles, triangle);
		let foundTriangleIndices = new Set();
		let indexOfQueriedTriangle = candidateTriangles.indexOf(triangle);
		if(indexOfQueriedTriangle === -1){
			console.error("something went terribly wrong: triangle is not coplanar with itself? o_O");
		}
		foundTriangleIndices.add(indexOfQueriedTriangle);
		
		let testPointCoordinates = new Float32Array(3);
		let candidatePointCoordinates = new Float32Array(3);
		
		/*
			
			Find all triangles forming a polygon face with our input triangle.
			For this, we find all coplanar triangles which share any two points with any triangle already in our polygon, and add those to the polygon.
			We repeat this until no new triangle was added in a pass of the loop.
			
		*/
		let foundNewTriangle = true;
		
		while(foundNewTriangle){
			foundNewTriangle = false;
			
			for(let t in candidateTriangles){
				t = parseInt(t);
				if(foundTriangleIndices.has(t)){
					continue;
				}
				let candidateTriangle = candidateTriangles[t];
				
				for(let index of foundTriangleIndices){
					let testTriangle = candidateTriangles[index];
					
					if(candidateTriangle == testTriangle){
						continue;
					}
					
					let matchingPoints = 0;
					
					// compare every point of testTriangle with every point of candidateTriangle
					for(let p in testTriangle.points){
						testPointCoordinates[0] = testTriangle.primitive.positionView[testTriangle.points[p]*3+0];
						testPointCoordinates[1] = testTriangle.primitive.positionView[testTriangle.points[p]*3+1];
						testPointCoordinates[2] = testTriangle.primitive.positionView[testTriangle.points[p]*3+2];
						
						for(let c in candidateTriangle.points){
							candidatePointCoordinates[0] = candidateTriangle.primitive.positionView[candidateTriangle.points[c]*3+0];
							candidatePointCoordinates[1] = candidateTriangle.primitive.positionView[candidateTriangle.points[c]*3+1];
							candidatePointCoordinates[2] = candidateTriangle.primitive.positionView[candidateTriangle.points[c]*3+2];
							
							if(
								Math.abs(candidatePointCoordinates[0] - testPointCoordinates[0]) <= distanceThreshold &&
								Math.abs(candidatePointCoordinates[1] - testPointCoordinates[1]) <= distanceThreshold &&
								Math.abs(candidatePointCoordinates[2] - testPointCoordinates[2]) <= distanceThreshold
							){
								matchingPoints++;
							}
						}
					}
					
					if(matchingPoints >= 2){
						if(matchingPoints === 3){
							console.warn("Somehow, 3 out of 3 points are overlapping. This is strange and unexpected.");
						}
						
						foundTriangleIndices.add(t);
						foundNewTriangle = true;
					}
				}
			}
		}
		
		let returnTriangles = [];
		
		for(let index of foundTriangleIndices){
			returnTriangles.push(candidateTriangles[index]);
		}
		
		//console.log(foundTriangleIndices);
		//console.log("Face contains "+returnTriangles.length+" triangles.");
		
		return returnTriangles;
	}
	
}