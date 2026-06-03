// engine.js — Корректная сборка под российский CORS-прокси

async function processTargetSite() {
    let targetUrl = document.getElementById('url-field').value.trim();
    if (!targetUrl) return alert('Пожалуйста, введи адрес сайта!');

    // Очищаем адрес от случайных пробелов и мусора
    targetUrl = targetUrl.replace(/\s+/g, '');

    // Если пользователь не ввёл протокол, добавляем строго https://
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    const btn = document.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Чистка рекламы...';
    btn.disabled = true;

    // Сборка URL строго по документации прокси-сервера cors.su
    const proxyBase = 'https://cors.su/';
    const proxyUrl = proxyBase + '?url=' + encodeURIComponent(targetUrl);

    try {
        // 1. Делаем запрос к прокси
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            throw new Error(`Сервер ответил ошибкой: ${response.status}`);
        }
        
        let rawHtml = await response.text();

        // 2. Создаем виртуальное дерево сайта для зачистки рекламы
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        // 3. Вырезаем рекламные блоки, тизеры и баннеры казино
        const universalAdSelectors = [
            'iframe[src*="bet"]', 'iframe[src*="casino"]', 'iframe[src*="slot"]', 'iframe[src*="1xbet"]',
            '.adv', '.reklama', '.banner', '[id*="banner"]', '[class*="banner"]',
            'ins.adsbygoogle', 'div[class*="teaser"]', 'a[href*="vulkan"]', '.popunder', '.popup'
        ];
        
        doc.querySelectorAll(universalAdSelectors.join(',')).forEach(element => {
            element.remove();
        });

        // 4. Вживляем наш внутренний uBlock-скриптлет для блокировки функций рекламы внутри плееров
        const uBlockScriptlet = doc.createElement('script');
        uBlockScriptlet.textContent = `
            (function() {
                console.log('=== КОРНЕВОЙ БЛОКИРОВЩИК CLEARWEB АКТИВИРОВАН ===');
                window.vast_player_disabled = true;
                window.showPreroll = false;
                window.skip_ad_always = true;
                window.adblock = false; 
                window.show_vast_adv = function() { return false; };

                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const url = args[0];
                    if (typeof url === 'string' && (
                        url.includes('google-analytics') || 
                        url.includes('yandex.ru/clck') || 
                        url.includes('doubleclick')
                    )) {
                        return new Response('', { status: 404 });
                    }
                    return originalFetch.apply(this, args);
                };
            })();
        `;
        
        if (doc.head) {
            doc.head.insertBefore(uBlockScriptlet, doc.head.firstChild);
        }

        const cleanedHtml = doc.documentElement.outerHTML;

        // 5. Открываем чистый код в новой вкладке, чтобы обойти защиту CSP браузера Chrome
        const cleanWindow = window.open();
        if (cleanWindow) {
            cleanWindow.document.write(cleanedHtml);
            cleanWindow.document.close();
        } else {
            alert('Браузер заблокировал окно! Нажмите на иконку крестика в правой части адресной строки Chrome и выберите "Разрешить всегда".');
        }

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при загрузке: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
