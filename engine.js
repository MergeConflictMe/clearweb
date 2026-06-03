// engine.js — Универсальный клиентский движок ClearWeb с обходом CORS и чисткой рекламы

async function processTargetSite() {
    let targetUrl = document.getElementById('url-field').value.trim();
    if (!targetUrl) return alert('Пожалуйста, введи адрес сайта!');

    // Автоматически добавляем протокол https, если пользователь ввел просто домен
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    const viewport = document.getElementById('output-viewport');
    
    // Используем надежный текстовый прокси-мост codetabs, работающий без JSON оберток
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=' + targetUrl;

    try {
        // 1. Загружаем исходный код целевого сайта напрямую в виде текста
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Не удалось получить ответ от прокси-сервера. Попробуйте позже.');
        let rawHtml = await response.text();

        // 2. Создаем виртуальное DOM-дерево для хирургической чистки разметки
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        // 3. Вырезаем известные рекламные селекторы, баннеры и блоки казино
        const universalAdSelectors = [
            'iframe[src*="bet"]', 'iframe[src*="casino"]', 'iframe[src*="slot"]', 'iframe[src*="1xbet"]',
            '.adv', '.reklama', '.banner', '[id*="banner"]', '[class*="banner"]',
            'ins.adsbygoogle', 'div[class*="teaser"]', 'a[href*="vulkan"]', '.popunder', '.popup'
        ];
        
        doc.querySelectorAll(universalAdSelectors.join(',')).forEach(element => {
            element.remove();
        });

        // 4. Внедряем uBlock-скриптлет для глушения рекламных функций внутри видеоплееров
        const uBlockScriptlet = doc.createElement('script');
        uBlockScriptlet.textContent = `
            (function() {
                console.log('=== КОРНЕВОЙ БЛОКИРОВЩИК CLEARWEB АКТИВИРОВАН ===');

                // Перехватываем и блокируем переменные рекламы в пиратских плеерах
                window.vast_player_disabled = true;
                window.showPreroll = false;
                window.skip_ad_always = true;
                window.adblock = false; 

                // Глушим вызовы рекламных функций на корню
                window.show_vast_adv = function() { return false; };
                window.InteractYandexTarget = function() { return false; };

                // Обезвреживаем сетевые трекеры и запросы к рекламным сетям (Monkey Patching)
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const url = args[0];
                    if (typeof url === 'string' && (
                        url.includes('google-analytics') || 
                        url.includes('yandex.ru/clck') || 
                        url.includes('doubleclick') || 
                        url.includes('teaser')
                    )) {
                        console.log('ClearWeb заблокировал скрытый рекламный запрос к:', url);
                        return new Response('', { status: 404 });
                    }
                    return originalFetch.apply(this, args);
                };
            })();
        `;
        
        // Вставляем наш скрипт на самый верх секции head, обгоняя выполнение оригинальных скриптов
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
        alert('Ошибка при загрузке или очистке сайта: ' + error.message);
    }
}
