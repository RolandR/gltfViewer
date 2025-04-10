#version 300 es

precision mediump float;

uniform highp mat4 model;
uniform highp mat4 view;
uniform highp mat4 perspective;

in float fogness;

uniform lowp float roughness;
uniform lowp float metallic;
uniform lowp float emissive;
uniform lowp float cameraZ;

uniform highp float time;

uniform sampler2D uSampler;
uniform sampler2D uNormalSampler;
uniform samplerCube uSkyboxSampler;

vec3 fogColor = vec3(1.0, 1.0, 1.0);
vec3 lighting = vec3(0.0, 0.0, 0.0);

in lowp vec3 vColor;
in vec3 normal;
in vec2 vTexCoord;
in vec4 coord;
in mat4 normalTransform;

out vec4 fragColor;

void main(void){
	
	highp vec3 ambientLight = vec3(0.22, 0.25, 0.3);
    highp vec4 directionalLightColor = vec4(0.99, 0.99, 0.99, 1.0);
	highp vec4 directionalVec4 = normalize(vec4(0.0, 1.0, 1.0, 1.0));
	
    highp vec3 directionalVector = normalize(directionalVec4).xyz;
        
    highp vec4 cameraLocation = vec4(0.0, 0.0, cameraZ, 1.0);
    
    vec4 localCoord = coord;
    localCoord.z = 0.0; // todo: this doesn't quite work with perspective
    
    highp vec4 viewDirection = normalize(localCoord-cameraLocation);
    
    vec3 vd = normalize(inverse(view)*viewDirection).xyz;
    
    highp vec3 reflectedDirection = normalize(reflect(vd, normal));
    
    vec4 ambient = vec4(0.8, 0.8, 0.8, 1.0);

	highp float directional = clamp(dot(directionalVector, normal)*1.0, 0.0, 1.0);

	//vec4 texColor = texture(uSampler, vTexCoord);
	vec4 texColor = vec4(vColor, 1.0);
	
	
	vec4 outColor = texColor*ambient*0.8 + directional*directionalLightColor*texColor*1.0;

	//vec3 fColor = texColor.rgb * max(lighting, emissive);
	//fColor = mix(fColor, fogColor, fogness);
	
	//fragColor = vec4(outColor.rgb, texColor.a);
	fragColor = vec4(outColor.rgb, 1.0);
	
	//fragColor = vec4(1.0, metallic, 0.0, texColor.a);
	
}