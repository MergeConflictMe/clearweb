// engine.js — Универсальный клиентский движок ClearWeb

async function processTargetSite() {
    let targetUrl = document.getElementById('url-field').value.trim();
    if (!targetUrl) return alert('Пожалуйста, введи адрес сайта!');

    // Автоматически добавляем http, если пользователь забыл
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    const viewport = document.getElementById('output-viewport');
    
    // Используем открытый CORS-прокси для обхода защиты браузера (SOP)
    // Для тестов используем общественный, позже заменим на свой пуленепробиваемый
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/' + targetUrl;

    try {
        // 1. Скачиваем страницу в память в виде чистого текста
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Не удалось загрузить сайт через прокси');
        let rawHtml = await response.text();

        // 2. Парсим текст в полноценное DOM-дерево для хирургической чистки
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        // 3. УНИВЕРСАЛЬНАЯ ЧИСТКА БАННЕРОВ (Базовая база EasyList)
        // Массив универсальных правил для вырезания рекламы и казино
        const universalAdSelectors = [
            'iframe[src*="bet"]', 'iframe[src*="casino"]', 'iframe[src*="slot"]',
            '.adv', '.reklama', '.banner', '[id*="banner"]', '[class*="banner"]',
            'ins.adsbygoogle', 'div[class*="teaser"]', 'a[href*="vulkan"]'
        ];
        
        doc.querySelectorAll(universalAdSelectors.join(',')).forEach(element => {
            element.remove();
        });

        // 4. ИНЪЕКЦИЯ СКРИПТЛЕТА (Технология uBlock)
        // Вшиваем наш супер-скрипт в самый верх <head>, чтобы он перехватил управление плеерами
        const uBlockScriptlet = doc.createElement('script');
        uBlockScriptlet.textContent = `
            (function() {
                console.log('=== КОРНЕВОЙ БЛОКИРОВЩИК CLEARWEB АКТИВИРОВАН ===');

                // Перехватываем создание рекламных плееров и жестко глушим их переменные
                window.vast_player_disabled = true;
                window.showPreroll = false;
                window.skip_ad_always = true;
                window.adblock = false; // Обманываем анти-адблоки

                // Заглушаем функции вызова рекламы (No-op функции)
                window.show_vast_adv = function() { return false; };
                window.InteractYandexTarget = function() { return false; };

                // Перехват сетевых запросов (Monkey Patching для fetch)
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const url = args[0];
                    if (typeof url === 'string' && (url.includes('google-analytics') || url.includes('yandex.ru/clck') || url.includes('doubleclick'))) {
                        console.log('ClearWeb заблокировал скрытый запрос к:', url);
                        return new Response('', { status: 404 }); // Возвращаем пустую ошибку вместо рекламы
                    }
                    return originalFetch.apply(this, args);
                };
            })();
        `;
        // Вставляем скриптлет самым первым элементом в документе
        if (doc.head) {
            doc.head.insertBefore(uBlockScriptlet, doc.head.firstChild);
        }

        // 5. Выводим результат на экран пользователя
        const cleanedHtml = doc.documentElement.outerHTML;
        viewport.srcdoc = cleanedHtml;

    } catch (error) {
        console.error('Ошибка ClearWeb:', error);
        alert('Упс! Не удалось очистить этот сайт. Убедись, что активирован демо-доступ к прокси на cors-anywhere.herokuapp.com');
    }
}
