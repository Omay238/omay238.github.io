let pg, pgf, shaderProgram;

let emuSize = [640, 480];

let shaderConfig = {
    enabled: true,

    scanlines_opacity: 0.4,
    scanlines_width: 0.25,
    grille_opacity: 0.1,
    resolution: emuSize, // Set the number of rows and columns the texture will be divided in. Scanlines and grille will make a square based on these values

    pixelate: false, // Fill each square ("pixel") with a sampled color, creating a pixel look and a more accurate representation of how a CRT monitor would work.

    noise_opacity: 0.02,
    noise_speed: 5.0, // There is a movement in the noise pattern that can be hard to see first. This sets the speed of that movement.

    static_noise_intensity: 0.02,

    aberration: 0.00, // Chromatic aberration, a distortion on each color channel.
    brightness: 1.2, // When adding scanline gaps and grille the image can get very dark. Brightness tries to compensate for that.
    discolor: false, // Add a discolor effect simulating a VHS

    warp_amount: 0.5, // Warp the texture edges simulating the curved glass of a CRT monitor or old TV.
    clip_warp: false,

    vignette_intensity: 0.4, // Size of the vignette, how far towards the middle it should go.
    vignette_opacity: 0.5
}

let animation = "on";
let animationStart = -Infinity;

let bgimg, arrowimg, pointerimg;

let activeCursor = "arrow";

let font;

let items = {
    "Home": {
        children: {
            "Power Off": {
                render: () => {

                },
                onClick: () => {
                    animation = "off";
                }
            }
        },
        render: (hovered) => {

        }
    }
}

function prepare() {
    let w = innerWidth;
    let h = w / (emuSize[0] / emuSize[1]);
    if (h > innerHeight) {
        h = innerHeight;
        w = h * (emuSize[0] / emuSize[1]);
    }
    return [w, h];
}

function easeOutCirc(x) {
    return Math.sqrt(1 - Math.pow(x - 1, 2));
}

function preload() {
    shaderProgram = loadShader('shaders/crt.vert', 'shaders/crt.frag');
    bgimg = loadImage('images/background.png');
    arrowimg = loadImage('images/arrow.png');
    pointerimg = loadImage('images/pointer.png');
    font = loadFont('fonts/VCR_OSD_MONO.ttf');
}

function setup() {
    let [w, h] = prepare();

    createCanvas(w, h, WEBGL);
    pgf = createGraphics(w, h);
    pg = createGraphics(emuSize[0], emuSize[1]);
    pg.noSmooth();
    pgf.noSmooth();

    animationStart = millis() + 1000;

    noCursor();
    angleMode(DEGREES);

    pg.textFont(font, 15);
}

function draw() {
    // scale mouse for future usage
    smouseX = round(mouseX * (emuSize[0] / width));
    smouseY = round(mouseY * (emuSize[1] / height));

    // wow the background i made is just so good guys
    pg.image(bgimg, 0, 0);


    // all the rendering stuff should go here
    pg.fill(192)
    pg.rect(0, emuSize[1] - 32, emuSize[0], 32)

    // mouse
    if (activeCursor === "arrow") {
        pg.image(arrowimg, smouseX, smouseY);
    } else if (activeCursor === "pointer") {
        pg.image(pointerimg, smouseX - 6, smouseY); // offset because the pointer finger is to the right in the image
    }


    // on/off animation
    let progress;

    pg.noStroke();
    pg.fill(0);

    if (animation === "on") {
        progress = easeOutCirc((millis() - animationStart) / 1000);

        if (millis() - animationStart > 1000) {
            animation = "none";
        }
    } else if (animation === "off") {
        progress = 1 - easeOutCirc((millis() - animationStart) / 1000);

        if (millis() - animationStart > 1000) {
            window.close()
        }
    }

    if (animation === "on" || animation === "off") {
        pg.rect(0, 0, emuSize[0], emuSize[1] * 0.5 * (1 - progress));
        pg.rect(0, emuSize[1] * 0.5 * (progress + 1), emuSize[0], emuSize[1] * 0.5);
        pg.fill(0, 255 - progress * 255)
        pg.rect(0, 0, emuSize[0], emuSize[1]);
    }


    // copy to pgf buffer
    pgf.image(pg, 0, 0, width, height);


    // do all the shader stuff
    shader(shaderProgram);
    shaderProgram.setUniform('tex', pgf);
    shaderProgram.setUniform('uTime', millis() / 1000);

    for (let i = 0; i < Object.keys(shaderConfig).length; i++) {
        shaderProgram.setUniform(Object.keys(shaderConfig)[i], Object.values(shaderConfig)[i]);
    }


    // i really don't know what i'm doing
    noStroke();
    beginShape();
    vertex(-1, -1, 0, 0, 1);
    vertex(1, -1, 0, 1, 1);
    vertex(1, 1, 0, 1, 0);
    vertex(-1, 1, 0, 0, 0);
    endShape(CLOSE);
}

function windowResized() {
    let [w, h] = prepare();
    resizeCanvas(w, h);
    pgf.resizeCanvas(width, height);
}