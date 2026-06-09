// engine.js — Улучшенная версия ClearWeb

async function processTargetSite() {
    let targetUrl = document.getElementById('url-field').value.trim();
    if (!targetUrl) return alert('Пожалуйста, введи адрес сайта!');

    targetUrl = targetUrl.replace(/\s+/g, '');

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        new URL(targetUrl);
    } catch (e) {
        return alert('Некорректный URL адрес!');
    }

    const btn = document.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'Загрузка...';
    btn.disabled = true;

    try {
        const proxyUrls = [
            `https://cors.su/?url=${encodeURIComponent(targetUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
        ];

        let rawHtml = null;

        for (const proxyUrl of proxyUrls) {
            try {
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                
                if (response.ok) {
                    rawHtml = await response.text();
                    console.log('Успешно загружено через:', proxyUrl);
                    break;
                }
            } catch (e) {
                console.warn('Прокси не сработал:', proxyUrl, e);
                continue;
            }
        }

        if (!rawHtml) {
            throw new Error('Все прокси-серверы недоступны. Попробуйте позже.');
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        const baseUrl = new URL(targetUrl);
        doc.querySelectorAll('a[href], img[src], link[href], script[src], source[src]').forEach(el => {
            ['href', 'src'].forEach(attr => {
                const value = el.getAttribute(attr);
                if (value && !value.startsWith('http') && !value.startsWith('data:') && !value.startsWith('//')) {
                    try {
                        el.setAttribute(attr, new URL(value, baseUrl).href);
                    } catch (e) {
                        console.warn('Не удалось исправить путь:', value);
                    }
                }
            });
        });

        const universalAdSelectors = [
            'iframe[src*="bet"]', 'iframe[src*="casino"]', 'iframe[src*="slot"]', 
            'iframe[src*="1xbet"]', 'iframe[src*="ad"]', 'iframe[src*="banner"]',
            '.adv', '.reklama', '.banner', '.advertisement', '.ads', '.ad-container',
            '[id*="banner"]', '[class*="banner"]', '[id*="reklama"]', '[class*="reklama"]',
            '[id*="ad-"]', '[class*="ad-"]', '[id*="ads"]', '[class*="ads"]',
            'ins.adsbygoogle', '.adsbygoogle', '[id*="google_ads"]', '[class*="google_ads"]',
            'div[class*="teaser"]', 'div[id*="teaser"]',
            'a[href*="vulkan"]', 'a[href*="casino"]', 'a[href*="bet"]', 'a[href*="1xbet"]',
            'a[href*="slot"]', 'a[href*="poker"]',
            '.popunder', '.popup', '.modal-ad', '.overlay-ad',
            '[class*="video-ad"]', '[id*="video-ad"]', '.preroll', '.midroll',
            '.social-widgets', '.share-buttons',
            'script[src*="google-analytics"]', 'script[src*="yandex.ru/metrika"]',
            'script[src*="doubleclick"]', 'script[src*="facebook.com/tr"]'
        ];
        
        let removedCount = 0;
        doc.querySelectorAll(universalAdSelectors.join(',')).forEach(element => {
            element.remove();
            removedCount++;
        });

        console.log(`Удалено рекламных блоков: ${removedCount}`);

        const uBlockScriptlet = doc.createElement('script');
        uBlockScriptlet.textContent = `
            (function() {
                'use strict';
                console.log('=== CLEARWEB AD BLOCKER АКТИВИРОВАН ===');
                
                window.vast_player_disabled = true;
                window.showPreroll = false;
                window.skip_ad_always = true;
                window.adblock = false;
                window.show_vast_adv = function() { return false; };
                window.Ya = window.Ya || {};
                window.Ya.adfox = function() { return { render: function(){} }; };
                
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
                    const blockedDomains = [
                        'google-analytics', 'googletagmanager', 'doubleclick',
                        'yandex.ru/clck', 'yandex.ru/metrika', 'facebook.com/tr',
                        'vk.com/rtrg', 'mail.ru/count', 'adriver', 'adfox',
                        'bet.', 'casino.', 'slot.', '1xbet'
                    ];
                    
                    if (blockedDomains.some(domain => url.includes(domain))) {
                        console.log('Заблокирован запрос:', url);
                        return new Response('', { status: 404, statusText: 'Blocked by ClearWeb' });
                    }
                    return originalFetch.apply(this, args);
                };
                
                const originalXHR = window.XMLHttpRequest.prototype.open;
                window.XMLHttpRequest.prototype.open = function(method, url) {
                    const blockedDomains = ['google-analytics', 'doubleclick', 'yandex.ru/metrika'];
                    if (blockedDomains.some(domain => url.includes(domain))) {
                        console.log('Заблокирован XHR:', url);
                        this.abort();
                        return;
                    }
                    return originalXHR.apply(this, arguments);
                };
                
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) {
                                const adSelectors = ['.banner', '.ad', '.reklama', '[class*="ad-"]'];
                                if (adSelectors.some(sel => node.matches && node.matches(sel))) {
                                    console.log('Удалена динамическая реклама:', node);
                                    node.remove();
                                }
                            }
                        });
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });
                console.log('=== CLEARWEB ЗАЩИТА АКТИВНА ===');
            })();
        `;
        
        if (doc.head) {
            doc.head.insertBefore(uBlockScriptlet, doc.head.firstChild);
        }

        const cspMeta = doc.createElement('meta');
        cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
        cspMeta.setAttribute('content', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:");
        doc.head.insertBefore(cspMeta, doc.head.firstChild);

        const cleanedHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

        const cleanWindow = window.open('', '_blank');
        if (cleanWindow) {
            cleanWindow.document.write(cleanedHtml);
            cleanWindow.document.close();
            cleanWindow.document.title = 'ClearWeb: ' + baseUrl.hostname;
        } else {
            const blob = new Blob([cleanedHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'clearweb_' + baseUrl.hostname + '.html';
            a.click();
            URL.revokeObjectURL(url);
            alert('Браузер заблокировал всплывающее окно. Файл скачан автоматически.');
        }

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при загрузке: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const urlField = document.getElementById('url-field');
    if (urlField) {
        urlField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                processTargetSite();
            }
        });
    }
});
