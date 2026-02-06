// Конфігурація гри
const gameConfig = {
    items: [
        {id: 1, name: 'bunny', src: 'main/assets/items/bunny.png'},
        {id: 2, name: 'egg1', src: 'main/assets/items/egg1.png'},
        {id: 3, name: 'egg2', src: 'main/assets/items/egg2.png'},
        {id: 4, name: 'egg3', src: 'main/assets/items/egg3.png'},
        {id: 5, name: 'cake', src: 'main/assets/items/cake.png'},
        {id: 6, name: 'flower', src: 'main/assets/items/flower.png'},
        {id: 7, name: 'chicken', src: 'main/assets/items/chicken.png'},
        {id: 8, name: 'basket-item', src: 'main/assets/items/box.png'}
    ],
    basketSrcs: [  // Новий array для рівнів кошика
        'main/assets/box.png',  // 0 предметів
        'main/assets/box_low.png',    // 1-3
        'main/assets/box_medium.png', // 4-6
        'main/assets/box_full.png'    // 7-8
    ],
    celebrationIcons: [
        "https://cdn-icons-png.flaticon.com/128/2545/2545534.png",
        "https://cdn-icons-png.flaticon.com/128/2720/2720077.png",
        "https://cdn-icons-png.flaticon.com/128/2251/2251931.png",
        "https://cdn-icons-png.flaticon.com/128/4185/4185066.png"
    ]
};

// Глобальні змінні
let wishes = [];
let currentWishIndex = 0;
let collectedCount = 0;
let totalItems = gameConfig.items.length;
let isDragging = false;
let currentDragElement = null;
let offsetX = 0;
let offsetY = 0;

// ─── АУДІО КОНТЕКСТ (Web Audio API) ───
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

// 🔊 ЗВУК ВЗЯТТЯ предмета — лёгкий "поп"
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

// 🔊 ЗВУК ПОПАДАННЯ в корзинку — "блоп" с нижними частотами
function playDropSound() {
    const ctx = getAudioContext();

    // Основной "блоп"
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

    // Лёгкий "шурх" поверх
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

// 🔊 ЗВУК ЗАВЕРШЕННЯ — торжественный "та-да"
function playCompleteSound() {
    const ctx = getAudioContext();
    // Мажорный аккорд последовательно
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        const startTime = ctx.currentTime + i * 0.15;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

        osc.start(startTime);
        osc.stop(startTime + 0.6);
    });
}

// Інициализация при загрузке
document.addEventListener("DOMContentLoaded", () => {
    createSiteRevealAnimation();
    initializeGame();
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
    const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#FF69B4', '#9370DB', '#87CEEB'];

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'site-grid-cell';
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        cell.style.backgroundColor = randomColor;
        cell.style.boxShadow = `0 0 15px ${randomColor}80`;
        siteGrid.appendChild(cell);
    }

    window.addEventListener('load', () => {
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
                const delay = distance * 60;

                setTimeout(() => {
                    cell.classList.add('fade-out');
                }, delay);
            });

            const maxDistance = Math.sqrt(
                Math.pow(centerCol, 2) + Math.pow(centerRow, 2)
            );
            const maxDelay = maxDistance * 60 + 1000;

            setTimeout(() => {
                siteGrid.style.opacity = '0';
                siteGrid.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    siteGrid.remove();
                }, 500);
            }, maxDelay);
        }, 300);
    });
}

// Інициализация гри
async function initializeGame() {
    const main = document.getElementById("main");

    const videoBackground = createVideoBackground();
    main.appendChild(videoBackground);

    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = 'Завантаження...';
    main.appendChild(loading);

    await loadWishes();
    loading.remove();

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
    img.src = gameConfig.basketSrcs[0];  // Початково порожній кошик
    img.alt = 'Корзинка';
    img.onerror = function () {
        this.src = 'https://cdn-icons-png.flaticon.com/128/2913/2913133.png';
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
    text.textContent = `Зібрано: ${collectedCount}/${totalItems}`;

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
    const centerY = H / 2;
    const isMobile = W <= 768;

    // Збільшуємо зону виключення навколо кошика
    const excludeRadius = isMobile ? 250 : 300;
    const itemSize = isMobile ? 60 : 80;
    const topMargin = 100;
    const edgeMargin = isMobile ? 30 : 40;

    // Покращені зони розміщення
    const zones = [
        // Верхня ліва
        {x1: edgeMargin, y1: topMargin, x2: centerX - excludeRadius - 60, y2: centerY - excludeRadius - 40},
        // Верхня права
        {
            x1: centerX + excludeRadius + 60,
            y1: topMargin,
            x2: W - edgeMargin - itemSize,
            y2: centerY - excludeRadius - 40
        },
        // Ліва середня
        {
            x1: edgeMargin,
            y1: centerY - excludeRadius - 20,
            x2: centerX - excludeRadius - 50,
            y2: centerY + excludeRadius + 20
        },
        // Права середня
        {
            x1: centerX + excludeRadius + 50,
            y1: centerY - excludeRadius - 20,
            x2: W - edgeMargin - itemSize,
            y2: centerY + excludeRadius + 20
        },
        // Нижня ліва
        {x1: edgeMargin, y1: centerY + excludeRadius + 40, x2: centerX - 80, y2: H - edgeMargin - itemSize},
        // Нижня права
        {
            x1: centerX + 80,
            y1: centerY + excludeRadius + 40,
            x2: W - edgeMargin - itemSize,
            y2: H - edgeMargin - itemSize
        }
    ];

    const positions = [];
    // Збільшуємо мінімальну відстань між предметами
    const minDist = isMobile ? 120 : 140;

    gameConfig.items.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'draggable-item';
        itemElement.dataset.id = item.id;

        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.name;
        img.onerror = function () {
            this.src = gameConfig.celebrationIcons[index % gameConfig.celebrationIcons.length];
        };
        itemElement.appendChild(img);

        const randomRotation = (Math.random() * 40 - 20);
        itemElement.style.transform = `rotate(${randomRotation}deg)`;
        itemElement.dataset.baseRotation = randomRotation;

        let x, y;
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 300) {
            const zone = zones[Math.floor(Math.random() * zones.length)];
            const zoneW = zone.x2 - zone.x1;
            const zoneH = zone.y2 - zone.y1;

            if (zoneW < itemSize || zoneH < itemSize) {
                attempts++;
                continue;
            }

            x = zone.x1 + Math.random() * (zoneW - itemSize);
            y = zone.y1 + Math.random() * (zoneH - itemSize);

            const cx = x + itemSize / 2;
            const cy = y + itemSize / 2;
            const distCenter = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);

            if (distCenter < excludeRadius) {
                attempts++;
                continue;
            }

            let tooClose = false;
            for (const pos of positions) {
                const d = Math.sqrt((cx - pos.cx) ** 2 + (cy - pos.cy) ** 2);
                if (d < minDist) {
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
            x = Math.random() * (W - itemSize - 60) + 30;
            y = Math.random() * (H - itemSize - 160) + 140;
        }

        positions.push({cx: x + itemSize / 2, cy: y + itemSize / 2});

        itemElement.style.left = x + 'px';
        itemElement.style.top = y + 'px';
        itemElement.dataset.originalX = x;
        itemElement.dataset.originalY = y;

        addDragListeners(itemElement);
        container.appendChild(itemElement);
    });
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
    e.preventDefault();

    currentDragElement = e.target.closest('.draggable-item');
    if (!currentDragElement) return;

    isDragging = true;
    currentDragElement.classList.add('dragging');

    // 🔊 Звук взятия
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
        // Предмет остается где отпустили, обновляем original
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
    const padding = 50; // Розширена зона для "поля зору" кошика
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

    const itemCenterX = x + 40;
    const itemCenterY = y + 40;

    const distance = Math.sqrt(
        Math.pow(itemCenterX - basketCenterX, 2) +
        Math.pow(itemCenterY - basketCenterY, 2)
    );

    if (distance < 180) {
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

    element.classList.add('collected');
    // Анімація зникнення предмета (замість додавання в container)
    element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    element.style.opacity = '0';
    element.style.transform = 'scale(0.5)';

    setTimeout(() => {
        element.remove();
    }, 500);

    const basketRect = basket.getBoundingClientRect();
    const basketCenterX = basketRect.left + basketRect.width / 2;
    const basketCenterY = basketRect.top + basketRect.height / 2;
    createConfetti(basketCenterX, basketCenterY);

    collectedCount++;
    updateProgress();
    updateBasketImage(basketImg);  // Оновлюємо картинку кошика

    // Повертаємо кошик у звичайне положення після прийняття предмета
    basket.className = 'basket';

    if (collectedCount === totalItems) {
        playCompleteSound();
        setTimeout(() => {
            showWishes();
        }, 1000);
    }
}

function updateBasketImage(img) {
    let level = 0;
    if (collectedCount >= 9) level = 3;
    else if (collectedCount >= 6) level = 2;
    else if (collectedCount >= 3) level = 1;
    else if (collectedCount < 3) level = 0;

    img.src = gameConfig.basketSrcs[level];
}

function createConfetti(x, y) {
    const isMobile = window.innerWidth <= 768;
    const confettiCount = isMobile ? 8 : 15; // Менше конфетті на мобільних
    const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#FF69B4', '#9370DB', '#87CEEB'];

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

    progressText.textContent = `Зібрано: ${collectedCount}/${totalItems}`;

    const percentage = (collectedCount / totalItems) * 100;
    progressFill.style.width = percentage + '%';
}

async function loadWishes() {
    try {
        const response = await fetch('./main/json/phrases.json');
        const data = await response.json();
        wishes = data.wishes;
    } catch (error) {
        console.error('Помилка завантаження побажань:', error);
        wishes = ['Христос Воскре! Щастилого Великодня!'];
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
    specialMessage.textContent = 'ХРИСТОС ВОСКРЕС!';

    const wishText = document.createElement('div');
    wishText.className = 'wish-text';
    wishText.id = 'wish-text';

    content.appendChild(specialMessage);
    content.appendChild(wishText);
    screen.appendChild(content);

    return screen;
}

function showWishes() {
    const isMobile = window.innerWidth <= 768;
    const celebrationCount = isMobile ? 10 : 20; // Менше ефектів на мобільних

    for (let i = 0; i < celebrationCount; i++) {
        setTimeout(() => createCelebration(isMobile ? 40 : 80), i * 600);
    }

    const wishScreen = document.getElementById('wish-screen');
    const wishText = document.getElementById('wish-text');
    const specialMessage = document.querySelector('.special-message');

    // Спочатку спрягустаємо заголовок
    specialMessage.classList.remove('show');

    wishText.textContent = '';
    currentWishIndex = Math.floor(Math.random() * wishes.length);

    setTimeout(() => {
        wishScreen.classList.add('show');

        // Друкуємо текст, і коли він готовий — показуємо заголовок
        typeWriter(wishes[currentWishIndex], wishText, 50, () => {
            specialMessage.classList.add('show');
        });
    }, 500);
}

function showNextWish() {
    const wishText = document.getElementById('wish-text');
    wishText.style.opacity = '0';

    setTimeout(() => {
        currentWishIndex = (currentWishIndex + 1) % wishes.length;
        wishText.textContent = '';
        wishText.style.opacity = '1';
        typeWriter(wishes[currentWishIndex], wishText);
        createCelebration(10);
    }, 300);
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
    // Зменшуємо кількість частинок на мобільних
    const actualCount = isMobile ? Math.min(count, 40) : count;

    const colors = [
        '#FFD700', '#FFA500', '#FF6B6B', '#FF69B4',
        '#9370DB', '#87CEEB', '#FF4757', '#2ED573', '#ECCC68', '#FF6348'
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
        const staggerDelay = bIdx * 60; // Each burst starts slightly later

        for (let i = 0; i < perBurst; i++) {
            // --- Форма: круглый, прямоугольник, ромб ---
            const shapeType = Math.floor(Math.random() * 3);
            const size = 5 + Math.random() * 11;
            let w, h, radius;

            if (shapeType === 0) {
                // Круглый
                w = size;
                h = size;
                radius = '50%';
            } else if (shapeType === 1) {
                // Прямоугольник (вытянутый — как настоящий конфетти)
                w = size * (0.3 + Math.random() * 0.25);
                h = size;
                radius = '2px';
            } else {
                // Ромб-ish
                w = size * 0.8;
                h = size;
                radius = '25% 75% 60% 40%';
            }

            const color = colors[Math.floor(Math.random() * colors.length)];

            const el = document.createElement('div');
            el.style.cssText = `
                position: fixed;
                left: 0px;
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

            // --- Угол вылёта: веер из точки взрыва ---
            // Left burst → летит вправо (угол от -70° до +70° от горизонтали)
            // Right burst → летит влево (зеркально)
            const spreadRad = 0.75; // ~135° общий веер
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
                y: burst.y + (Math.random() - 0.5) * 120, // разброс по y в точке взрыва
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.09 + Math.random() * 0.05,   // гравитация вниз
                drag: 0.993,                              // воздушное сопротивление
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 18,
                life: 1,
                decay: 0.0025 + Math.random() * 0.004,  // скорость затухания
                spawned: false,
                spawnDelay: staggerDelay + Math.random() * 180 // каждая частица чуть с разным delays
            });
        }
    });

    const startTime = performance.now();

    function animate(now) {
        let hasAlive = false;
        const elapsed = now - startTime;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];

            // Ещё не спавнлась — ждём
            if (!p.spawned) {
                if (elapsed < p.spawnDelay) {
                    hasAlive = true;
                    continue;
                }
                p.spawned = true;
            }

            if (p.life <= 0) continue;
            hasAlive = true;

            // --- Физика ---
            p.vy += p.gravity;          // гравитация
            p.vx *= p.drag;             // трение по x (замедляет горизонтальный полёт)
            p.vy *= p.drag;             // трение по y (чуть смягчает падение)
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.rotationSpeed *= 0.995;   // ротация тоже постепенно замедляется
            p.life -= p.decay;

            // Убиваем если улетело за экран вниз
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