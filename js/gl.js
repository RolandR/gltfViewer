
function Renderer(canvas, shaderTexts, options){
	
	const gl = canvas.getContext("webgl2", {premultipliedAlpha: true, preserveDrawingBuffer: false});

	let shaderProgram;
	let skyboxShaderProgram;
	
	let size;
	
	let isReady = false;
	
	let scene = null;
	const meshes = [];
	const materials = [];
	const textures = [];
	
	let transparentPrimitives = [];

	let modelRef;
	let nodeModelRef;
	let viewRef;
	let perspectiveRef;
	let normalTransformRef;
	let aspectRef;
	let colorRef;
	let roughnessRef;
	let metallicRef;
	let cameraZRef;
	let timeRef;
	
	let cameraZ = 1.8;
	
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
		nodeModelRef = gl.getUniformLocation(shaderProgram, "nodeModel");
		viewRef = gl.getUniformLocation(shaderProgram, "view");
		perspectiveRef = gl.getUniformLocation(shaderProgram, "perspective");
		normalTransformRef = gl.getUniformLocation(shaderProgram, "normalTransform");
		aspectRef = gl.getUniformLocation(shaderProgram, "aspect");
		colorRef = gl.getUniformLocation(shaderProgram, "color");
		cameraZRef = gl.getUniformLocation(shaderProgram, "cameraZ");
		timeRef = gl.getUniformLocation(shaderProgram, "time");
		
		emissiveRef = gl.getUniformLocation(shaderProgram, "emissive");
		roughnessRef = gl.getUniformLocation(shaderProgram, "roughness");
		metallicRef = gl.getUniformLocation(shaderProgram, "metallic");
		samplerRef = gl.getUniformLocation(shaderProgram, "uSampler");
		normalSamplerRef = gl.getUniformLocation(shaderProgram, "uNormalSampler");
		skyboxSamplerRef = gl.getUniformLocation(shaderProgram, "uSkyboxSampler");
		
		/*   Skybox shader   */
		
		if(options.showSkybox){
			
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
		
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxUp);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxDn);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxRt);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxLf);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxFt);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, skyboxBk);
		
		gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
	}
	
	function addMesh(mesh){
		let primitives = [];
		
		for(let p in mesh.primitives){
			
			let vertices = mesh.primitives[p].positionView;
			let normals = mesh.primitives[p].normalView;
			let indices = mesh.primitives[p].indexView;
			let texCoords = mesh.primitives[p].texCoordView;
			
			let size = indices.length;
			
			let primitive = {
				 vertices: vertices
				,normals: normals
				,indices: indices
				,indexComponentType: mesh.primitives[p].indexComponentType
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
			gl.vertexAttribPointer(
				coord,
				3,
				mesh.primitives[p].positionComponentType,
				// ^^^ This works because the values specified in the GLTF standard
				//     correspond exactly to the WebGL enum values
				false,
				mesh.primitives[p].positionByteStride,
				0
			);
			gl.enableVertexAttribArray(coord);
			if(coord == -1) console.error(coord);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalsBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, primitive.normals, gl.STATIC_DRAW);
			let normal = gl.getAttribLocation(shaderProgram, "vertexNormal");
			gl.vertexAttribPointer(
				normal,
				3,
				mesh.primitives[p].normalComponentType,
				false,
				mesh.primitives[p].normalByteStride,
				0
			);
			gl.enableVertexAttribArray(normal);
			if(normal == -1) console.error(primitive);
			
			gl.bindBuffer(gl.ARRAY_BUFFER, primitive.texCoordBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, primitive.texCoords, gl.STATIC_DRAW);
			let texCoord = gl.getAttribLocation(shaderProgram, "texCoord");
			gl.vertexAttribPointer(
				texCoord,
				2,
				mesh.primitives[p].texCoordComponentType,
				false,
				mesh.primitives[p].texCoordByteStride,
				0
			);
			gl.enableVertexAttribArray(texCoord);
			if(texCoord == -1) console.error(texCoord);
			
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
	
	function addMaterial(material, id){
		materials[id] = material;
	}
	
	function addScene(s){
		scene = s;
	}
	
	function addTexture(tex){
		textures[tex.id] = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, textures[tex.id]);
		
		let type = gl.RGBA;
		if(tex.type == "normal"){
			type = gl.RGB;
		}
		
		if(tex.isFakeTexture){
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				type,
				1,
				1,
				0,
				type,
				gl.UNSIGNED_BYTE,
				tex.img
			);
		} else {
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				type,
				//tex.img.width,
				//tex.img.height,
				//0,
				type,
				gl.UNSIGNED_BYTE,
				tex.img
			);
		}
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, tex.samp.minFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, tex.samp.magFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, tex.samp.wrapS);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, tex.samp.wrapT);
		
	}
	
	function render(model, view, perspective){
		
		if(!isReady){
			return false;
		}

		// Clear the canvas
		gl.clearColor(0, 0, 0, 1);
		
		gl.viewport(0, 0, canvas.width, canvas.height);
		
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);
		gl.enable(gl.DEPTH_TEST);

		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		
		gl.disable(gl.BLEND);
		
		if(options.showSkybox){
			gl.disable(gl.DEPTH_TEST);
			renderSkybox(model, view, perspective);
			gl.enable(gl.DEPTH_TEST);
		}
		
		gl.useProgram(shaderProgram);
		
		gl.uniform1f(maxDistanceRef, 8.0);
		
		gl.uniform1f(timeRef, performance.now());
		
		gl.uniformMatrix4fv(modelRef, false, model);
		gl.uniformMatrix4fv(viewRef, false, view);
		gl.uniformMatrix4fv(perspectiveRef, false, perspective);
		gl.uniform1f(aspectRef, canvas.width/canvas.height);
		gl.uniform1f(cameraZRef, cameraZ);
		
		for(let n in scene.nodes){
			renderNode(scene.nodes[n]);
		}
		
		gl.enable(gl.BLEND);
		//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.blendFunc(gl.SRC_COLOR, gl.DST_COLOR);
		
		renderTransparentPrimitives();
	}
	
	function renderSkybox(model, view, perspective){
		gl.useProgram(skyboxShaderProgram);
		gl.uniformMatrix4fv(skyboxViewRef, false, view);
		gl.uniform1f(skyboxAspectRef, canvas.width/canvas.height);
		
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
		gl.uniform1i(skyboxSkyboxSamplerRef, 0);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, skyboxVertexBuffer);
		let coord = gl.getAttribLocation(skyboxShaderProgram, "coordinates");
		gl.vertexAttribPointer(coord, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(coord);
		
		gl.drawArrays(gl.TRIANGLES, 0, 2*3);
	}
	
	function renderNode(node){
		
		if(node.mesh !== undefined){
			let mesh = meshes[node.mesh];
			for(let p in mesh.primitives){
				let primitive = mesh.primitives[p];
				
				if(primitive.material.alphaMode == "BLEND"){
					transparentPrimitives.push({
						transform: node.matrix,
						primitive: primitive
					});
				} else {
					renderPrimitive(primitive, node.matrix);
				}
			}
		}
		
		for(let c in node.children){
			renderNode(node.children[c]);
		}
	}
	
	function renderPrimitive(primitive, transform){

		
		
		if(primitive.material.name.match(/^Luft(.\d{3})?$/)
		|| primitive.material.name.match(/^Farbe, gelb(.\d{3})?$/)
		|| primitive.material.name.match(/^Farbe, blau(.\d{3})?$/)
		|| primitive.material.name.match(/^Farbe, schwarz(.\d{3})?$/)
		|| primitive.material.name.match(/^Farbe, weiss(.\d{3})?$/)
		){
			return false;
		}
		
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
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTexture);
		gl.uniform1i(skyboxSamplerRef, 0);
		
		if(primitive.material.pbrMetallicRoughness.baseColorTexture){
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, textures[primitive.material.pbrMetallicRoughness.baseColorTexture.index]);
			gl.uniform1i(samplerRef, 1);
		}
		
		if(primitive.material.pbrMetallicRoughness.normalTexture){
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, textures[primitive.material.normalTexture.index]);
			gl.uniform1i(normalSamplerRef, 2);
		}
		
		let color = primitive.material.pbrMetallicRoughness.baseColorFactor;
		gl.uniform4f(colorRef, color[0], color[1], color[2], color[3]);
		gl.uniform1f(roughnessRef, primitive.material.pbrMetallicRoughness.roughnessFactor);
		gl.uniform1f(metallicRef, primitive.material.pbrMetallicRoughness.metallicFactor);
		gl.uniform1f(emissiveRef, 0);
		
		gl.uniformMatrix4fv(nodeModelRef, false, transform);
		
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer);
		
		gl.drawElements(
			gl.TRIANGLES,
			primitive.size,
			primitive.indexComponentType,
			0
		);
	}
	
	function renderTransparentPrimitives(){
		for(let i in transparentPrimitives){
			renderPrimitive(transparentPrimitives[i].primitive, transparentPrimitives[i].transform);
		}
		transparentPrimitives = [];
	}
	
	function setReady(value){
		isReady = value;
	}
	
	return{
		 addMesh: addMesh
		,addScene: addScene
		,addMaterial: addMaterial
		,addTexture: addTexture
		,loadSkybox: loadSkybox
		,render: render
		,setReady: setReady
	};

}