#version 300 es

precision mediump float;

uniform lowp vec4 color;

uniform highp mat4 model;
uniform highp mat4 view;
uniform highp mat4 perspective;

uniform samplerCube uSkyboxSampler;

in vec4 coord;

out vec4 fragColor;

void main(void){
    
    highp vec4 viewDirection = normalize(coord-vec4(0.0, 0.0, 2.0, 1.0));
    //viewDirection.x = -viewDirection.x;
	
	vec3 textureCoord = normalize(transpose(mat3(view))*viewDirection.xyz);
	
	textureCoord.x = -textureCoord.x;
	
    vec4 texColor = texture(uSkyboxSampler, textureCoord);
	
	fragColor = vec4(texColor.xyz, 1.0);
	//fragColor = vec4(0.0, 0.0, 0.0, 1.0);
	
}