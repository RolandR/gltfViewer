



var vertexShader = `

uniform highp mat4 model;
uniform highp mat4 view;
uniform highp mat4 perspective;
uniform highp mat4 normalTransform;
uniform float aspect;
uniform float maxDistance;

attribute vec3 coordinates;
attribute vec3 vertexNormal;

varying highp vec3 lighting;
varying float fogness;
varying vec3 normal;

void main(void){
	
	normal = vertexNormal;
	
	vec4 coords = vec4(coordinates, 1.0);

	coords = perspective * view * model * coords;
	
	fogness = clamp(length(coords)/maxDistance, 0.0, 1.0);

	gl_Position = coords;
}

`;