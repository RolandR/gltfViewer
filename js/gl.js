
function Renderer(canvasId){

	var canvas = document.getElementById(canvasId);

	canvas.width = document.getElementById("canvasContainer").clientWidth;
	canvas.height = document.getElementById("canvasContainer").clientHeight;
	
	var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

	var shaderProgram;
	var size;
	
	var scene = null;
	var meshes = [];
	var materials = [];
	var textures = [];

	var transformMatrixRef;
	var normalTransformRef;
	var aspectRef;
	var colorRef;
	
	init();

	function init(){

		gl.enable(gl.DEPTH_TEST);

		//gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		//gl.enable(gl.BLEND);

		/*=========================Shaders========================*/

		// Create a vertex shader object
		var vertShader = gl.createShader(gl.VERTEX_SHADER);

		// Attach vertex shader source code
		gl.shaderSource(vertShader, vertexShader);

		// Compile the vertex shader
		gl.compileShader(vertShader);

		// Create fragment shader object
		var fragShader = gl.createShader(gl.FRAGMENT_SHADER);

		// Attach fragment shader source code
		gl.shaderSource(fragShader, fragmentShader);

		// Compile the fragmentt shader
		gl.compileShader(fragShader);

		// Create a shader program object to store
		// the combined shader program
		shaderProgram = gl.createProgram();

		// Attach a vertex shader
		gl.attachShader(shaderProgram, vertShader); 

		// Attach a fragment shader
		gl.attachShader(shaderProgram, fragShader);

		// Link both programs
		gl.linkProgram(shaderProgram);

		// Use the combined shader program object
		gl.useProgram(shaderProgram);
		
		var vertInfo = gl.getShaderInfoLog(vertShader);
		var fragInfo = gl.getShaderInfoLog(fragShader);
		var programInfo = gl.getProgramInfoLog(shaderProgram);

		if(vertInfo){
			console.info(vertInfo);
		}
		if(fragInfo){
			console.info(fragInfo);
		}
		if(programInfo){
			console.info(programInfo);
		}

		maxDistanceRef = gl.getUniformLocation(shaderProgram, "maxDistance");
		modelRef = gl.getUniformLocation(shaderProgram, "model");
		viewRef = gl.getUniformLocation(shaderProgram, "view");
		perspectiveRef = gl.getUniformLocation(shaderProgram, "perspective");
		normalTransformRef = gl.getUniformLocation(shaderProgram, "normalTransform");
		aspectRef = gl.getUniformLocation(shaderProgram, "aspect");
		colorRef = gl.getUniformLocation(shaderProgram, "color");
		emissiveRef = gl.getUniformLocation(shaderProgram, "emissive");
		shinyRef = gl.getUniformLocation(shaderProgram, "shiny");
		samplerRef = gl.getUniformLocation(shaderProgram, "uSampler");
	}
	
	function addMesh(mesh){
		let primitives = [];
		
		for(let p in mesh.primitives){
			
			//console.log(mesh.primitives[p].positionView);
			
			let vertices = mesh.primitives[p].positionView;
			let normals = mesh.primitives[p].normalView;
			let indices = mesh.primitives[p].indexView;
			let texCoords = mesh.primitives[p].texCoordView;
			
			//console.log(indices.length);
			
			let size = indices.length;
			
			console.log(materials[mesh.primitives[p].material]);
			
			let primitive = {
				 vertices: vertices
				,normals: normals
				,indices: indices
				,texCoords: texCoords
				,vertexBuffer: gl.createBuffer()
				,normalsBuffer: gl.createBuffer()
				,indexBuffer: gl.createBuffer()
				,texCoordBuffer: gl.createBuffer()
				,size: size
				,material: materials[mesh.primitives[p].material]
			};
			
			gl.bindBuffer(gl.ARRAY_BUFFER, primitive.vertexBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, primitive.vertices, gl.STATIC_DRAW);
			let coord = gl.getAttribLocation(shaderProgram, "coordinates");
			gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, mesh.primitives[p].positionByteStride, 0);
			gl.enableVertexAttribArray(coord);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalsBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, primitive.normals, gl.STATIC_DRAW);
			let normal = gl.getAttribLocation(shaderProgram, "vertexNormal");
			gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, mesh.primitives[p].normalByteStride, 0);
			gl.enableVertexAttribArray(normal);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, primitive.texCoordBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, primitive.texCoords, gl.STATIC_DRAW);
			let texCoord = gl.getAttribLocation(shaderProgram, "texCoord");
			gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, mesh.primitives[p].texCoordByteStride, 0);
			gl.enableVertexAttribArray(texCoord);
			
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, primitive.indices, gl.STATIC_DRAW);
			
			primitives.push(primitive);
		}
		
		meshes[mesh.id] = {
			id: mesh.id,
			name: mesh.name,
			primitives: primitives
		};
	}
	
	function addMaterial(material){
		materials[material.id] = material;
	}
	
	function addScene(s){
		scene = s;
	}
	
	function addTexture(tex){
		textures[tex.id] = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, textures[tex.id]);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGB,
			//tex.img.width,
			//tex.img.height,
			//0,
			gl.RGB,
			gl.UNSIGNED_BYTE,
			tex.img
		);
		console.log(tex.img.width);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		
	}
	
	function render(model, view, perspective){

		/*if(!interpolation){
			interpolation = 0;
		}

		var identityMatrix = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		];*/

		//console.table(transforms);

		/*for(var i in transformMatrix){
			transformMatrix[i] = transformMatrix[i] * (1-interpolation) + identityMatrix[i] * interpolation;
		}*/
		
		var normalsMatrix = normalMatrix(model);

		gl.uniform1f(maxDistanceRef, 8.0);
		
		gl.uniformMatrix4fv(viewRef, false, view);
		gl.uniformMatrix4fv(perspectiveRef, false, perspective);
		gl.uniformMatrix4fv(normalTransformRef, false, normalsMatrix);
		gl.uniform1f(aspectRef, canvas.width/canvas.height);

		// Clear the canvas
		gl.clearColor(0, 0, 1, 1);
		
		gl.viewport(0, 0, canvas.width, canvas.height);

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		
		for(let n in scene.nodes){
			renderNode(scene.nodes[n], model);
		}
	}
	
	function renderNode(node, transform){
		let localTransform = multiplyMatrices(transform, node.matrix);
		//console.log(localTransform);
		if(node.mesh !== undefined){
			let mesh = meshes[node.mesh];
			for(let p in mesh.primitives){
				let primitive = mesh.primitives[p];
				
				gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalsBuffer);
				var normal = gl.getAttribLocation(shaderProgram, "vertexNormal");
				gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, primitive.normalByteStride, 0);
				gl.enableVertexAttribArray(normal);
				
				gl.bindBuffer(gl.ARRAY_BUFFER, primitive.vertexBuffer);
				var coord = gl.getAttribLocation(shaderProgram, "coordinates");
				gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, primitive.positionByteStride, 0);
				gl.enableVertexAttribArray(coord);
				
				gl.bindBuffer(gl.ARRAY_BUFFER, primitive.texCoordBuffer);
				var texCoord = gl.getAttribLocation(shaderProgram, "texCoord");
				gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, primitive.texCoordByteStride, 0);
				gl.enableVertexAttribArray(texCoord);
				
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, textures[primitive.material.pbrMetallicRoughness.baseColorTexture.index]);
				gl.uniform1i(samplerRef, 0);
				
				let color = primitive.material.pbrMetallicRoughness.baseColorFactor;
				gl.uniform4f(colorRef, color[0], color[1], color[2], color[3]);
				gl.uniform1f(shinyRef, 0.2);
				gl.uniform1f(emissiveRef, 0);
				
				gl.uniformMatrix4fv(modelRef, false, localTransform);
				
				
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer);
				
				//console.log(gl.getProgramInfoLog(shaderProgram));
				
				//console.log(mesh.name);
				//console.log(primitive);
				gl.drawElements(gl.TRIANGLES, primitive.size, gl.UNSIGNED_SHORT, 0);
			}
		}
		
		for(let c in node.children){
			renderNode(node.children[c], localTransform);
		}
	}

	return{
		 addMesh: addMesh
		,addScene: addScene
		,addMaterial: addMaterial
		,addTexture: addTexture
		,render: render
	};

}