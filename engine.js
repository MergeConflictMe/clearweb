async function cleanAndOpen() {
    const input = document.getElementById('urlInput');
    const btn = document.getElementById('btn');
    const logDiv = document.getElementById('log');
    
    let url = input.value.trim();
    if (!url) return alert('Введите адрес!');
    if (!url.startsWith('http')) url = 'https://' + url;

    btn.disabled = true;
    btn.textContent = 'Загрузка...';
    logDiv.style.display = 'block';
    logDiv.innerHTML = '> Инициализация...<br>';

    const log = (msg) => logDiv.innerHTML += `> ${msg}<br>`;

    try {
        // Используем allorigins, так как он возвращает JSON с полем contents
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        log('Запрос к прокси...');
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
        
        const data = await response.json();
        if (!data.contents) throw new Error('Прокси вернул пустой ответ');

        log('Данные получены. Очистка...');
        
        // Парсим HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        const baseUrl = new URL(url);

        // 1. Чиним ссылки (картинки, стили)
        doc.querySelectorAll('[src], [href]').forEach(el => {
            ['src', 'href'].forEach(attr => {
                let val = el.getAttribute(attr);
                if (val && !val.startsWith('http') && !val.startsWith('data:') && !val.startsWith('//')) {
                    try { el.setAttribute(attr, new URL(val, baseUrl).href); } catch(e){}
                }
            });
        });

        // 2. Режем рекламу
        const ads = ['iframe', '.ads', '.banner', '.reklama', '[class*="ad-"]'];
        ads.forEach(sel => doc.querySelectorAll(sel).forEach(el => el.remove()));

        // 3. Создаем Blob и открываем
        const cleanHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
        const blob = new Blob([cleanHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);

        log('Готово! Открываю вкладку...');
        window.open(blobUrl, '_blank');

    } catch (err) {
        log('❌ ОШИБКА: ' + err.message);
        alert('Не удалось загрузить: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Открыть чисто';
    }
}
