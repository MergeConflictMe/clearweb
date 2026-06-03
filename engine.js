// engine.js — Универсальный клиентский движок ClearWeb с автоматическим проксированием

async function processTargetSite() {
    let targetUrl = document.getElementById('url-field').value.trim();
    if (!targetUrl) return alert('Пожалуйста, введи адрес сайта!');

    // Автоматически добавляем протокол https, если пользователь ввел просто домен
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    const viewport = document.getElementById('output-viewport');
    
    // Используем стабильный прокси allorigins.win, который не требует ручной активации
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);

    try {
        // 1. Загружаем исходный код целевого сайта через прокси
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Не удалось получить ответ от прокси-сервера');
        let rawHtml = await response.text();

        // 2. Создаем виртуальное DOM-дерево для очистки тегов
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        // 3. Вырезаем известные рекламные селекторы, iframe казино и баннеры
        const universalAdSelectors = [
            'iframe[src*="bet"]', 'iframe[src*="casino"]', 'iframe[src*="slot"]', 'iframe[src*="1xbet"]',
            '.adv', '.reklama', '.banner', '[id*="banner"]', '[class*="banner"]',
            'ins.adsbygoogle', 'div[class*="teaser"]', 'a[href*="vulkan"]', '.popunder', '.popup'
        ];
        
        doc.querySelectorAll(universalAdSelectors.join(',')).forEach(element => {
            element.remove();
        });

        // 4. Внедряем uBlock-скриптлет для перехвата и глушения скриптов плеера
        const uBlockScriptlet = doc.createElement('script');
        uBlockScriptlet.textContent = `
            (function() {
                console.log('=== КОРНЕВОЙ БЛОКИРОВЩИК CLEARWEB АКТИВИРОВАН ===');

                // Жестко блокируем переменные запуска рекламы в пиратских плеерах
                window.vast_player_disabled = true;
                window.showPreroll = false;
                window.skip_ad_always = true;
                window.adblock = false; 

                // Подменяем вызовы рекламных функций на пустышки (No-op функции)
                window.show_vast_adv = function() { return false; };
                window.InteractYandexTarget = function() { return false; };

                // Обезвреживаем сетевые рекламные запросы (Monkey Patching)
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const url = args[0];
                    if (typeof url === 'string' && (
                        url.includes('google-analytics') || 
                        url.includes('yandex.ru/clck') || 
                        url.includes('doubleclick') || 
                        url.includes('teaser')
                    )) {
                        console.log('ClearWeb заблокировал запрос к рекламе:', url);
                        return new Response('', { status: 404 }); // Подменяем ответ ошибкой
                    }
                    return originalFetch.apply(this, args);
                };
            })();
        `;
        
        // Вставляем наш скрипт на самый верх секции head, чтобы обогнать все скрипты сайта
        if (doc.head) {
            doc.head.insertBefore(uBlockScriptlet, doc.head.firstChild);
        } else if (doc.documentElement) {
            doc.documentElement.insertBefore(uBlockScriptlet, doc.documentElement.firstChild);
        }

        // 5. Генерируем финальный чистый HTML код и отдаем его во фрейм
        const cleanedHtml = doc.documentElement.outerHTML;
        viewport.srcdoc = cleanedHtml;

    } catch (error) {
        console.error('Ошибка движка ClearWeb:', error);
        alert('Не удалось загрузить или очистить указанный сайт. Проверь правильность ссылки.');
    }
}
