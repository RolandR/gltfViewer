
function Renderer(canvasId){

	const canvas = document.getElementById(canvasId);
	
	canvas.width = document.getElementById("canvasContainer").clientWidth;
	canvas.height = document.getElementById("canvasContainer").clientHeight;
	
	const gl = canvas.getContext("webgl2", {premultipliedAlpha: false, preserveDrawingBuffer: false});

	let shaderProgram;
	let skyboxShaderProgram;
	
	let size;
	
	let scene = null;
	const meshes = [];
	const materials = [];
	const textures = [];
	
	let transparentPrimitives = [];

	let transformMatrixRef;
	let normalTransformRef;
	let aspectRef;
	let colorRef;
	let cameraZRef;
	
	let samplerRef;
	let normalSamplerRef;
	let skyboxSamplerRef;
	let skyboxVertexBuffer;
	
	let skyboxTexture;
	
	init();

	function init(){

		//gl.enable(gl.DEPTH_TEST);

		//gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		//gl.enable(gl.BLEND);

		/*=========================Shaders========================*/

		let vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertexShader, shaderTexts["vertexShader"]);
		gl.compileShader(vertexShader);
		
		let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader, shaderTexts["fragmentShader"]);
		gl.compileShader(fragmentShader);
		
		shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader); 
		gl.attachShader(shaderProgram, fragmentShader);
		
		gl.linkProgram(shaderProgram);
		//gl.useProgram(shaderProgram);
		
		var vertInfo = gl.getShaderInfoLog(vertexShader);
		var fragInfo = gl.getShaderInfoLog(fragmentShader);
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
		cameraZRef = gl.getUniformLocation(shaderProgram, "cameraZ");
		emissiveRef = gl.getUniformLocation(shaderProgram, "emissive");
		shinyRef = gl.getUniformLocation(shaderProgram, "shiny");
		samplerRef = gl.getUniformLocation(shaderProgram, "uSampler");
		normalSamplerRef = gl.getUniformLocation(shaderProgram, "uNormalSampler");
		skyboxSamplerRef = gl.getUniformLocation(shaderProgram, "uSkyboxSampler");
		
		/*   Skybox shader   */
		
		let skyboxVertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(skyboxVertexShader, shaderTexts["skyboxVertexShader"]);
		gl.compileShader(skyboxVertexShader);
		
		let skyboxFragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(skyboxFragmentShader, shaderTexts["skyboxFragmentShader"]);
		gl.compileShader(skyboxFragmentShader);
		
		skyboxShaderProgram = gl.createProgram();
		gl.attachShader(skyboxShaderProgram, skyboxVertexShader); 
		gl.attachShader(skyboxShaderProgram, skyboxFragmentShader);
		
		gl.linkProgram(skyboxShaderProgram);
		
		skyboxSkyboxSamplerRef = gl.getUniformLocation(skyboxShaderProgram, "uSkyboxSampler");
		skyboxAspectRef = gl.getUniformLocation(skyboxShaderProgram, "aspect");
		skyboxViewRef = gl.getUniformLocation(skyboxShaderProgram, "view");
		
		let skyboxVertices = new Float32Array([
			-1.0, -1.0,
			 1.0, -1.0,
			-1.0,  1.0,
			
			-1.0,  1.0,
			 1.0, -1.0,
			 1.0,  1.0
		]);
		
		skyboxVertexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, skyboxVertices, gl.STATIC_DRAW);
		let coord = gl.getAttribLocation(skyboxShaderProgram, "coordinates");
		gl.vertexAttribPointer(coord, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(coord);
	}
	
	function loadSkybox(skyboxTextures){
		const skyboxUp = skyboxTextures.up;
		const skyboxDn = skyboxTextures.dn;
		const skyboxFt = skyboxTextures.ft;
		const skyboxBk = skyboxTextures.bk;
		const skyboxLf = skyboxTextures.lf;
		const skyboxRt = skyboxTextures.rt;
		
		skyboxTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
		
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxUp);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxDn);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxRt);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxLf);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxFt);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxBk);
		
		gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
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
			
			//console.log(materials[mesh.primitives[p].material]);
			
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
			if(coord == -1) console.error(coord);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalsBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, primitive.normals, gl.STATIC_DRAW);
			let normal = gl.getAttribLocation(shaderProgram, "vertexNormal");
			gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, mesh.primitives[p].normalByteStride, 0);
			gl.enableVertexAttribArray(normal);
			if(normal == -1) console.error(primitive);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, primitive.texCoordBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, primitive.texCoords, gl.STATIC_DRAW);
			let texCoord = gl.getAttribLocation(shaderProgram, "texCoord");
			gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, mesh.primitives[p].texCoordByteStride, 0);
			gl.enableVertexAttribArray(texCoord);
			if(texCoord == -1) console.error(texCoord);
			
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, primitive.indices, gl.STATIC_DRAW);
			
			console.log(primitive.vertices.length/3, primitive.normals.length/3, primitive.texCoords.length/2, primitive.indices.length);
			
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
			gl.RGBA,
			//tex.img.width,
			//tex.img.height,
			//0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			tex.img
		);
		//console.log(tex.img.width);
		gl.generateMipmap(gl.TEXTURE_2D);
		//gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		
	}
	
	function render(model, view, perspective){

		// Clear the canvas
		//gl.clearColor(1, 1, 1, 1);
		
		//gl.viewport(0, 0, canvas.width, canvas.height);

		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		
		renderSkybox(model, view, perspective);
		
		gl.enable(gl.DEPTH_TEST);
		
		gl.useProgram(shaderProgram);
		
		gl.uniform1f(maxDistanceRef, 8.0);
		
		gl.uniformMatrix4fv(viewRef, false, view);
		gl.uniformMatrix4fv(perspectiveRef, false, perspective);
		gl.uniform1f(aspectRef, canvas.width/canvas.height);
		gl.uniform1f(cameraZRef, cameraZ);
		
		for(let n in scene.nodes){
			renderNode(scene.nodes[n], model);
		}
		
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		
		renderTransparentPrimitives();
	}
	
	function renderSkybox(model, view, perspective){
		gl.useProgram(skyboxShaderProgram);
		gl.uniformMatrix4fv(skyboxViewRef, false, view);
		gl.uniform1f(skyboxAspectRef, canvas.width/canvas.height);
		
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
		gl.uniform1i(skyboxSkyboxSamplerRef, 1);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
		let coord = gl.getAttribLocation(skyboxShaderProgram, "coordinates");
		gl.vertexAttribPointer(coord, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(coord);
		
		gl.drawArrays(gl.TRIANGLES, 0, 2*3);
	}
	
	function renderNode(node, transform){
		let localTransform = multiplyMatrices(transform, node.matrix);
		//console.log(localTransform);
		if(node.mesh !== undefined){
			let mesh = meshes[node.mesh];
			for(let p in mesh.primitives){
				let primitive = mesh.primitives[p];
				
				if(primitive.material.alphaMode == "BLEND"){
					transparentPrimitives.push({
						transform: localTransform,
						primitive: primitive
					});
				} else {
					renderPrimitive(primitive, localTransform);
				}
			}
		}
		
		for(let c in node.children){
			renderNode(node.children[c], localTransform);
		}
	}
	
	function renderPrimitive(primitive, localTransform){
		gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalsBuffer);
		let normal = gl.getAttribLocation(shaderProgram, "vertexNormal");
		gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, primitive.normalByteStride, 0);
		gl.enableVertexAttribArray(normal);
		//if(normal == -1) console.error(normal);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, primitive.vertexBuffer);
		let coord = gl.getAttribLocation(shaderProgram, "coordinates");
		gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, primitive.positionByteStride, 0);
		gl.enableVertexAttribArray(coord);
		//if(coord == -1) console.error(coord);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, primitive.texCoordBuffer);
		let texCoord = gl.getAttribLocation(shaderProgram, "texCoord");
		gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, primitive.texCoordByteStride, 0);
		gl.enableVertexAttribArray(texCoord);
		//if(texCoord == -1) console.error(texCoord);
		
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textures[primitive.material.pbrMetallicRoughness.baseColorTexture.index]);
		gl.uniform1i(samplerRef, 0);
		
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
		gl.uniform1i(skyboxSamplerRef, 1);
		
		let color = primitive.material.pbrMetallicRoughness.baseColorFactor;
		gl.uniform4f(colorRef, color[0], color[1], color[2], color[3]);
		gl.uniform1f(shinyRef, 0.2);
		gl.uniform1f(emissiveRef, 0);
		
		gl.uniformMatrix4fv(modelRef, false, localTransform);
		let localNormalMatrix = normalMatrix(localTransform);
		gl.uniformMatrix4fv(normalTransformRef, false, localNormalMatrix);
		
		
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer);
		
		//console.log(gl.getProgramInfoLog(shaderProgram));
		
		//console.log(mesh.name);
		//console.log(primitive);
		gl.drawElements(gl.TRIANGLES, primitive.size, gl.UNSIGNED_SHORT, 0);
	}
	
	function renderTransparentPrimitives(){
		for(let i in transparentPrimitives){
			renderPrimitive(transparentPrimitives[i].primitive, transparentPrimitives[i].transform);
		}
		transparentPrimitives = [];
	}

	return{
		 addMesh: addMesh
		,addScene: addScene
		,addMaterial: addMaterial
		,addTexture: addTexture
		,loadSkybox: loadSkybox
		,render: render
	};

}