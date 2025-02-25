



var vertexShader = `#version 300 es

uniform highp mat4 model;
uniform highp mat4 view;
uniform highp mat4 perspective;
uniform highp mat4 normalTransform;
uniform float aspect;
uniform float maxDistance;

in vec3 coordinates;
in vec3 vertexNormal;
in vec2 texCoord;

out highp vec3 lighting;
out float fogness;
out vec3 normal;
out vec2 vTexCoord;

void main(void){
	
	normal = normalize(normalTransform * vec4(vertexNormal, 1.0)).xyz;
	vTexCoord = texCoord;
	
	vec4 coords = vec4(coordinates, 1.0);

	coords = perspective * view * model * coords;
	
	fogness = clamp(length(coords)/maxDistance, 0.0, 1.0);

	gl_Position = coords;
}

`;