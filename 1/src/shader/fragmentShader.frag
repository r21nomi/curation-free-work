precision mediump float;

const float PI = 3.1415926535897932384626433832795;

uniform vec2 resolution;
uniform float time;
uniform sampler2D texture;
uniform vec2 textureResolution;

varying float vIndex;
varying float vTotalIndex;
varying vec2 vUv;
varying vec3 vColor;
varying vec2 vResolution;
varying float vDirection;
varying float vRatio;
varying vec2 vWeight;

#define PI acos(-1.0)
#define ITER 64.0

struct obj{
    float d;
    vec3 c_shadow;
    vec3 c_light;
};

mat2 rot(float a) {
    return mat2(cos(a), sin(a), -sin(a), cos(a));
}

vec2 getUV() {
    vec2 uv = (vUv.xy * vResolution * 2.0 - vResolution.xy) / min(vResolution.x, vResolution.y);
    return uv;
}

float atan2(float y, float x){
    return x == 0.0 ? sign(y) * PI / 2.0 : atan(y, x);
}

float radian(float degree) {
    return degree * PI / 180.0;
}

vec2 round(vec2 p) {
    return floor(p + 0.5);
}

vec2 crep(vec2 p, float c, float l) {
    return p - c * clamp(round(p / c), -l, l);
}

vec2 repetition(vec2 p, float c) {
    return p - c * round(p / c);
}

vec2 getWorldUV() {
    vec2 weight = (vWeight * resolution * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
    return weight;
}

float sdCappedCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(h,r);
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdSphere(vec3 p, float s) {
    return length(p) - s;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz)-t.x,p.y);
    return length(q)-t.y;
}

float box(vec3 p, vec3 c) {
    vec3 q = abs(p) - c;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float getId() {
    return floor(mod(vIndex, 4.0));
}

vec3 getBGColor() {
    float id = getId();
    vec3 col = vec3(0.0);
    vec3 col2 = vec3(0.0);

    if (id == 0.0 || id == 2.0) {
        col = vec3(1.0, 0.01, 0.01);
        col2 = vec3(0.9, 0.3, 0.1);
    } else {
        col = vec3(0.01, 0.01, 1.0);
        col2 = vec3(0.0, 0.3, 0.9);
    }
    vec2 uv = getUV();

    col = mix(col2, col, length(uv.y));

    return col;
}

float ease(float x) {
    float contrast = 8.0; //4.0,8.0,16.0
    return 1.0 / (1.0 + exp(-contrast * (x - 0.5)));
}

obj prim(vec3 p) {
    float id = getId();

    // primitive
    float velocity = 1.0 - ease(cos(time * 2.0 + radian(270.0 * id)));
//    velocity = 0.2;
    float size = velocity * 0.25;
//    p.y += cos(radian(velocity * 360.0)) * 0.03;
//    p.y -= 0.3;
//    p.xy = crep(p.xy, size * 3.0, 3.0);
//    p.z -= time * 0.2;
//    p.xz = repetition(p.xz, size * 2.5);
    float d1 = sdSphere(p, size);
//    d1 = sdTorus(p, vec2(size, size * 0.4));
//    d1 = sdCappedCylinder(p, size, size);
    float d = d1;

    vec3 shadow = vec3(0.0);
    vec3 light = vec3(0.0);

    if (id == 0.0 || id == 2.0) {
        shadow = vec3(0.3, 0.0, 1.0);
        light = vec3(0.0, 1.0, 0.0);
    } else {
        shadow = vec3(0.6, 0.2, 0.3);
        light = vec3(1.0, 1.0, 0.0);
    }

    vec3 bgColor = getBGColor();

    float alphaThreshold = 0.8;
    shadow = mix(shadow, bgColor, step(alphaThreshold, velocity));
    light = mix(light, bgColor, step(alphaThreshold, velocity));

    return obj(d, shadow, light);
}

obj SDF(vec3 p) {
    vec3 pp = vec3(0.0);
    vec2 worldUV = getWorldUV();
    float r = 30.0;
//    p.xz *= rot(radian(time * 1.0));
//    p.yz *= rot(radian(5.0));

    obj scene = prim(p + vec3(0.0));
    return scene;
}

vec3 getNorm(vec3 p) {
    vec2 eps = vec2(0.001, 0.0);
    return normalize(SDF(p).d - vec3(SDF(p - eps.xyy).d, SDF(p - eps.yxy).d, SDF(p - eps.yyx).d));
}

void main() {
    vec2 uv = getUV();

    bool isHit = false;
    vec3 ro  = vec3(uv * 0.2, -1.0),
    rd  = vec3(0.0, 0.0, 1.0),
    p   = ro,
    col = getBGColor(),
    l   = normalize(vec3(1.0, 2.0, -2.0));
    obj o;

    for (float i = 0.0; i < ITER; i++) {
        vec3 p2 = p;
        o = SDF(p);
        if (o.d < 0.001) {
            isHit = true;
            break;
        }
        p += o.d * rd;
    }

    if (isHit) {
        vec3 n = getNorm(p);
        float lighting = max(dot(n, l), 0.0);
        col = mix(o.c_shadow, o.c_light, lighting);
    }

    vec3 color = vec3(sqrt(col));

    gl_FragColor = vec4(color, 1.0);
}