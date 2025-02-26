#version 300 es

precision mediump float;

uniform lowp vec4 color;

uniform highp mat4 model;
uniform highp mat4 view;
uniform highp mat4 perspective;
uniform highp mat4 normalTransform;

in float fogness;

uniform lowp float shiny;
uniform lowp float emissive;
uniform lowp float cameraZ;

uniform sampler2D uSampler;
uniform samplerCube uSkyboxSampler;

vec3 fogColor = vec3(1.0, 1.0, 1.0);
vec3 lighting = vec3(0.0, 0.0, 0.0);

in vec3 normal;
in vec2 vTexCoord;
in vec4 coord;

out vec4 fragColor;

void main(void){

	highp vec3 ambientLight = vec3(0.22, 0.25, 0.3);
    highp vec3 directionalLightColor = vec3(1.0, 1.0, 0.9);
	highp vec4 directionalVec4 = normalize(vec4(0.0, 1.0, 1.0, 1.0));
    highp vec3 directionalVector = normalize(directionalVec4).xyz;
    highp vec3 localNormal = normalize(inverse(transpose(mat3(view))) * normal);
    
    highp mat3 normalizedView = inverse(transpose(mat3(view)));
    
    highp vec4 cameraLocation = vec4(0.0, 0.0, cameraZ, 1.0);
    
    //cameraLocation.z = cameraLocation.z + 1.0;
    
    highp vec4 localCamera = cameraLocation;
    
    vec4 localCoord = coord;
    localCoord.z = -1.0;
    
    highp vec4 viewDirection = normalize(localCoord-cameraLocation);
    
    vec3 vd = normalize(inverse(view)*viewDirection).xyz;
    
    //highp vec3 localViewDirection = normalize(inverse(transpose(mat3(view)))*viewDirection.xyz);
    
    highp vec3 reflectedDirection = normalize(reflect(vd, normal));
    //reflectedDirection = normalize(inverse(transpose(mat3(view)))*reflectedDirection);
    
    vec4 skybox = texture(uSkyboxSampler, vd);
    //vec4 skybox = texture(uSkyboxSampler, reflectedDirection);
    
    //vec4 texColor = texture(uSkyboxSampler, normal);

	//highp float directional = clamp(dot(directionalVector, localNormal), 0.0, 1.0);
	
    //lighting = ambientLight * 1.0 + (directionalLightColor * directional * 1.0);

	vec4 texColor = texture(uSampler, vTexCoord);
	
	texColor.rgb = mix(skybox.rgb, texColor.rgb, 0.1);

	//vec3 fColor = texColor.rgb * max(lighting, emissive);
	//fColor = mix(fColor, fogColor, fogness);
	
	//fragColor = vec4(fColor, texColor.a);
	//fragColor = vec4(texColor.rgb, texColor.a);
	
	fragColor = vec4(texColor.xyz, texColor.a);
	
	//fragColor = vec4(normalize(vec3(perspective*view*vec4(normal, 1.0))), 1.0);
	
}