// engine.js — ClearWeb Core v2.0

const PROXIES = [
    'https://api.allorigins.win/raw?url=', // Самый стабильный
    'https://corsproxy.io/?',              // Быстрый
    'https://cors.su/?url='                // Резервный
];

function log(msg) {
    const el = document.getElementById('log-area');
    el.style.display = 'block';
    el.innerHTML += `> ${msg}<br>`;
    console.log(msg);
}

async function startCleaning() {
    const input = document.getElementById('url-field');
    const btn = document.getElementById('action-btn');
    let url = input.value.trim();

    if (!url) return alert('Введите адрес сайта!');
    if (!url.startsWith('http')) url = 'https://' + url;

    btn.disabled = true;
    btn.textContent = 'Загрузка...';
    document.getElementById('log-area').innerHTML = ''; // Очистка лога

    try {
        let htmlContent = null;

        // 1. Попытка загрузки через цепочку прокси
        for (let proxy of PROXIES) {
            try {
                log(`Подключение к прокси: ${proxy.split('?')[0].split('//')[1]}...`);
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000); // 8 сек на ответ

                const response = await fetch(proxy + encodeURIComponent(url), {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
                });
                
                clearTimeout(timeout);
                if (response.ok) {
                    htmlContent = await response.text();
                    log('Сайт успешно загружен.');
                    break;
                }
            } catch (e) {
                log(`Прокси недоступен, переключаюсь...`);
                continue;
            }
        }

        if (!htmlContent) throw new Error('Не удалось загрузить сайт ни через один прокси.');

        // 2. Парсинг и "Ремонт" сайта
        log('Анализ структуры и удаление рекламы...');
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const baseUrl = new URL(url);

        // Исправление относительных ссылок (Критически важно!)
        doc.querySelectorAll('a[href], img[src], link[href], script[src], source[src]').forEach(el => {
            ['href', 'src'].forEach(attr => {
                let val = el.getAttribute(attr);
                if (val && !val.startsWith('http') && !val.startsWith('data:') && !val.startsWith('//')) {
                    // Превращаем /img/logo.png в https://site.com/img/logo.png
                    try { el.setAttribute(attr, new URL(val, baseUrl).href); } catch(e){}
                }
            });
        });

        // Массовое удаление рекламы
        const adSelectors = [
            'iframe', 'ins', '.ads', '.ad', '.banner', '.reklama', 
            '[class*="sponsor"]', '[id*="google_ads"]', '.popup', '.modal'
        ];
        let count = 0;
        adSelectors.forEach(sel => {
            doc.querySelectorAll(sel).forEach(el => {
                if (el.offsetHeight < 100 || el.className.includes('ad')) {
                    el.remove();
                    count++;
                }
            });
        });
        log(`Удалено рекламных блоков: ${count}`);

        // Внедрение защиты от динамической рекламы
        const protector = doc.createElement('script');
        protector.textContent = `
            window.fetch = new Proxy(window.fetch, {
                apply: function(target, thisArg, argumentsList) {
                    if (argumentsList[0] && argumentsList[0].includes('analytics')) return Promise.reject('Blocked');
                    return target.apply(thisArg, argumentsList);
                }
            });
        `;
        if (doc.head) doc.head.prepend(protector);

        // 3. Открытие результата через Blob (Обход блокировки Popup)
        log('Формирование чистой страницы...');
        const finalHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);

        const newWindow = window.open(blobUrl, '_blank');
        
        if (!newWindow) {
            // Если браузер все же заблокировал, предлагаем скачать
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'clearweb_page.html';
            a.click();
            alert('Браузер заблокировал окно. Файл скачан автоматически.');
        }

    } catch (err) {
        log('ОШИБКА: ' + err.message);
        alert('Ошибка: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Очистить';
    }
}

// Поддержка Enter
document.getElementById('url-field').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') startCleaning();
});
