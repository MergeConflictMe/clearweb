// engine.js — Стабильная версия ClearWeb

async function processTargetSite() {
    const input = document.getElementById('url-field');
    const btn = document.querySelector('button');
    let targetUrl = input.value.trim();

    if (!targetUrl) {
        alert('Пожалуйста, введи адрес сайта!');
        return;
    }

    // Нормализация URL
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    // Валидация URL
    try {
        new URL(targetUrl);
    } catch (_) {
        alert('Некорректный URL адрес!');
        return;
    }

    const originalText = btn.textContent;
    btn.textContent = '⏳ Загрузка и очистка...';
    btn.disabled = true;
    input.disabled = true;

    try {
        // Список прокси для перебора (если один не работает, берем другой)
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            `https://cors.su/?url=${encodeURIComponent(targetUrl)}` 
        ];

        let rawHtml = null;
        let lastError = null;

        // Пробуем каждый прокси по очереди
        for (const proxyUrl of proxies) {
            try {
                console.log(`Попытка загрузки через: ${proxyUrl}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // Тайм-аут 10 сек

                const response = await fetch(proxyUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                
                clearTimeout(timeoutId);

                if (response.ok) {
                    rawHtml = await response.text();
                    console.log('Успешно загружено через прокси.');
                    break; // Если успешно, выходим из цикла
                }
            } catch (err) {
                console.warn(`Прокси ${proxyUrl} не сработал:`, err);
                lastError = err;
                continue;
            }
        }

        if (!rawHtml) {
            throw new Error('Не удалось загрузить сайт. Все прокси-серверы недоступны или заблокированы.');
        }

        // --- ОЧИСТКА HTML ---
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');
        const baseUrl = new URL(targetUrl);

        // 1. Исправление относительных путей (картинки, ссылки, стили)
        doc.querySelectorAll('a[href], img[src], link[href], script[src], source[src]').forEach(el => {
            ['href', 'src'].forEach(attr => {
                const val = el.getAttribute(attr);
                if (val && !val.startsWith('http') && !val.startsWith('data:') && !val.startsWith('//')) {
                    try {
                        el.setAttribute(attr, new URL(val, baseUrl).href);
                    } catch (e) { /* игнорируем битые ссылки */ }
                }
            });
        });

        // 2. Удаление рекламы (CSS селекторы)
        const adSelectors = [
            'iframe', 'ins', '.ads', '.ad', '.banner', '.reklama', '#advertisement',
            '[class*="ad-"]', '[id*="ad-"]', '[class*="banner"]', '[class*="sponsor"]',
            'div[id*="google_ads"]', 'div[class*="popup"]', '.modal-overlay'
        ];
        
        let removedCount = 0;
        adSelectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => {
                // Простая эвристика: если элемент маленький или скрыт, удаляем
                if (el.offsetHeight < 50 || el.offsetWidth < 50 || el.className.includes('ad')) {
                    el.remove();
                    removedCount++;
                }
            });
        });
        console.log(`Удалено элементов: ${removedCount}`);

        // 3. Внедрение скрипта блокировки внутри страницы
        const blockerScript = doc.createElement('script');
        blockerScript.textContent = `
            (function() {
                console.log('ClearWeb Active');
                // Блокировка fetch запросов к трекерам
                const origFetch = window.fetch;
                window.fetch = function(...args) {
                    if (args[0] && typeof args[0] === 'string' && 
                        (args[0].includes('analytics') || args[0].includes('doubleclick'))) {
                        return Promise.reject('Blocked by ClearWeb');
                    }
                    return origFetch.apply(this, args);
                };
            })();
        `;
        if (doc.head) doc.head.prepend(blockerScript);

        // 4. Формирование итогового HTML
        const finalHtml = doc.documentElement.outerHTML;

        // --- ОТКРЫТИЕ РЕЗУЛЬТАТА ---
        
        // Попытка открыть в новом окне
        const newWindow = window.open('', '_blank');
        
        if (newWindow) {
            newWindow.document.write(finalHtml);
            newWindow.document.close(); // Важно для завершения загрузки
        } else {
            // Если браузер заблокировал popup, скачиваем файл
            const blob = new Blob([finalHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clearweb_${baseUrl.hostname}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Браузер заблокировал всплывающее окно. Файл скачан на компьютер. Откройте его вручную.');
        }

    } catch (error) {
        console.error(error);
        alert('Ошибка: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
        input.disabled = false;
    }
}

// Обработка нажатия Enter
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('url-field');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') processTargetSite();
        });
    }
});
