#ifdef GL_ES
precision lowp float;
#endif

attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

void main() {
    vTexCoord = vec2(aTexCoord.x, aTexCoord.y);
    gl_Position = vec4(aPosition, 1.0);
}
