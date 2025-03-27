// (mostly) faithful port of https://godotshaders.com/shader/vhs-and-crt-monitor-effect/ to p5js
// nearly everything here is by pend00, go check them out!
// i just removed the rolling, and made it work on p5js

#ifdef GL_ES
precision lowp float;
#endif

varying vec2 vTexCoord;
uniform sampler2D tex;

uniform float uTime;

uniform bool enabled;

uniform float scanlines_opacity;
uniform float scanlines_width;
uniform float grille_opacity;
uniform vec2 resolution; // Set the number of rows and columns the texture will be divided in. Scanlines and grille will make a square based on these values

uniform bool pixelate; // Fill each square ("pixel") with a sampled color, creating a pixel look and a more accurate representation of how a CRT monitor would work.

uniform float noise_opacity;
uniform float noise_speed; // There is a movement in the noise pattern that can be hard to see first. This sets the speed of that movement.

uniform float static_noise_intensity;

uniform float aberration; // Chromatic aberration, a distortion on each color channel.
uniform float brightness; // When adding scanline gaps and grille the image can get very dark. Brightness tries to compensate for that.
uniform bool discolor; // Add a discolor effect simulating a VHS

uniform float warp_amount; // Warp the texture edges simulating the curved glass of a CRT monitor or old TV.
uniform bool clip_warp;

uniform float vignette_intensity; // Size of the vignette, how far towards the middle it should go.
uniform float vignette_opacity;

// Used by the noise functin to generate a pseudo random value between 0.0 and 1.0
vec2 random(vec2 uv) {
    uv = vec2(dot(uv, vec2(127.1, 311.7)),
    dot(uv, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(uv) * 43758.5453123);
}

// Generate a Perlin noise used by the distortion effects
float noise(vec2 uv) {
    vec2 uv_index = floor(uv);
    vec2 uv_fract = fract(uv);

    vec2 blur = smoothstep(0.0, 1.0, uv_fract);

    return mix(mix(dot(random(uv_index + vec2(0.0, 0.0)), uv_fract - vec2(0.0, 0.0)),
                   dot(random(uv_index + vec2(1.0, 0.0)), uv_fract - vec2(1.0, 0.0)), blur.x),
               mix(dot(random(uv_index + vec2(0.0, 1.0)), uv_fract - vec2(0.0, 1.0)),
                   dot(random(uv_index + vec2(1.0, 1.0)), uv_fract - vec2(1.0, 1.0)), blur.x), blur.y) * 0.5 + 0.5;
}

// Takes in the UV and warps the edges, creating the spherized effect
vec2 warp(vec2 uv) {
    vec2 delta = uv - 0.5;
    float delta2 = dot(delta.xy, delta.xy);
    float delta4 = delta2 * delta2;
    float delta_offset = delta4 * warp_amount;

    return uv + delta * delta_offset;
}

// Adds a black border to hide stretched pixel created by the warp effect
float border(vec2 uv) {
    float radius = min(warp_amount, 0.08);
    radius = max(min(min(abs(radius * 2.0), abs(1.0)), abs(1.0)), 1e-5);
    vec2 abs_uv = abs(uv * 2.0 - 1.0) - vec2(1.0, 1.0) + radius;
    float dist = length(max(vec2(0.0), abs_uv)) / radius;
    float square = smoothstep(0.96, 1.0, dist);
    return clamp(1.0 - square, 0.0, 1.0);
}

// Adds a vignette shadow to the edges of the image
float vignette(vec2 uv) {
    uv *= 1.0 - uv.xy;
    float vignette = uv.x * uv.y * 15.0;
    return pow(vignette, vignette_intensity * vignette_opacity);
}

void main()
{
    if (enabled) {
        vec2 uv = warp(vTexCoord); // Warp the uv. uv will be used in most cases instead of UV to keep the warping
        vec2 text_uv = uv;

        // Pixelate the texture based on the given resolution.
        if (pixelate)
        {
            text_uv = ceil(uv * resolution) / resolution;
        }

        vec4 text;

        text.r = texture2D(tex, text_uv + vec2(aberration, 0.0) * .1).r;
        text.g = texture2D(tex, text_uv - vec2(aberration, 0.0) * .1).g;
        text.b = texture2D(tex, text_uv).b;
        text.a = 1.0;

        float r = text.r;
        float g = text.g;
        float b = text.b;

        uv = warp(vTexCoord);

        // CRT monitors don't have pixels but groups of red, green and blue dots or lines, called grille. We isolate the texture's color channels
        // and divide it up in 3 offsetted lines to show the red, green and blue colors next to each other, with a small black gap between.
        if (grille_opacity > 0.0) {

            float g_r = smoothstep(0.85, 0.95, abs(sin(uv.x * (resolution.x * 3.14159265))));
            r = mix(r, r * g_r, grille_opacity);

            float g_g = smoothstep(0.85, 0.95, abs(sin(1.05 + uv.x * (resolution.x * 3.14159265))));
            g = mix(g, g * g_g, grille_opacity);

            float b_b = smoothstep(0.85, 0.95, abs(sin(2.1 + uv.x * (resolution.x * 3.14159265))));
            b = mix(b, b * b_b, grille_opacity);

        }

        // Apply the grille to the texture's color channels and apply Brightness. Since the grille and the scanlines (below) make the image very dark you
        // can compensate by increasing the brightness.
        text.r = clamp(r * brightness, 0.0, 1.0);
        text.g = clamp(g * brightness, 0.0, 1.0);
        text.b = clamp(b * brightness, 0.0, 1.0);

        // Scanlines are the horizontal lines that make up the image on a CRT monitor.
        // Here we are actual setting the black gap between each line, which I guess is not the right definition of the word, but you get the idea
        float scanlines = 0.5;
        if (scanlines_opacity > 0.0)
        {
            // Same technique as above, create lines with sine and applying it to the texture. Smoothstep to allow setting the line size.
            scanlines = smoothstep(scanlines_width, scanlines_width + 0.5, abs(sin(uv.y * (resolution.y * 3.14159265))));
            text.rgb = mix(text.rgb, text.rgb * vec3(scanlines), scanlines_opacity);
        }

        // Apply static noise by generating it over the whole screen in the same way as above
        if (static_noise_intensity > 0.0)
        {
            text.rgb += clamp(random((ceil(uv * resolution) / resolution) + fract(uTime)).x, 0.0, 1.0) * static_noise_intensity;
        }

        // Apply a black border to hide imperfections caused by the warping.
        // Also apply the vignette
        text.rgb *= border(uv);
        text.rgb *= vignette(uv);
        // Hides the black border and make that area transparent. Good if you want to add the the texture on top an image of a TV or monitor.
        if (clip_warp)
        {
            text.a = border(uv);
        }

        // Apply discoloration to get a VHS look (lower saturation and higher contrast)
        // You can play with the values below or expose them in the Inspector.
        float saturation = 0.5;
        float contrast = 1.2;
        if (discolor)
        {
            // Saturation
            vec3 greyscale = vec3(text.r + text.g + text.b) / 3.;
            text.rgb = mix(text.rgb, greyscale, saturation);

            // Contrast
            float midpoint = pow(0.5, 2.2);
            text.rgb = (text.rgb - vec3(midpoint)) * contrast + midpoint;
        }

        gl_FragColor = text;
    } else {
        gl_FragColor = texture2D(tex, vTexCoord);
    }
}
