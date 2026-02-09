/******************************************************************************
 ╔══════════════════════════════════════════════════════════════════════════════╗
 ║  MAIN GAME LOGIC SCRIPT - головний JavaScript модуль гри                     ║
 ║                                                                              ║
 ║  Містить всю бізнес-логіку: ініціалізацію гри, drag-and-drop систему,        ║
 ║  генерацію звуків через Web Audio API, динамічне розміщення об'єктів,        ║
 ║  анімації частинок та керування життєвим циклом гри - завантаження,          ║
 ║  фінальний екран з побажаннями тощо.                                         ║
 ╚══════════════════════════════════════════════════════════════════════════════╝
 ******************************************************************************/

let backgroundMusic = null;
let musicRestartTimeout = null;
let isMusicPausedByWishes = false;

function initBackgroundMusic() {
    backgroundMusic = new Audio('main/assets/back.m4a');
    backgroundMusic.volume = 1;
    backgroundMusic.addEventListener('ended', function () {
        musicRestartTimeout = setTimeout(() => {
            if (!isMusicPausedByWishes && !document.hidden) {
                backgroundMusic.currentTime = 0;
                backgroundMusic.play().catch(err => console.log('Помилка відтворення:', err));
            }
        }, 3000);
    });
    setTimeout(() => {
        backgroundMusic.play().catch(err => {
            console.log('Автозапуск заблоковано браузером:', err);
            document.addEventListener('click', function startOnClick() {
                backgroundMusic.play();
                document.removeEventListener('click', startOnClick);
            }, {once: true});
        });
    }, 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const savedMuted = localStorage.getItem('musicMuted');
    if (savedMuted === 'true') {
        backgroundMusic.muted = true;
        isMuted = true;
        setTimeout(() => {
            const knobIcon = document.querySelector('.music-knob img');
            if (knobIcon) {
                knobIcon.src = 'main/assets/sound_off.png';
            }
        }, 100);
    }
}

function handleVisibilityChange() {
    if (!backgroundMusic) return;
    if (document.hidden) {
        if (!backgroundMusic.paused) {
            backgroundMusic.pause();
        }
        if (musicRestartTimeout) {
            clearTimeout(musicRestartTimeout);
            musicRestartTimeout = null;
        }
    } else {
        if (!isMusicPausedByWishes) {
            backgroundMusic.play().catch(err => console.log('Помилка відтворення:', err));
        }
    }
}

function pauseBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        isMusicPausedByWishes = true;
        if (musicRestartTimeout) {
            clearTimeout(musicRestartTimeout);
            musicRestartTimeout = null;
        }
    }
}

const gameConfig = {
    itemsFolder: 'main/assets/items/',
    itemExtensions: ['.png', '.jpg', '.jpeg', '.svg', '.gif'],
    basketSrcs: [
        'main/assets/box.png',
        'main/assets/box_low.png',
        'main/assets/box_medium.png',
        'main/assets/box_full.png'
    ]
};

let wishes = [];
let currentWishIndex = 0;
let collectedCount = 0;
let totalItems = 0;
let items = []; // Масив іконок з папки
let isDragging = false;
let isDraggingThread = false;
let currentDragElement = null;
let offsetX = 0;
let offsetY = 0;
let audioCtx = null;

function createReloadButton() {
    const reloadBtn = document.createElement('button');
    reloadBtn.id = 'reload-btn';
    reloadBtn.className = 'reload-button hidden';
    reloadBtn.setAttribute('aria-label', 'Перезавантажити');
    const img = document.createElement('img');
    img.src = 'main/assets/reload.png';
    img.alt = 'Reload';
    img.onerror = function () {
        this.style.display = 'none';
        reloadBtn.innerHTML = '↻';
        reloadBtn.style.fontSize = '32px';
        reloadBtn.style.color = '#fff';
    };
    reloadBtn.appendChild(img);
    document.body.appendChild(reloadBtn);
    reloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        reloadBtn.classList.add('spinning');
        isMusicPausedByWishes = false;
        setTimeout(() => {
            location.reload();
        }, 300);
    });
    return reloadBtn;
}

async function loadItemsFromFolder() {
    try {
        const response = await fetch(gameConfig.itemsFolder);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a');
        items = [];
        let id = 1;
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href === '../') return;
            const isValidImage = gameConfig.itemExtensions.some(ext =>
                href.toLowerCase().endsWith(ext)
            );
            if (isValidImage) {
                items.push({
                    id: id++,
                    name: href.replace(/\.[^/.]+$/, ''),
                    src: gameConfig.itemsFolder + href
                });
            }
        });
        if (items.length === 0) {
            await loadItemsAlternative();
        }
        totalItems = items.length;
        console.log(`Завантажено ${totalItems} іконок:`, items);
    } catch (error) {
        console.error('Помилка завантаження іконок:', error);
        await loadItemsAlternative();
    }
}

async function loadItemsAlternative() {
    const filePatterns = [
        'bunny', 'cake', 'cookie', 'egg', 'sweet', 'flower', 'basket', 'chick'
    ];
    items = [];
    let id = 1;
    for (const pattern of filePatterns) {
        for (let i = 1; i <= 8; i++) {
            const filename = `${pattern}${i}.png`;
            const src = gameConfig.itemsFolder + filename;
            const exists = await checkImageExists(src);
            if (exists) {
                items.push({
                    id: id++,
                    name: `${pattern}${i}`,
                    src: src
                });
            }
        }
        const filenameSimple = `${pattern}.png`;
        const srcSimple = gameConfig.itemsFolder + filenameSimple;
        const existsSimple = await checkImageExists(srcSimple);
        if (existsSimple) {
            items.push({
                id: id++,
                name: pattern,
                src: srcSimple
            });
        }
    }
    totalItems = items.length;
    console.log(`Завантажено ${totalItems} іконок (альтернативний метод):`, items);
}

function checkImageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playPickupSound() {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.05);
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
}

function playDropSound() {
    const ctx = getAudioContext();
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(300, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);
    const bufferSize = ctx.sampleRate * 0.15;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 2;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    noise.buffer = noiseBuffer;
    noise.start(ctx.currentTime);
}

function playCompleteSound() {
    const ctx = getAudioContext();
    const bells = [
        {freq: 523, time: 0, duration: 1.2},
        {freq: 659, time: 0.4, duration: 1.0},
        {freq: 784, time: 0.8, duration: 0.8},
        {freq: 523, time: 1.3, duration: 1.2},
        {freq: 659, time: 1.7, duration: 1.0},
        {freq: 784, time: 2.1, duration: 0.8},
        {freq: 1047, time: 2.8, duration: 1.5}
    ];
    bells.forEach(bell => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(bell.freq, ctx.currentTime + bell.time);
        gain.gain.setValueAtTime(0, ctx.currentTime + bell.time);
        gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + bell.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + bell.time + bell.duration);
        osc.start(ctx.currentTime + bell.time);
        osc.stop(ctx.currentTime + bell.time + bell.duration);
        const shimmer = ctx.createOscillator();
        const shimmerGain = ctx.createGain();
        shimmer.connect(shimmerGain);
        shimmerGain.connect(ctx.destination);
        shimmer.type = 'triangle';
        shimmer.frequency.setValueAtTime(bell.freq * 3, ctx.currentTime + bell.time);
        shimmerGain.gain.setValueAtTime(0, ctx.currentTime + bell.time);
        shimmerGain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + bell.time + 0.01);
        shimmerGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + bell.time + bell.duration * 0.7);
        shimmer.start(ctx.currentTime + bell.time);
        shimmer.stop(ctx.currentTime + bell.time + bell.duration);
    });
    setTimeout(() => {
        const finale = [
            {freq: 659, delay: 0},
            {freq: 784, delay: 0.15},
            {freq: 1047, delay: 0.3},
            {freq: 1319, delay: 0.45}
        ];
        finale.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.delay);
            gain.gain.setValueAtTime(0, ctx.currentTime + note.delay);
            gain.gain.linearRampToValueAtTime(0.126, ctx.currentTime + note.delay + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.delay + 1.5);
            osc.start(ctx.currentTime + note.delay);
            osc.stop(ctx.currentTime + note.delay + 1.5);
        });
    }, 4000);
}

document.addEventListener("DOMContentLoaded", () => {
    createSiteRevealAnimation();
    initializeGame();
});

document.addEventListener('DOMContentLoaded', () => {
    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            reloadBtn.classList.add('spinning');
            setTimeout(() => {
                location.reload();
            }, 300);
        });
    }
});

function createSiteRevealAnimation() {
    const siteGrid = document.createElement('div');
    siteGrid.className = 'site-grid';
    document.body.appendChild(siteGrid);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth <= 768;
    const columns = isMobile ? 6 : 10;
    const cellWidth = viewportWidth / columns;
    const rows = Math.ceil(viewportHeight / cellWidth);
    document.documentElement.style.setProperty('--grid-columns', columns);
    document.documentElement.style.setProperty('--grid-rows', rows);
    const totalCells = columns * rows;
    const colors = ['#FFD700', '#FFA500', '#FF8C00'];
    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'site-grid-cell';
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        cell.style.backgroundColor = randomColor;
        cell.style.boxShadow = `0 0 15px ${randomColor}80`;
        siteGrid.appendChild(cell);
    }
    setTimeout(() => {
        document.body.classList.add('show-content');
        const cells = document.querySelectorAll('.site-grid-cell');
        const centerCol = Math.floor(columns / 2);
        const centerRow = Math.floor(rows / 2);
        cells.forEach((cell, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const distance = Math.sqrt(
                Math.pow(col - centerCol, 2) +
                Math.pow(row - centerRow, 2)
            );
            const delay = distance * 40;
            setTimeout(() => {
                cell.classList.add('fade-out');
            }, delay);
        });
        const maxDistance = Math.sqrt(
            Math.pow(centerCol, 2) + Math.pow(centerRow, 2)
        );
        const maxDelay = maxDistance * 40 + 500;
        setTimeout(() => {
            siteGrid.style.opacity = '0';
            siteGrid.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                siteGrid.remove();
            }, 300);
        }, maxDelay);
    }, 300);
}

async function initializeGame() {
    const main = document.getElementById("main");
    const videoBackground = createVideoBackground();
    main.appendChild(videoBackground);
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = 'Зачекайте...';
    main.appendChild(loading);
    await loadItemsFromFolder();
    await loadWishes();
    loading.remove();
    initBackgroundMusic();
    const gameContainer = document.createElement('div');
    gameContainer.id = 'game-container';
    main.appendChild(gameContainer);
    const basket = createBasket();
    gameContainer.appendChild(basket);
    const progressContainer = createProgressBar();
    main.appendChild(progressContainer);
    createDraggableItems(gameContainer);
    const wishScreen = createWishScreen();
    main.appendChild(wishScreen);
    createReloadButton();
    const thread = document.createElement('div');
    thread.className = 'hanging-thread';
    main.appendChild(thread);
    createPhysicsThread();
}

function createPhysicsThread() {
    const isMobile = window.innerWidth <= 768;
    const config = {
        segments: isMobile ? 10 : 15,
        length: isMobile ? 5 : 10,
        gravity: 0.5,
        friction: 0.95,
        stiffness: 1,
        anchorX: isMobile ? 30 : window.innerWidth - 80,
        anchorY: -10
    };
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "thread-container");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("class", "thread-path");
    svg.appendChild(path);
    document.body.appendChild(svg);
    const knob = document.createElement('div');
    knob.className = 'music-knob';
    const knobIcon = document.createElement('img');
    knobIcon.src = 'main/assets/sound_on.png';
    knobIcon.alt = 'Sound Toggle';
    knob.appendChild(knobIcon);
    document.body.appendChild(knob);
    let points = [];
    for (let i = 0; i < config.segments; i++) {
        points.push({
            x: config.anchorX,
            y: config.anchorY - (i * 5),
            oldx: config.anchorX - (i * 4),
            oldy: config.anchorY - (i * 5) - 15,
            pinned: i === 0
        });
    }
    let dragPointIndex = null;
    let mouseX = 0;
    let mouseY = 0;
    let startDragY = 0;
    let hasToggled = false;
    let isMuted = false;

    function playSoftClick() {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    }

    function toggleMusic() {
        if (!backgroundMusic) return;
        if (backgroundMusic.paused) {
            backgroundMusic.play().catch(e => console.log(e));
            isMuted = false;
        } else {
            if (backgroundMusic.muted || backgroundMusic.volume === 0) {
                backgroundMusic.muted = false;
                backgroundMusic.volume = 0.5;
                isMuted = false;
            } else {
                backgroundMusic.muted = true;
                isMuted = true;
            }
        }
        knobIcon.src = isMuted ? 'main/assets/sound_off.png' : 'main/assets/sound_on.png';
        playSoftClick();
        localStorage.setItem('musicMuted', isMuted);
        if (navigator.vibrate) navigator.vibrate(40);
    }

    function update() {
        for (let i = 0; i < points.length; i++) {
            let p = points[i];
            if (p.pinned) continue;
            if (isDraggingThread && i === dragPointIndex) {
                p.x = mouseX;
                p.y = mouseY;
                if (i === points.length - 1 && !hasToggled) {
                    const dragDistance = mouseY - startDragY;
                    if (dragDistance > 50) {
                        toggleMusic();
                        hasToggled = true;
                    }
                }
                p.oldx = p.x;
                p.oldy = p.y;
                continue;
            }
            let vx = (p.x - p.oldx) * config.friction;
            let vy = (p.y - p.oldy) * config.friction;
            p.oldx = p.x;
            p.oldy = p.y;
            p.x += vx;
            p.y += vy;
            p.y += config.gravity;
        }
        for (let iter = 0; iter < 5; iter++) {
            for (let i = 0; i < points.length - 1; i++) {
                let p1 = points[i];
                let p2 = points[i + 1];
                let dx = p2.x - p1.x;
                let dy = p2.y - p1.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                let difference = config.length - distance;
                let percent = (difference / distance) / 2 * config.stiffness;
                let offsetX = dx * percent;
                let offsetY = dy * percent;
                if (!p1.pinned) {
                    p1.x -= offsetX;
                    p1.y -= offsetY;
                }
                if (!isDraggingThread || (i + 1) !== dragPointIndex) {
                    p2.x += offsetX;
                    p2.y += offsetY;
                }
            }
        }
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length - 1; i++) {
            let xc = (points[i].x + points[i + 1].x) / 2;
            let yc = (points[i].y + points[i + 1].y) / 2;
            d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
        }
        d += ` T ${points[points.length - 1].x} ${points[points.length - 1].y}`;
        path.setAttribute("d", d);
        const endPoint = points[points.length - 1];
        knob.style.transform = `translate(${endPoint.x - 32}px, ${endPoint.y - 32}px)`;
        requestAnimationFrame(update);
    }

    function handleStart(x, y, target) {
        const wishScreen = document.getElementById('wish-screen');
        if (wishScreen && wishScreen.classList.contains('show')) {
            return;
        }
        if (isDragging) return;
        let isKnob = target.closest('.music-knob');
        let closestDist = Infinity;
        let closestIndex = -1;
        for (let i = 1; i < points.length; i++) {
            let dx = points[i].x - x;
            let dy = points[i].y - y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closestIndex = i;
            }
        }
        if (isKnob) {
            closestIndex = points.length - 1;
            closestDist = 0;
        }
        if (closestDist < 40 || isKnob) {
            isDraggingThread = true;
            dragPointIndex = closestIndex;
            mouseX = x;
            mouseY = y;
            startDragY = y;
            hasToggled = false;
            document.body.style.cursor = 'grabbing';
            knob.style.cursor = 'grabbing';
        }
    }

    function handleEnd() {
        if (isDraggingThread) {
            isDraggingThread = false;
            dragPointIndex = null;
            document.body.style.cursor = '';
            knob.style.cursor = 'grab';
        }
    }

    window.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY, e.target));
    window.addEventListener('mousemove', (e) => {
        if (isDraggingThread) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }
    });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchstart', (e) => {
        handleStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }, {passive: false});
    window.addEventListener('touchmove', (e) => {
        if (isDraggingThread) {
            e.preventDefault();
            mouseX = e.touches[0].clientX;
            mouseY = e.touches[0].clientY;
        }
    }, {passive: false});
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('resize', () => {
        const isMobileNow = window.innerWidth <= 768;
        config.anchorX = isMobileNow ? 50 : window.innerWidth - 80;
        points[0].x = config.anchorX;
        points[0].oldx = config.anchorX;
    });
    update();
}

function createVideoBackground() {
    const videoBackground = document.createElement("div");
    videoBackground.className = "video-background";
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    const source = document.createElement("source");
    source.src = "main/assets/easter.mp4";
    source.type = "video/mp4";
    video.appendChild(source);
    videoBackground.appendChild(video);
    video.addEventListener('error', function () {
        videoBackground.style.background = 'linear-gradient(135deg, #E8F5E9 0%, #FFF9C4 50%, #FFE0B2 100%)';
        video.style.display = 'none';
    });
    return videoBackground;
}

function createBasket() {
    const basket = document.createElement('div');
    basket.className = 'basket';
    basket.id = 'basket';
    const img = document.createElement('img');
    img.src = gameConfig.basketSrcs[0];
    img.alt = 'Корзинка';
    img.onerror = function () {
        this.src = 'https://cdn-icons-png.flaticon.com/128/1685/1685513.png';
    };
    basket.appendChild(img);
    return basket;
}

function createProgressBar() {
    const container = document.createElement('div');
    container.className = 'progress-container';
    const text = document.createElement('div');
    text.className = 'progress-text';
    text.id = 'progress-text';
    text.textContent = `Зібрано ${collectedCount}/${totalItems}`;
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.id = 'progress-fill';
    bar.appendChild(fill);
    container.appendChild(text);
    container.appendChild(bar);
    return container;
}

function createDraggableItems(container) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const centerX = W / 2;
    const isMobile = W <= 768;
    const basketExcludeZone = {
        x: centerX - (isMobile ? 120 : 200),
        y: H - (isMobile ? 200 : 350),
        width: isMobile ? 240 : 400,
        height: isMobile ? 200 : 350
    };
    const progressExcludeZone = {
        x: centerX - (isMobile ? 150 : 200),
        y: 0,
        width: isMobile ? 300 : 400,
        height: isMobile ? 140 : 150
    };
    const threadExcludeZone = {
        x: isMobile ? 0 : W - 150,
        y: 0,
        width: 150,
        height: isMobile ? 150 : 250
    };
    const edgeMargin = isMobile ? 0 : 20;
    const minDist = isMobile ? 20 : 60;
    const verticalBounds = isMobile ? {
        minY: 120,
        maxY: H - 100
    } : null;
    const positions = [];
    const maxUniqueItems = 16;
    const limitedItems = items.slice(0, maxUniqueItems);
    const allItems = [];
    if (isMobile) {
        const shuffled = [...limitedItems].sort(() => Math.random() - 0.5);
        const mobileCount = 16;
        shuffled.slice(0, mobileCount).forEach(item => {
            allItems.push({...item, copyIndex: 1});

        });
    } else {
        limitedItems.forEach(item => {
            allItems.push({...item, copyIndex: 1});
            allItems.push({...item, copyIndex: 2});
        });
    }
    totalItems = allItems.length;
    allItems.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'draggable-item';
        itemElement.dataset.id = `${item.id}_${item.copyIndex}`;
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.name;
        img.onerror = function () {
            this.src = 'https://cdn-icons-png.flaticon.com/128/4185/4185066.png';
        };
        itemElement.appendChild(img);
        let sizeVariation;
        const sizeRandom = Math.random();
        if (sizeRandom < 0.3) {
            sizeVariation = isMobile ? 50 : 65;
        } else if (sizeRandom < 0.7) {
            sizeVariation = isMobile ? 60 : 80;
        } else {
            sizeVariation = isMobile ? 70 : 95;
        }
        itemElement.style.width = sizeVariation + 'px';
        itemElement.style.height = sizeVariation + 'px';
        const randomRotation = (Math.random() * 50 - 25);
        itemElement.style.transform = `rotate(${randomRotation}deg)`;
        itemElement.dataset.baseRotation = randomRotation;
        let x, y;
        let placed = false;
        let attempts = 0;
        const maxAttempts = 2000;
        const maxX = W - sizeVariation - edgeMargin;
        const minX = edgeMargin;
        const maxY = verticalBounds ? verticalBounds.maxY - sizeVariation : H - sizeVariation - edgeMargin;
        const minY = verticalBounds ? verticalBounds.minY : edgeMargin;

        function isInExcludeZone(x, y, size) {
            if (x + size > basketExcludeZone.x &&
                x < basketExcludeZone.x + basketExcludeZone.width &&
                y + size > basketExcludeZone.y &&
                y < basketExcludeZone.y + basketExcludeZone.height) {
                return true;
            }
            if (x + size > progressExcludeZone.x &&
                x < progressExcludeZone.x + progressExcludeZone.width &&
                y + size > progressExcludeZone.y &&
                y < progressExcludeZone.y + progressExcludeZone.height) {
                return true;
            }
            if (x + size > threadExcludeZone.x &&
                x < threadExcludeZone.x + threadExcludeZone.width &&
                y + size > threadExcludeZone.y &&
                y < threadExcludeZone.y + threadExcludeZone.height) {
                return true;
            }
            return false;
        }

        while (!placed && attempts < maxAttempts) {
            x = minX + Math.random() * (maxX - minX);
            y = minY + Math.random() * (maxY - minY);
            if (x < minX || x > maxX || y < minY || y > maxY) {
                attempts++;
                continue;
            }
            if (isInExcludeZone(x, y, sizeVariation)) {
                attempts++;
                continue;
            }
            const cx = x + sizeVariation / 2;
            const cy = y + sizeVariation / 2;
            let tooClose = false;
            for (const pos of positions) {
                const d = Math.sqrt((cx - pos.cx) ** 2 + (cy - pos.cy) ** 2);
                const requiredDist = (sizeVariation + pos.size) / 2 + minDist;
                if (d < requiredDist) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) {
                attempts++;
                continue;
            }
            placed = true;
        }
        if (!placed) {
            let emergencyAttempts = 0;
            const reducedMinDist = minDist * 0.001;
            while (!placed && emergencyAttempts < 500) {
                x = minX + Math.random() * (maxX - minX);
                y = minY + Math.random() * (maxY - minY);
                if (x < minX || x > maxX || y < minY || y > maxY) {
                    emergencyAttempts++;
                    continue;
                }
                if (isInExcludeZone(x, y, sizeVariation)) {
                    emergencyAttempts++;
                    continue;
                }
                const cx = x + sizeVariation / 2;
                const cy = y + sizeVariation / 2;
                let tooClose = false;
                for (const pos of positions) {
                    const d = Math.sqrt((cx - pos.cx) ** 2 + (cy - pos.cy) ** 2);
                    const requiredDist = (sizeVariation + pos.size) / 2 + reducedMinDist;
                    if (d < requiredDist) {
                        tooClose = true;
                        break;
                    }
                }
                if (!tooClose) {
                    placed = true;
                }
                emergencyAttempts++;
            }
        }
        x = Math.max(minX, Math.min(x, maxX));
        y = Math.max(minY, Math.min(y, maxY));
        positions.push({cx: x + sizeVariation / 2, cy: y + sizeVariation / 2, size: sizeVariation});
        itemElement.style.left = x + 'px';
        itemElement.style.top = y + 'px';
        itemElement.dataset.originalX = x;
        itemElement.dataset.originalY = y;
        addDragListeners(itemElement);
        container.appendChild(itemElement);
    });
    updateProgress();
}

function addDragListeners(element) {
    element.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    element.addEventListener('touchstart', startDrag, {passive: false});
    document.addEventListener('touchmove', drag, {passive: false});
    document.addEventListener('touchend', endDrag);
}

function startDrag(e) {
    if (isDraggingThread) return;
    e.preventDefault();
    currentDragElement = e.target.closest('.draggable-item');
    if (!currentDragElement) return;
    isDragging = true;
    currentDragElement.classList.add('dragging');
    playPickupSound();
    const touch = e.touches ? e.touches[0] : e;
    const rect = currentDragElement.getBoundingClientRect();
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
}

function drag(e) {
    if (!isDragging || !currentDragElement) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX - offsetX;
    const y = touch.clientY - offsetY;
    currentDragElement.style.left = x + 'px';
    currentDragElement.style.top = y + 'px';
    checkBasketProximity(x, y);
}

function endDrag(e) {
    if (!isDragging || !currentDragElement) return;
    isDragging = false;
    currentDragElement.classList.remove('dragging');
    const rect = currentDragElement.getBoundingClientRect();
    const itemCenterX = rect.left + rect.width / 2;
    const itemCenterY = rect.top + rect.height / 2;
    if (isOverBasket(itemCenterX, itemCenterY)) {
        collectItem(currentDragElement);
    } else {
        currentDragElement.dataset.originalX = currentDragElement.style.left;
        currentDragElement.dataset.originalY = currentDragElement.style.top;
    }
    const basket = document.getElementById('basket');
    basket.className = 'basket';
    currentDragElement = null;
}

function isOverBasket(x, y) {
    const basket = document.getElementById('basket');
    const rect = basket.getBoundingClientRect();
    const padding = 0;
    return x >= rect.left - padding &&
        x <= rect.right + padding &&
        y >= rect.top - padding &&
        y <= rect.bottom + padding;
}

function checkBasketProximity(x, y) {
    const basket = document.getElementById('basket');
    const basketRect = basket.getBoundingClientRect();
    const basketCenterX = basketRect.left + basketRect.width / 2;
    const basketCenterY = basketRect.top + basketRect.height / 2;
    const isMobile = window.innerWidth <= 768;
    const itemCenterX = x + (isMobile ? 25 : 40);
    const itemCenterY = y + (isMobile ? 25 : 40);
    const distance = Math.sqrt(
        Math.pow(itemCenterX - basketCenterX, 2) +
        Math.pow(itemCenterY - basketCenterY, 2)
    );
    const proximityThreshold = isMobile ? 120 : 160;
    if (distance < proximityThreshold) {
        basket.classList.add('lift');
        if (itemCenterX < basketCenterX) {
            basket.classList.add('tilt-left');
            basket.classList.remove('tilt-right');
        } else {
            basket.classList.add('tilt-right');
            basket.classList.remove('tilt-left');
        }
    } else {
        basket.classList.remove('lift', 'tilt-left', 'tilt-right');
    }
}

function collectItem(element) {
    const basket = document.getElementById('basket');
    const basketImg = basket.querySelector('img');
    playDropSound();
    const rect = element.getBoundingClientRect();
    const itemCenterX = rect.left + rect.width / 2;
    const itemCenterY = rect.top + rect.height / 2;
    createDissolveEffect(itemCenterX, itemCenterY, element);
    element.style.transition = 'opacity 0.3s ease';
    element.style.opacity = '0';
    setTimeout(() => {
        element.remove();
    }, 300);
    const basketRect = basket.getBoundingClientRect();
    const basketCenterX = basketRect.left + basketRect.width / 2;
    const basketCenterY = basketRect.top + basketRect.height / 2;
    createConfetti(basketCenterX, basketCenterY);
    collectedCount++;
    updateProgress();
    updateBasketImage(basketImg);
    basket.className = 'basket';
    if (collectedCount === totalItems) {
        playCompleteSound();
        setTimeout(() => {
            showWishes();
        }, 1000);
    }
}

function createDissolveEffect(x, y, element) {
    const isMobile = window.innerWidth <= 768;
    const particleCount = isMobile ? 15 : 25;
    const colors = [
        '#FFD700', '#FFA500', '#FF6B6B', '#FF69B4',
        '#9370DB', '#87CEEB', '#4CAF50', '#FF9800',
        '#E91E63', '#00BCD4', '#FFEB3B', '#8BC34A',
        '#FF1493', '#00CED1', '#FF8C00', '#7B68EE',
        '#32CD32', '#FF00FF', '#00FFFF', '#FF007F'
    ];
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'dissolve-particle';
        const size = 8 + Math.random() * 12;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            pointer-events: none;
            z-index: 999;
            box-shadow: 0 0 ${size * 2}px ${color}80, 
                        0 0 ${size}px ${color};
        `;
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
        const velocity = 80 + Math.random() * 120;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        const duration = 0.8 + Math.random() * 0.4;
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        particle.style.animation = `dissolve-burst ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`;
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), duration * 1000);
    }
    setTimeout(() => {
        for (let i = 0; i < particleCount / 2; i++) {
            const particle = document.createElement('div');
            particle.className = 'dissolve-particle-small';
            const size = 4 + Math.random() * 6;
            const color = colors[Math.floor(Math.random() * colors.length)];
            particle.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: 50%;
                pointer-events: none;
                z-index: 998;
                box-shadow: 0 0 ${size * 3}px ${color};
            `;
            const angle = Math.random() * Math.PI * 2;
            const velocity = 40 + Math.random() * 80;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');
            particle.style.animation = `dissolve-burst 1s ease-out forwards`;
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    }, 100);
}

function updateBasketImage(img) {
    let level = 0;
    if (collectedCount >= 12) level = 3;
    else if (collectedCount >= 8) level = 2;
    else if (collectedCount >= 4) level = 1;
    else if (collectedCount < 4) level = 0;
    img.src = gameConfig.basketSrcs[level];
}

function createConfetti(x, y) {
    const isMobile = window.innerWidth <= 768;
    const confettiCount = isMobile ? 8 : 15;
    const colors = [
        '#FFD700', '#FFA500', '#FF6B6B', '#FF69B4',
        '#9370DB', '#87CEEB', '#FF1493', '#00CED1',
        '#FF8C00', '#7B68EE', '#32CD32', '#FF00FF',
        '#00FFFF', '#FFFF00', '#FF007F'
    ];
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = x + 'px';
        confetti.style.top = y + 'px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        const angle = (Math.PI * 2 * i) / confettiCount;
        const velocity = isMobile ? 60 + Math.random() * 60 : 100 + Math.random() * 100;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        confetti.style.setProperty('--tx', tx + 'px');
        confetti.style.setProperty('--ty', ty + 'px');
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 1000);
    }
}

function updateProgress() {
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    const progressBar = document.querySelector('.progress-bar');
    progressText.textContent = `Зібрано ${collectedCount}/${totalItems}`;
    const percentage = (collectedCount / totalItems) * 100;
    progressFill.style.width = percentage + '%';
    progressFill.classList.add('splash');
    setTimeout(() => progressFill.classList.remove('splash'), 600);
    createWaterBubbles(progressFill);
    if (collectedCount === totalItems) {
        setTimeout(() => {
            progressBar.classList.add('pre-explode');
            setTimeout(() => {
                explodeProgressBar();
            }, 300);
        }, 500);
    }
}

function createWaterBubbles(progressFill) {
    const bubbleCount = Math.random() > 0.5 ? 2 : 3;
    for (let i = 0; i < bubbleCount; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'water-bubble';
        const leftPos = Math.random() * 80 + 10;
        const drift = (Math.random() - 0.5) * 30;
        const duration = 1 + Math.random() * 1.5;
        const size = 4 + Math.random() * 6;
        bubble.style.left = leftPos + '%';
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.setProperty('--bubble-drift', drift + 'px');
        bubble.style.animationDuration = duration + 's';
        bubble.style.animationDelay = (Math.random() * 0.3) + 's';
        progressFill.appendChild(bubble);
        setTimeout(() => bubble.remove(), (duration + 0.3) * 1000);
    }
}

function explodeProgressBar() {
    const progressFill = document.getElementById('progress-fill');
    const progressBar = document.querySelector('.progress-bar');
    const rect = progressBar.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    const gradient = window.getComputedStyle(progressFill).background;
    const particleCount = isMobile ? 60 : 120;
    const fillWidth = rect.width;
    const fillHeight = rect.height;
    const cols = isMobile ? 15 : 25;
    const rows = isMobile ? 3 : 5;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const particle = document.createElement('div');
            particle.className = 'progress-explosion-particle';
            const xPos = rect.left + (fillWidth / cols) * col + (Math.random() * (fillWidth / cols));
            const yPos = rect.top + (fillHeight / rows) * row + (Math.random() * (fillHeight / rows));
            const size = 8 + Math.random() * 12;
            const colorPosition = col / cols;
            let color;
            if (colorPosition < 0.33) {
                color = '#FFD700';
            } else if (colorPosition < 0.66) {
                color = '#FFA500';
            } else {
                color = '#FF6B6B';
            }
            particle.style.cssText = `
                position: fixed;
                left: ${xPos}px;
                top: ${yPos}px;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
            `;
            const centerX = rect.left + fillWidth / 2;
            const centerY = rect.top + fillHeight / 2;
            const angle = Math.atan2(yPos - centerY, xPos - centerX);
            const velocity = 150 + Math.random() * 250;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity + (Math.random() - 0.5) * 100;
            const rotation = Math.random() * 720 - 360;
            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');
            particle.style.setProperty('--rotation', rotation + 'deg');
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1200);
        }
    }
    progressFill.style.transition = 'opacity 0.3s ease';
    progressFill.style.opacity = '0';
    setTimeout(() => {
        for (let i = 0; i < particleCount / 3; i++) {
            const particle = document.createElement('div');
            particle.className = 'progress-explosion-particle';
            const randomX = rect.left + Math.random() * fillWidth;
            const randomY = rect.top + Math.random() * fillHeight;
            const size = 3 + Math.random() * 6;
            const colorPosition = (randomX - rect.left) / fillWidth;
            let color;
            if (colorPosition < 0.33) {
                color = '#FFEB3B';
            } else if (colorPosition < 0.66) {
                color = '#FF8C00';
            } else {
                color = '#FF1493';
            }
            particle.style.cssText = `
                position: fixed;
                left: ${randomX}px;
                top: ${randomY}px;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
            `;
            const centerX = rect.left + fillWidth / 2;
            const centerY = rect.top + fillHeight / 2;
            const angle = Math.atan2(randomY - centerY, randomX - centerX);
            const velocity = 80 + Math.random() * 150;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1200);
        }
    }, 150);
}

async function loadWishes() {
    try {
        const response = await fetch('./main/json/phrases.json');
        const data = await response.json();
        wishes = data.wishes;
    } catch (error) {
        console.error('Помилка завантаження побажань:', error);
        wishes = ['Христос Воскрес! Щасливого Великодня!'];
    }
}

function createWishScreen() {
    const screen = document.createElement('div');
    screen.className = 'wish-screen';
    screen.id = 'wish-screen';
    const content = document.createElement('div');
    content.className = 'wish-content';
    const specialMessage = document.createElement('div');
    specialMessage.className = 'special-message';
    specialMessage.textContent = 'Христос Воскрес!';
    const wishText = document.createElement('div');
    wishText.className = 'wish-text';
    wishText.id = 'wish-text';
    content.appendChild(specialMessage);
    content.appendChild(wishText);
    screen.appendChild(content);
    return screen;
}

function showWishes() {
    pauseBackgroundMusic();
    const isMobile = window.innerWidth <= 768;
    const celebrationCount = isMobile ? 5 : 10;
    for (let i = 0; i < celebrationCount; i++) {
        setTimeout(() => createCelebration(isMobile ? 30 : 60), i * 1000);
    }
    const wishScreen = document.getElementById('wish-screen');
    const wishText = document.getElementById('wish-text');
    const specialMessage = document.querySelector('.special-message');
    specialMessage.classList.remove('show');
    wishText.textContent = '';
    currentWishIndex = Math.floor(Math.random() * wishes.length);
    setTimeout(() => {
        wishScreen.classList.add('show');
        typeWriter(wishes[currentWishIndex], wishText, 50, () => {
            specialMessage.classList.add('show');
            setTimeout(() => {
                const reloadBtn = document.getElementById('reload-btn');
                if (reloadBtn) {
                    reloadBtn.classList.add('fade-in');
                }
            }, 2000);
        });
    }, 500);
}

function typeWriter(text, element, speed = 50, onComplete = null) {
    let i = 0;
    element.textContent = "";

    function typing() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(typing, speed);
        } else if (onComplete) {
            onComplete();
        }
    }

    typing();
}

function createCelebration(count = 80) {
    const isMobile = window.innerWidth <= 768;
    const actualCount = isMobile ? Math.min(count, 40) : count;
    const colors = [
        '#FFD700', '#FFA500', '#FF6B6B', '#FF69B4',
        '#9370DB', '#87CEEB', '#FF4757', '#2ED573',
        '#ECCC68', '#FF6348', '#FF1493', '#00CED1',
        '#FF8C00', '#7B68EE', '#FF69B4', '#32CD32',
        '#FF00FF', '#00FFFF', '#FFFF00', '#FF007F'
    ];
    const W = window.innerWidth;
    const H = window.innerHeight;
    const particles = [];
    const bursts = actualCount > 20
        ? [
            {x: 0, y: H * 0.25},
            {x: 0, y: H * 0.6},
            {x: W, y: H * 0.25},
            {x: W, y: H * 0.6},
        ]
        : [
            {x: 0, y: H * 0.4},
            {x: W, y: H * 0.4},
        ];
    const perBurst = Math.max(4, Math.floor(actualCount / bursts.length));
    bursts.forEach((burst, bIdx) => {
        const isLeft = burst.x === 0;
        const staggerDelay = bIdx * 60;
        for (let i = 0; i < perBurst; i++) {
            const shapeType = Math.floor(Math.random() * 3);
            const size = 5 + Math.random() * 11;
            let w, h, radius;
            if (shapeType === 0) {
                w = size;
                h = size;
                radius = '50%';
            } else if (shapeType === 1) {
                w = size * (0.3 + Math.random() * 0.25);
                h = size;
                radius = '2px';
            } else {
                w = size * 0.8;
                h = size;
                radius = '25% 75% 60% 40%';
            }
            const color = colors[Math.floor(Math.random() * colors.length)];
            const el = document.createElement('div');
            el.style.cssText = `
            position: fixed;
            left: -15px;
            top: 0px;
            width: ${w}px;
            height: ${h}px;
            background-color: ${color};
            border-radius: ${radius};
            pointer-events: none;
            z-index: 999;
            will-change: transform;
            opacity: 1;
        `;
            document.body.appendChild(el);
            const spreadRad = 0.75;
            let angle;
            if (isLeft) {
                angle = (-spreadRad + Math.random() * spreadRad * 2) * Math.PI;
            } else {
                angle = Math.PI + (-spreadRad + Math.random() * spreadRad * 2) * Math.PI;
            }
            const speed = 2.5 + Math.random() * 7.5;
            particles.push({
                el,
                x: burst.x,
                y: burst.y + (Math.random() - 0.5) * 120,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.09 + Math.random() * 0.05,
                drag: 0.993,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 18,
                life: 1,
                decay: 0.0025 + Math.random() * 0.004,
                spawned: false,
                spawnDelay: staggerDelay + Math.random() * 180
            });
        }
    });
    const startTime = performance.now();

    function animate(now) {
        let hasAlive = false;
        const elapsed = now - startTime;
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            if (!p.spawned) {
                if (elapsed < p.spawnDelay) {
                    hasAlive = true;
                    continue;
                }
                p.spawned = true;
            }
            if (p.life <= 0) continue;
            hasAlive = true;
            p.vy += p.gravity;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.rotationSpeed *= 0.995;
            p.life -= p.decay;
            if (p.y > window.innerHeight + 60) {
                p.life = 0;
            }
            const opacity = Math.max(0, p.life);
            p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`;
            p.el.style.opacity = opacity;
            if (p.life <= 0) {
                p.el.remove();
                particles.splice(i, 1);
            }
        }
        if (hasAlive) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

document.addEventListener('contextmenu', function (e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        e.preventDefault();
    }
});

let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, {passive: true});

document.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY;
    const touchDelta = touchY - touchStartY;
    if (touchDelta > 0 && window.scrollY === 0) {
        e.preventDefault();
    }
}, {passive: false});