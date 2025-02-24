var fragmentShader = `
precision mediump float;

uniform lowp vec4 color;

uniform highp mat4 model;
uniform highp mat4 view;
uniform highp mat4 perspective;
uniform highp mat4 normalTransform;

varying float fogness;

uniform lowp float shiny;
uniform lowp float emissive;

uniform sampler2D uSampler;

vec3 fogColor = vec3(0.5, 0.3, 0.3);
vec3 lighting = vec3(0.0, 0.0, 0.0);

varying vec3 normal;
varying vec2 vTexCoord;

void main(void){

	highp vec3 ambientLight = vec3(0.22, 0.25, 0.3);
    highp vec3 directionalLightColor = vec3(1.0, 1.0, 0.9);
	highp vec4 directionalVec4 = vec4(-1.0, 1.0, 1.0, 1.0)*view*model;
    highp vec3 directionalVector = normalize(directionalVec4.xyz);
    highp vec3 viewVector = normalize(vec3(0.0, 0.0, 1.0));
    viewVector = (vec4(viewVector, 1.0)*model*perspective).xyz;

	highp float directional = dot(normalize(normal), directionalVector);
	
	float specular = min(dot(viewVector.xyz, reflect(directionalVector, normalize(normal))), 0.0);
	specular = pow(specular, 4.0)*shiny;
	
    lighting = ambientLight + (directionalLightColor * directional * 1.0) + (directionalLightColor * specular * 0.8);

	vec4 texColor = texture2D(uSampler, vTexCoord);

	vec3 fColor = texColor.rgb * max(lighting, emissive);
	fColor = mix(fColor, fogColor, fogness);
	gl_FragColor = vec4(fColor, 1.0);
	
}
`;