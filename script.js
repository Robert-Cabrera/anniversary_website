document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    initLottieEmojis();
    initFadeInObserver();
    setupFractalCanvas();
});

// === LOTTIE EMOJI HANDLING ===
function initLottieEmojis() {
    const emojiContainers = document.querySelectorAll('.tgs-emoji');

    emojiContainers.forEach(container => {
        const anim = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: true,
            autoplay: false,
            path: container.dataset.src
        });

        anim.addEventListener('DOMLoaded', () => {
            // Override inline width/height in <svg>
            const svg = container.querySelector('svg');
            if (svg) {
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                svg.style.width = '100%';
                svg.style.height = '100%';
            }
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    anim.play();
                } else {
                    anim.goToAndStop(0, true);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(container);
    });
}


// === FADE-IN ANIMATIONS ===
function initFadeInObserver() {
    const sections = document.querySelectorAll('.fullscreen-section');

    if (sections.length === 0) return;

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15
    });

    sections.forEach(section => observer.observe(section));
}

// === FRACTAL CANVAS SETUP ===
function setupFractalCanvas() {
    const canvas = document.getElementById('fractal-canvas');
    if (!canvas) return console.error('Canvas element not found!');

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    setupInteractiveFractal({
        canvas,
        formula: annieFormula,
        colorFn: annieColor,
        maxIterations: 70,
        colorOffset: 180,
        initialScale: 0.4
    });

    
}

// === INTERACTIVE FRACTAL RENDERING ===
function setupInteractiveFractal({
    canvas,
    formula = annieFormula,
    colorFn = annieColor,
    maxIterations = 100,
    colorOffset = 0,
    initialScale = 3,
    centerX = -0.05,
    centerY = 0.005,
    formulaParams = {}
}) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;

    let scale = initialScale;
    let offsetX = centerX;
    let offsetY = centerY;

    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let lastOffset = { x: offsetX, y: offsetY };
    let lastTouchDist = null;

    function render() {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let px = 0; px < width; px++) {
            for (let py = 0; py < height; py++) {
                const x0 = offsetX + (px - width / 2) * (scale / width);
                const y0 = offsetY + (py - height / 2) * (scale / height);

                const iter = formula(x0, y0, maxIterations, formulaParams);
                const [r, g, b] = colorFn(iter, maxIterations, x0, y0, colorOffset);

                const idx = 4 * (py * width + px);
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    function zoom(factor, cx, cy) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = cx - rect.left;
        const canvasY = cy - rect.top;

        const x = offsetX + (canvasX - width / 2) * (scale / width);
        const y = offsetY + (canvasY - height / 2) * (scale / height);
        scale *= factor;
        offsetX = x - (canvasX - width / 2) * (scale / width);
        offsetY = y - (canvasY - height / 2) * (scale / height);
        render();
    }

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        zoom(e.deltaY > 0 ? 1.1 : 0.9, e.clientX, e.clientY);
    });

    canvas.addEventListener('mousedown', e => {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        lastOffset = { x: offsetX, y: offsetY };
    });

    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', e => {
        if (!isDragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        offsetX = lastOffset.x - dx * (scale / width);
        offsetY = lastOffset.y - dy * (scale / height);
        render();
    });

    canvas.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            lastTouchDist = getTouchDistance(e.touches);
        } else if (e.touches.length === 1) {
            isDragging = true;
            dragStart = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            lastOffset = { x: offsetX, y: offsetY };
        }
    });

    canvas.addEventListener('touchend', () => {
        isDragging = false;
        lastTouchDist = null;
    });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 2) {
            const dist = getTouchDistance(e.touches);
            if (lastTouchDist !== null) {
                const scaleFactor = lastTouchDist / dist;
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                zoom(scaleFactor, midX, midY);
            }
            lastTouchDist = dist;
        } else if (isDragging && e.touches.length === 1) {
            const dx = e.touches[0].clientX - dragStart.x;
            const dy = e.touches[0].clientY - dragStart.y;
            offsetX = lastOffset.x - dx * (scale / width);
            offsetY = lastOffset.y - dy * (scale / height);
            render();
        }
    }, { passive: false });

    render();
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// === COLOR FUNCTIONS ===
function smoothColorHSL(iter, maxIter, x, y, offset = 0) {
    if (iter >= maxIter) return [0, 0, 0];
    const smooth = iter - Math.log2(Math.log2(x * x + y * y));
    const hue = (smooth * 15 + offset) % 360;
    return hslToRgb(hue / 360, 1, 0.5);
}

function annieColor(iter, maxIter) {
    const t = iter / maxIter;

    if (iter >= maxIter) {
        return [240, 220, 230]; // light rose gray for non-escaping points
    }

    const r = Math.floor(255 * (0.8 + 0.2 * t));        // starts high, ends full
    const g = Math.floor(100 + 50 * t);                 // rose tint
    const b = Math.floor(180 + 40 * (1 - t));           // soft fade toward light pink

    return [r, g, b];
}


function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) return [l, l, l].map(v => Math.round(v * 255));

    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// function annieFormula(x0, y0, maxIter, params = {}) {
//     let x = x0;
//     let y = y0;
//     let iter = 0;

//     const { p1 = 1, p2 = 1, p3 = 1, p4 = 0, p5 = 0 } = params;

//     while (x * x + y * y <= 4 && iter < maxIter) {
//         const xtemp = p1 * (x * x - y * y) + p2 * x0 + p4 * Math.sin(p5 * y);
//         y = p3 * (2 * x * y) + p2 * y0 + p4 * Math.cos(p5 * x);
//         x = xtemp;
//         iter++;
//     }

//     return iter;
// }

function annieFormula(x0, y0, maxIter, params = {}) {
    let x = x0;
    let y = y0;
    let iter = 0;

    var {
        p1 = 2003,   // year you were born
        p2 = 8,      // your favorite number 八
        p3 = 999,    // half of your passwords
        p4 = 2024,   // the year I met you
        p5 = 2019    // when Annie became Annie
    } = params;

    // Normalize
    p1 = p1 / 1000;    
    p2 = p2 % 5;       
    p3 = p3 / 500;     
    p4 = p4 * 0.0;    
    p5 = p5 * 0.0;    

    while (x * x + y * y <= 6 && iter < maxIter) {
        const xtemp = p1 * (x * x - y * y) + p2 * x0 + p4 * Math.sin(p5 * y);
        y = p3 * (2 * x * y) + p2 * y0 + p4 * Math.cos(p5 * x);
        x = xtemp;
        iter++;
    }

    return iter;
}
