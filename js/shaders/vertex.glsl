#version 300 es

uniform highp mat4 model;
uniform highp mat4 nodeModel;
uniform highp mat4 view;
uniform highp mat4 perspective;
uniform float aspect;
uniform float maxDistance;

in vec3 coordinates;
in vec3 vertexNormal;
in vec2 texCoord;

out highp vec3 lighting;
out float fogness;
out vec3 normal;
out vec2 vTexCoord;
out vec4 coord;

void main(void){
	
	mat4 models = model * nodeModel;
	
	mat4 normalTransform = inverse(transpose(models));
	
	normal = normalize(normalTransform * vec4(vertexNormal, 0.0)).xyz;
	vTexCoord = texCoord;
	
	vec4 coords = vec4(coordinates, 1.0);

	coords = perspective * view * models * coords;
	//coords.w = (coords.z+1.0)/2.0;
	
	fogness = clamp(length(coords)/maxDistance, 0.0, 1.0);
	
	coord = coords;

	gl_Position = coords;
}