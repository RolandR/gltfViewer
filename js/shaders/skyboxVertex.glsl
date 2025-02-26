#version 300 es

uniform highp mat4 model;
uniform highp mat4 view;
uniform highp mat4 perspective;
uniform highp mat4 normalTransform;
uniform float aspect;
uniform float maxDistance;

in vec2 coordinates;

out vec4 coord;

void main(void){
	
	vec4 coords = vec4(coordinates, 0.0, 1.0);

	//coords = perspective * view * model * coords;
	
	coord = coords;

	gl_Position = coords;
}