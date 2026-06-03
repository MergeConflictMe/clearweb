// engine.js — Версия ClearWeb с обходом CSP через открытие в новой вкладке

async function processTargetSite() {
    let targetUrl = document.getElementById('url-field').value.trim();
    if (!targetUrl) return alert('Пожалуйста, введи адрес сайта!');

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    // Сообщаем пользователю, что пошел процесс чистки
    const btn = document.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Чистка рекламы...';
    btn.disabled = true;

    // Используем текстовый прокси
    const proxyUrl = 'https://api.codetabs.com/v1/proxy/?quest=' + targetUrl;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Сервер прокси занят, повторите попытку');
        let rawHtml = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        // Универсальная чистка элементов рекламы
        const universalAdSelectors = [
            'iframe[src*="bet"]', 'iframe[src*="casino"]', 'iframe[src*="slot"]', 'iframe[src*="1xbet"]',
            '.adv', '.reklama', '.banner', '[id*="banner"]', '[class*="banner"]',
            'ins.adsbygoogle', 'div[class*="teaser"]', 'a[href*="vulkan"]', '.popunder', '.popup'
        ];
        
        doc.querySelectorAll(universalAdSelectors.join(',')).forEach(element => element.remove());

        // Внедрение скриптлета (uBlock технология)
        const uBlockScriptlet = doc.createElement('script');
        uBlockScriptlet.textContent = `
            (function() {
                console.log('=== КОРНЕВОЙ БЛОКИРОВЩИК CLEARWEB АКТИВИРОВАН ===');
                window.vast_player_disabled = true;
                window.showPreroll = false;
                window.skip_ad_always = true;
                window.adblock = false; 
                window.show_vast_adv = function() { return false; };
                
                // Глушим сетевые запросы рекламы
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const url = args[0];
                    if (typeof url === 'string' && (url.includes('google-analytics') || url.includes('yandex.ru/clck') || url.includes('doubleclick'))) {
                        return new Response('', { status: 404 });
                    }
                    return originalFetch.apply(this, args);
                };
            })();
        `;
        
        if (doc.head) {
            doc.head.insertBefore(uBlockScriptlet, doc.head.firstChild);
        }

        // Получаем чистый код
        const cleanedHtml = doc.documentElement.outerHTML;

        // МАГИЯ ОБХОДА: Открываем новое пустое окно и вливаем туда наш очищенный HTML
        const cleanWindow = window.open();
        if (cleanWindow) {
            cleanWindow.document.write(cleanedHtml);
            cleanWindow.document.close(); // Заставляем браузер выполнить наши скрипты
        } else {
            alert('Браузер заблокировал всплывающее окно! Пожалуйста, разрешите всплывающие окна для этого сайта в строке браузера.');
        }

    } catch (error) {
        alert('Ошибка: ' + error.message);
    } finally {
        // Возвращаем кнопку в исходное состояние
        btn.textContent = originalText;
        btn.disabled = false;
    }
}
