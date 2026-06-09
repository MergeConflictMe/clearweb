// engine.js — ClearWeb Ultimate Edition

async function startCleaning() {
    const input = document.getElementById('url-field');
    const btn = document.getElementById('action-btn');
    const logArea = document.getElementById('log-area');
    
    let url = input.value.trim();
    if (!url) return alert('Введите адрес сайта!');
    if (!url.startsWith('http')) url = 'https://' + url;

    btn.disabled = true;
    btn.textContent = '⏳ Загрузка...';
    logArea.style.display = 'block';
    logArea.innerHTML = '';

    const log = (msg) => {
        logArea.innerHTML += `<div>> ${msg}</div>`;
        console.log(msg);
    };

    try {
        // 1. Пробуем разные прокси. AllOrigins самый надежный для текста.
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`
        ];

        let htmlContent = null;
        let usedProxy = '';

        for (let proxyUrl of proxies) {
            try {
                log(`Попытка подключения: ${proxyUrl.split('/')[2]}...`);
                
                const response = await fetch(proxyUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });

                if (!response.ok) throw new Error(`Status ${response.status}`);

                // AllOrigins возвращает JSON, corsproxy.io возвращает сразу текст
                if (proxyUrl.includes('allorigins')) {
                    const data = await response.json();
                    htmlContent = data.contents;
                } else {
                    htmlContent = await response.text();
                }

                if (htmlContent && htmlContent.length > 100) {
                    usedProxy = proxyUrl;
                    log('✅ Данные получены успешно!');
                    break;
                }
            } catch (e) {
                log(`❌ Прокси не ответил: ${e.message}`);
            }
        }

        if (!htmlContent) throw new Error('Не удалось загрузить сайт. Попробуйте позже.');

        // 2. Очистка и "Ремонт" ссылок
        log('🧹 Удаление рекламы и фиксация ссылок...');
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const baseUrl = new URL(url);

        // Чиним картинки и стили (чтобы сайт не был "лысым")
        doc.querySelectorAll('a[href], img[src], link[href], script[src]').forEach(el => {
            ['href', 'src'].forEach(attr => {
                let val = el.getAttribute(attr);
                if (val && !val.startsWith('http') && !val.startsWith('data:') && !val.startsWith('//')) {
                    try { el.setAttribute(attr, new URL(val, baseUrl).href); } catch(e){}
                }
            });
        });

        // Удаляем мусор
        const trash = ['iframe', '.ads', '.banner', '.reklama', '[class*="ad-"]', '.popup'];
        trash.forEach(sel => doc.querySelectorAll(sel).forEach(el => el.remove()));

        // 3. Создаем Blob (виртуальный файл) и открываем его
        const cleanHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
        const blob = new Blob([cleanHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);

        log('🚀 Открытие чистой версии...');
        const win = window.open(blobUrl, '_blank');
        
        if (!win) {
            // Если браузер заблокировал окно, скачиваем файл
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'clearweb_result.html';
            a.click();
            alert('Окно заблокировано браузером. Файл скачан!');
        }

    } catch (err) {
        log(`💥 КРИТИЧЕСКАЯ ОШИБКА: ${err.message}`);
        alert('Ошибка: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Очистить';
    }
}

// Запуск по Enter
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('url-field');
    if(input) input.addEventListener('keypress', e => e.key === 'Enter' && startCleaning());
});
