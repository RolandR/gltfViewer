#version 300 es

precision mediump float;

uniform lowp vec4 color;

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

in vec3 normal;
in vec2 vTexCoord;
in vec4 coord;
in mat4 normalTransform;

out vec4 fragColor;

void main(void){
	
	/*float toime = time*0.005;
	mat4 timeRotation = mat4(
		cos(toime), 0.0, sin(toime), 0.0,
		0.0, 1.0, 0.0, 0.0,
		-sin(toime), 0.0, cos(toime), 0.0,
		0.0, 0.0, 0.0, 1.0
	);*/
	
	highp vec3 ambientLight = vec3(0.22, 0.25, 0.3);
    highp vec4 directionalLightColor = vec4(0.99, 0.99, 0.99, 1.0);
	highp vec4 directionalVec4 = normalize(vec4(0.0, 1.0, 1.0, 1.0));
	
    highp vec3 directionalVector = normalize(directionalVec4).xyz;
    
    /*float textureNormalIntensity = 10.0;
    
    vec3 textureNormal = texture(uNormalSampler, vTexCoord).xyz;
    textureNormal = textureNormal*2.0 - 1.0;
    textureNormal.xy = textureNormal.xy * textureNormalIntensity;
    textureNormal = normalize(textureNormal);*/
    //textureNormal = normalize(normalTransform * vec4(textureNormal, 0.0)).xyz;
    //vec3 normalFromTexture = normalize(normal);
    //vec3 normalFromTexture = normalize(textureNormal);
        
    highp vec4 cameraLocation = vec4(0.0, 0.0, cameraZ, 1.0);
    
    vec4 localCoord = coord;
    localCoord.z = 0.0; // todo: this doesn't quite work with perspective
    
    highp vec4 viewDirection = normalize(localCoord-cameraLocation);
    
    vec3 vd = normalize(inverse(view)*viewDirection).xyz;
    
    highp vec3 reflectedDirection = normalize(reflect(vd, normal));
    
    vec4 skybox = textureLod(uSkyboxSampler, reflectedDirection, mix(1.0, 8.0, roughness));
    
    vec4 ambient = textureLod(uSkyboxSampler, normal, 8.0);

	highp float directional = clamp(dot(directionalVector, normal)*1.0, 0.0, 1.0);

	vec4 texColor = texture(uSampler, vTexCoord);
	//vec4 texColor = vec4(0.5, 0.5, 0.5, 1.0);
	
	
	vec4 outColor = texColor*ambient*0.5 + directional*directionalLightColor*texColor*1.0;
	
	outColor = mix(outColor, skybox, metallic);
	
	float alpha = mix(texColor.a, skybox.a, metallic);

	//vec3 fColor = texColor.rgb * max(lighting, emissive);
	//fColor = mix(fColor, fogColor, fogness);
	
	//fragColor = vec4(outColor.rgb, texColor.a);
	fragColor = vec4(outColor.rgb, alpha);
	
}