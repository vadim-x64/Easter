// Конфігурація гри
const gameConfig = {
    items: [
        { id: 1, name: 'bunny', src: 'main/assets/items/bunny.png' },
        { id: 2, name: 'egg1', src: 'main/assets/items/egg1.png' },
        { id: 3, name: 'egg2', src: 'main/assets/items/egg2.png' },
        { id: 4, name: 'egg3', src: 'main/assets/items/egg3.png' },
        { id: 5, name: 'cake', src: 'main/assets/items/cake.png' },
        { id: 6, name: 'flower', src: 'main/assets/items/flower.png' },
        { id: 7, name: 'chicken', src: 'main/assets/items/chicken.png' },
        { id: 8, name: 'basket-item', src: 'main/assets/items/basket-item.png' }
    ],
    basketSrc: 'main/assets/items/basket.png',
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

// Ініціалізація при завантаженні
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

    // Для кружечків беремо менше колонок, щоб вони були більші
    const columns = isMobile ? 6 : 10;
    const cellWidth = viewportWidth / columns;
    const rows = Math.ceil(viewportHeight / cellWidth);

    document.documentElement.style.setProperty('--grid-columns', columns);
    document.documentElement.style.setProperty('--grid-rows', rows);

    const totalCells = columns * rows;

    // Додаємо різні кольори для кружечків
    const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#FF69B4', '#9370DB', '#87CEEB'];

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'site-grid-cell';

        // Випадковий колір
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        cell.style.backgroundColor = randomColor;
        cell.style.boxShadow = `0 0 15px ${randomColor}80`;

        siteGrid.appendChild(cell);
    }

    window.addEventListener('load', () => {
        setTimeout(() => {
            document.body.classList.add('show-content');
            const cells = document.querySelectorAll('.site-grid-cell');

            // Створюємо ефект "хвилі" від центру
            const centerCol = Math.floor(columns / 2);
            const centerRow = Math.floor(rows / 2);

            cells.forEach((cell, index) => {
                const row = Math.floor(index / columns);
                const col = index % columns;

                // Відстань від центру
                const distance = Math.sqrt(
                    Math.pow(col - centerCol, 2) +
                    Math.pow(row - centerRow, 2)
                );

                const delay = distance * 60; // Затримка залежить від відстані

                setTimeout(() => {
                    cell.classList.add('fade-out');
                }, delay);
            });

            // Видаляємо сітку після завершення анімації
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

// Ініціалізація гри
async function initializeGame() {
    const main = document.getElementById("main");

    // Додаємо фоновідео
    const videoBackground = createVideoBackground();
    main.appendChild(videoBackground);

    // Показуємо завантаження
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = 'Завантаження...';
    main.appendChild(loading);

    // Завантажуємо побажання
    await loadWishes();
    loading.remove();

    // Створюємо ігровий контейнер
    const gameContainer = document.createElement('div');
    gameContainer.id = 'game-container';
    main.appendChild(gameContainer);

    // Додаємо корзинку
    const basket = createBasket();
    gameContainer.appendChild(basket);

    // Додаємо прогрес-бар
    const progressContainer = createProgressBar();
    main.appendChild(progressContainer);

    // Створюємо предмети
    createDraggableItems(gameContainer);

    // Створюємо екран з побажаннями
    const wishScreen = createWishScreen();
    main.appendChild(wishScreen);
}

// Створення фонового відео
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

    video.addEventListener('error', function() {
        videoBackground.style.background = 'linear-gradient(135deg, #E8F5E9 0%, #FFF9C4 50%, #FFE0B2 100%)';
        video.style.display = 'none';
    });

    return videoBackground;
}

// Створення корзинки
function createBasket() {
    const basket = document.createElement('div');
    basket.className = 'basket';
    basket.id = 'basket';

    const img = document.createElement('img');
    img.src = gameConfig.basketSrc;
    img.alt = 'Корзинка';
    img.onerror = function() {
        // Якщо іконка не завантажилась, використовуємо placeholder
        this.src = 'https://cdn-icons-png.flaticon.com/128/2913/2913133.png';
    };

    basket.appendChild(img);
    return basket;
}

// Створення прогрес-бару
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

// Створення предметів для перетягування
function createDraggableItems(container) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const excludeRadius = 200; // Радіус навколо корзинки, де не розміщуємо предмети

    gameConfig.items.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'draggable-item';
        itemElement.dataset.id = item.id;

        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.name;
        img.onerror = function() {
            // Placeholder якщо іконка не завантажилась
            this.src = gameConfig.celebrationIcons[index % gameConfig.celebrationIcons.length];
        };

        itemElement.appendChild(img);

        // Випадкова позиція (уникаємо центру)
        let x, y, distance;
        do {
            x = Math.random() * (window.innerWidth - 100);
            y = Math.random() * (window.innerHeight - 100);
            distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        } while (distance < excludeRadius);

        itemElement.style.left = x + 'px';
        itemElement.style.top = y + 'px';

        // Зберігаємо початкову позицію
        itemElement.dataset.originalX = x;
        itemElement.dataset.originalY = y;

        // Додаємо обробники подій
        addDragListeners(itemElement);

        container.appendChild(itemElement);
    });
}

// Додавання обробників для drag & drop
function addDragListeners(element) {
    // Для миші
    element.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);

    // Для тачскріну
    element.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', endDrag);
}

// Початок перетягування
function startDrag(e) {
    e.preventDefault();

    currentDragElement = e.target.closest('.draggable-item');
    if (!currentDragElement) return;

    isDragging = true;
    currentDragElement.classList.add('dragging');

    const touch = e.touches ? e.touches[0] : e;
    const rect = currentDragElement.getBoundingClientRect();

    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
}

// Процес перетягування
function drag(e) {
    if (!isDragging || !currentDragElement) return;
    e.preventDefault();

    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX - offsetX;
    const y = touch.clientY - offsetY;

    currentDragElement.style.left = x + 'px';
    currentDragElement.style.top = y + 'px';

    // Перевіряємо чи близько до корзинки
    checkBasketProximity(x, y);
}

// Завершення перетягування
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
        returnItemToOriginalPosition(currentDragElement);
    }

    // Скидаємо стан корзинки
    const basket = document.getElementById('basket');
    basket.className = 'basket';

    currentDragElement = null;
}

// Перевірка близькості до корзинки
function checkBasketProximity(x, y) {
    const basket = document.getElementById('basket');
    const basketRect = basket.getBoundingClientRect();
    const basketCenterX = basketRect.left + basketRect.width / 2;
    const basketCenterY = basketRect.top + basketRect.height / 2;

    const itemCenterX = x + 40; // 40 - половина розміру предмета
    const itemCenterY = y + 40;

    const distance = Math.sqrt(
        Math.pow(itemCenterX - basketCenterX, 2) +
        Math.pow(itemCenterY - basketCenterY, 2)
    );

    if (distance < 150) {
        basket.classList.add('lift');

        // Визначаємо сторону нахилу
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

// Перевірка чи предмет над корзинкою
function isOverBasket(x, y) {
    const basket = document.getElementById('basket');
    const basketRect = basket.getBoundingClientRect();
    const basketCenterX = basketRect.left + basketRect.width / 2;
    const basketCenterY = basketRect.top + basketRect.height / 2;

    const distance = Math.sqrt(
        Math.pow(x - basketCenterX, 2) +
        Math.pow(y - basketCenterY, 2)
    );

    return distance < 100;
}

// Збір предмета
function collectItem(element) {
    const basket = document.getElementById('basket');
    const basketRect = basket.getBoundingClientRect();

    element.classList.add('collected');

    // Анімація польоту в корзинку
    element.style.left = (basketRect.left + basketRect.width / 2 - 40) + 'px';
    element.style.top = (basketRect.top + basketRect.height / 2 - 20) + 'px';
    element.style.transform = 'scale(0.5)';
    element.style.opacity = '0.8';
    element.style.zIndex = '8';

    setTimeout(() => {
        element.style.display = 'none';
        collectedCount++;
        updateProgress();

        if (collectedCount === totalItems) {
            setTimeout(() => {
                showWishes();
            }, 500);
        }
    }, 600);
}

// Повернення предмета на початкову позицію
function returnItemToOriginalPosition(element) {
    element.classList.add('returning');
    element.style.left = element.dataset.originalX + 'px';
    element.style.top = element.dataset.originalY + 'px';

    setTimeout(() => {
        element.classList.remove('returning');
    }, 500);
}

// Оновлення прогрес-бару
function updateProgress() {
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    progressText.textContent = `Зібрано: ${collectedCount}/${totalItems}`;

    const percentage = (collectedCount / totalItems) * 100;
    progressFill.style.width = percentage + '%';
}

// Завантаження побажань
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

// Створення екрану з побажаннями
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

    const nextButton = document.createElement('button');
    nextButton.className = 'next-wish-button';
    nextButton.textContent = 'Ще побажання!';
    nextButton.onclick = showNextWish;

    content.appendChild(specialMessage);
    content.appendChild(wishText);
    content.appendChild(nextButton);
    screen.appendChild(content);

    return screen;
}

// Показ побажань
function showWishes() {
    createCelebration();

    const wishScreen = document.getElementById('wish-screen');
    const wishText = document.getElementById('wish-text');

    wishText.textContent = '';
    currentWishIndex = Math.floor(Math.random() * wishes.length);

    setTimeout(() => {
        wishScreen.classList.add('show');
        typeWriter(wishes[currentWishIndex], wishText);
    }, 500);
}

// Показ наступного побажання
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

// Ефект друкування тексту
function typeWriter(text, element, speed = 50) {
    let i = 0;
    element.textContent = "";

    function typing() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(typing, speed);
        }
    }
    typing();
}

// Створення святкового конфетті
function createCelebration(count = 30) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const item = document.createElement('div');
            item.className = 'falling-celebration';

            const img = document.createElement('img');
            img.src = gameConfig.celebrationIcons[Math.floor(Math.random() * gameConfig.celebrationIcons.length)];
            item.appendChild(img);

            item.style.left = Math.random() * window.innerWidth + 'px';
            item.style.top = '-100px';

            document.body.appendChild(item);

            setTimeout(() => item.remove(), 3000);
        }, i * 100);
    }
}

// Заборона контекстного меню на медіа
document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        e.preventDefault();
    }
});