/* ЧИСТЫЙ ТВ · проверенная база + реальные инструкции.
   Источники: habr.com/ru/articles/1097472, темы 4PDA (раздел «Телевизоры»).
   act=disable — только подтверждённое; ask — требует твоего решения; never — серверная защита. */
window.CTV_DATA = (() => {
    const SRC = { habr: 'https://habr.com/ru/articles/1097472/', pda: 'https://4pda.to/forum/index.php?showforum=876' };
    const P = (name, label, cat, act, risk, note, src) => ({ name, label, cat, act, risk, note, src: src || null });

    const platforms = {
        identify: {
            title: 'Как определить систему', code: '?', color: '#c6ff4d', vendors: 'Начни отсюда, если не знаешь ОС',
            steps: [
                { t: 'Открой сведения о ТВ', b: ['Настройки → Об устройстве (Google TV: Настройки → Система → Об устройстве).', 'Ищи «Версия Android», «Сборка», «Яндекс ТВ», «Салют ТВ», «MIUI TV».'] },
                { t: 'Сопоставь с платформой', b: ['Android TV / Google TV → карточка «Google TV / Android TV».', 'Яндекс ТВ (DEXP, Hartens, Leff, Hyundai, Novex, Starwind) → «Яндекс ТВ».', 'Салют ТВ / Sber → «Салют ТВ». MIUI TV / Mi TV → «Xiaomi». TCL / iFFALCON на Google TV → «Google TV / Android TV».', 'Tizen (Samsung) / webOS (LG) → метод НЕ подходит, смотри блок ниже.'] },
                { t: 'Запомни точную модель', b: ['Настройки → Об устройстве → Модель. Понадобится для темы на 4PDA и сверки имён пакетов.'] }]
        },
        googletv: {
            title: 'Google TV / Android TV', code: 'G', color: '#38c8ff', vendors: 'Sony · Philips · TCL · iFFALCON · Chromecast · Shield',
            steps: [
                { t: 'Режим разработчика', b: ['Настройки → Система → Об устройстве → «Сборка» → 7 раз OK.', 'Появится «Вы стали разработчиком». На части ТВ: Настройки → Устройство → Об устройстве → Сборка.'] },
                { t: 'Отладка', b: ['Настройки → Система → Для разработчиков → «Отладка по USB» → Вкл.', 'На большинстве ТВ этого достаточно: порт 5555 откроется сам.', 'Есть «Отладка по сети» / Network debugging — включи и её.'] },
                { t: 'Android 11+: беспроводная отладка', b: ['Если обычное подключение не идёт: Для разработчиков → «Беспроводная отладка» → Вкл.', '«Подключение с помощью кода сопряжения» → там ip:port и 6-значный код.', 'В форме включи режим «с кодом», введи их. После сопряжения введи ip:port с ГЛАВНОГО экрана отладки (порт другой).'] },
                { t: 'IP телевизора', b: ['Настройки → Сеть и интернет → выбранная сеть → Сведения → IPv4-адрес.', 'Или список клиентов в роутере.'] },
                { t: 'Подтверди ПК', b: ['На экране ТВ «Разрешить отладку?» → «Всегда разрешать» → ОК.'] }]
        },
        yandex: {
            title: 'Яндекс ТВ', code: 'Я', color: '#ffb02e', vendors: 'DEXP · Hartens · Leff · Hyundai · Novex · Starwind (CVTE)',
            steps: [
                { t: 'Режим разработчика', b: ['Настройки → Об устройстве → 7 раз «Сборка».', 'Для разработчиков → «Отладка по USB» → Вкл.'] },
                { t: 'Если пункта нет (прошивки 2025+, CVTE)', b: ['Зажми «Меню» на пульте ~1 сек → сервисное меню.', 'Стрелки: ← ↑ ← ↑ →, затем «Назад».', 'Other options → ADB Mode → On.'], w: 'Больше в сервисном меню НИЧЕГО не трогай: Panel Type, LVDS, Shipping Init = чёрный экран. Только ADB Mode.' },
                { t: 'IP и подтверждение', b: ['Настройки → Сеть → сведения → IPv4.', 'Подтверди RSA на экране ТВ.'] },
                { t: 'Помни про OTA', b: ['Обновление прошивки возвращает рекламные плагины. После OTA повтори чистку.'] }]
        },
        sber: {
            title: 'Салют ТВ', code: 'С', color: '#3dffa8', vendors: 'Sber · СберDevices',
            steps: [
                { t: 'Sber Studio', b: ['studio.sberdevices.ru → вход в Сбер ID. Официальный способ включить ADB.'] },
                { t: 'ID устройства', b: ['На ТВ: Настройки → Об устройстве → ID устройства.'] },
                { t: 'Включи ADB', b: ['В Sber Studio добавь устройство по ID и включи отладку.'], w: 'VPN на ПК выключен: он не должен перехватывать локальные маршруты.' },
                { t: 'IP и подключение', b: ['Настройки → Сеть → сведения → IPv4. Введи в форму.'] }]
        },
        xiaomi: {
            title: 'Xiaomi Mi TV', code: 'MI', color: '#ff3d5e', vendors: 'Mi TV · Redmi TV · Mi TV Stick',
            steps: [
                { t: 'Режим разработчика', b: ['Настройки → Об устройстве → 7 раз «Сборка».'] },
                { t: 'Отладка', b: ['Для разработчиков → «Отладка по USB» → Вкл; есть «Отладка по сети» — включи.'] },
                { t: 'IP и подтверждение', b: ['Настройки → Сеть → состояние → IPv4. Подтверди RSA.'] }]
        },
        tcl: {
            title: 'TCL / iFFALCON', code: 'TCL', color: '#8b7bff', vendors: 'TCL · iFFALCON · Thomson (Android/Google TV)',
            steps: [
                { t: 'Режим разработчика и отладка', b: ['Настройки → Об устройстве (или Система → Об устройстве) → 7 раз «Сборка».', 'Для разработчиков → «Отладка по USB» → Вкл.'] },
                { t: 'IP и подтверждение', b: ['Настройки → Сеть → сведения → IPv4. Подтверди RSA на экране.'], w: 'com.tcl.suspension — меню источников: без него HDMI не переключить. Программа защищает его.' }]
        },
        haier: {
            title: 'Haier / CVTE', code: 'H', color: '#ff4dd8', vendors: 'Haier · Candy · платы CVTE/Cultraview',
            steps: [
                { t: 'Отладка', b: ['Настройки → Об устройстве → 7 раз «Сборка» → «Отладка по USB».', 'Нет пункта — сервисное меню CVTE: зажать «Меню» → ← ↑ ← ↑ → → «Назад» → ADB Mode → On.'], w: 'com.cvte.tv.hkcfac нельзя даже запускать: заводской режим, умирают Input и HDMI-CEC.' },
                { t: 'IP и подтверждение', b: ['Настройки → Сеть → сведения → IPv4. Подтверди RSA.'] }]
        }
    };

    const packages = {
        yandex: [
            P('com.yandex.android.advid', 'Рекламный движок эфира', 'ads', 'disable', 'low', 'Главный источник рекламы на главной и перед приложениями. Подтверждено разбором ADB-деблоата Яндекс ТВ.', 'habr'),
            P('com.yandex.tv.recommendations', 'Рекламные «рекомендации»', 'ads', 'ask', 'medium', 'Промо-ряды кинотеатров. Имя уточни сканом на своей прошивке.', 'pda'),
            P('com.yandex.tv.analytics', 'Телеметрия интерфейса', 'telemetry', 'ask', 'medium', 'Сбор статистики; на части прошивок связан с отчётами об ошибках.', 'pda'),
            P('com.yandex.tv.acr', 'ACR — распознавание контента', 'acr', 'ask', 'medium', 'Распознаёт, что смотришь, для таргетинга. Обратимо.', 'habr'),
            P('com.yandex.tv.updater', 'Обновления прошивки', 'update', 'ask', 'medium', 'OTA возвращает рекламу; без обновлений не придут исправления.', 'habr'),
            P('com.yandex.tv.launcher', 'Штатный лаунчер', 'system', 'never', 'critical', 'Главный экран. Только замена на Projectivy.'),
            P('com.yandex.tv.services.platform', 'Платформенные сервисы', 'system', 'never', 'critical', 'Отключение = recovery и чёрный экран.', 'habr'),
            P('com.yandex.tv.live', 'Эфир и входы HDMI', 'system', 'never', 'critical', 'Перестают переключаться входы и HDMI.', 'habr'),
            P('ru.yandex.androidkeyboard.tv', 'Экранная клавиатура', 'system', 'never', 'critical', 'Единственная клавиатура.', 'habr'),
            P('com.cvte.tv.hkcfac', 'Заводской режим CVTE', 'system', 'never', 'critical', 'Нельзя даже запускать.', 'habr')],
        xiaomi: [
            P('com.miui.tv.analytics', 'Аналитика Mi TV', 'telemetry', 'disable', 'low', 'Сбор статистики MIUI TV. Подтверждено сообществом.', 'habr'),
            P('com.xiaomi.mitv.advertise', 'Рекламный сервис Mi TV', 'ads', 'disable', 'low', 'Реклама перед приложениями и на главной.', 'pda'),
            P('com.xiaomi.mitv.upgrade', 'Обновления прошивки', 'update', 'ask', 'medium', 'OTA MIUI TV.'),
            P('com.xiaomi.mitv.tvpushservice', 'Push-уведомления', 'telemetry', 'ask', 'medium', 'Фоновый маркетинг.'),
            P('com.mitv.tvhome', 'Лаунчер Mi TV', 'system', 'never', 'critical', 'Главный экран.'),
            P('com.android.inputmethod.latin', 'Клавиатура AOSP', 'system', 'never', 'critical', 'Экранная клавиатура.')],
        googletv: [
            P('com.google.android.tvrecommendations', 'Рекламные рекомендации', 'ads', 'disable', 'low', 'Промо-ряды на главном экране Google TV. Основная цель чистки; постоянно тянет сеть и ест ОЗУ.', 'pda'),
            P('com.google.android.katniss', 'Голосовой ассистент', 'perf', 'ask', 'medium', 'Google Assistant: висит в фоне и держит ОЗУ. На 2 ГБ — заметный вклад в тормоза. Умрёт голосовой поиск с пульта.', 'pda'),
            P('com.google.android.apps.tv.dreamx', 'Ambient-заставка', 'perf', 'ask', 'low', 'Фоторежим с промо: просыпается при простое, грузит сеть и память. Отключение убирает и заставку.', 'pda'),
            P('com.google.android.feedback', 'Отчёты об ошибках', 'telemetry', 'ask', 'low', 'Отправка диагностики в Google. На работу ТВ не влияет.', 'pda'),
            P('com.google.android.backuptransport', 'Облачный бэкап настроек', 'telemetry', 'ask', 'low', 'Синхронизация с аккаунтом Google в фоне.'),
            P('com.google.android.partnersetup', 'Партнёрская настройка', 'bloat', 'ask', 'low', 'Предустановка партнёрских сервисов.'),
            P('com.google.android.videos', 'Play Movies (фильмы)', 'bloat', 'ask', 'low', 'Магазин фильмов Google; в РФ не работает, но сервис висит.'),
            P('com.google.android.play.games', 'Play Games', 'bloat', 'ask', 'low', 'Игровой сервис Google в фоне.'),
            P('com.google.android.youtube.tv', 'Официальный YouTube', 'media', 'ask', 'medium', 'YouTube с рекламой. Замена — SmartTube (без рекламы); тогда этот можно отключить.', 'pda'),
            P('com.google.android.apps.tv.launcherx', 'Лаунчер Google TV', 'system', 'never', 'critical', 'Главный экран. Меняй на Projectivy, не отключай.'),
            P('com.android.location.fused', 'Служба геолокации', 'system', 'never', 'critical', 'Отключение = циклическая перезагрузка.', 'habr'),
            P('com.google.android.gms', 'Сервисы Google Play', 'system', 'never', 'critical', 'Ядро: DRM, пуш, аккаунты. Отключать нельзя.'),
            P('com.android.vending', 'Google Play Маркет', 'system', 'never', 'high', 'Установщик приложений.'),
            P('com.google.android.leanback.ime', 'Клавиатура Leanback', 'system', 'never', 'critical', 'Экранная клавиатура Android TV.')],
        sber: [
            P('ru.sberdevices.starlauncher', 'Лаунчер Салют', 'system', 'never', 'critical', 'Recovery-петля даже со сторонним лаунчером.', 'habr'),
            P('ru.sberdevices.ads', 'Рекламный модуль (кандидат)', 'ads', 'ask', 'medium', 'Имя уточни сканом.', 'pda'),
            P('ru.sberdevices.analytics', 'Аналитика (кандидат)', 'telemetry', 'ask', 'medium', 'Требует проверки на модели.', 'pda')],
        tcl: [
            P('com.tcl.suspension', 'Меню источников', 'system', 'never', 'critical', 'Пропадает меню источников — HDMI не переключить.', 'habr'),
            P('com.tcl.advertise', 'Реклама TCL (кандидат)', 'ads', 'ask', 'medium', 'Имя уточни сканом на своей модели.', 'pda')],
        haier: [
            P('com.cvte.tv.hkcfac', 'Заводской режим', 'system', 'never', 'critical', 'Нельзя даже запускать.', 'habr'),
            P('com.cvte.tv.advertise', 'Реклама CVTE (кандидат)', 'ads', 'ask', 'medium', 'Кандидат для плат CVTE.', 'pda')]
    };
    packages.generic = packages.googletv;

    const never = ['com.yandex.tv.services.platform', 'com.yandex.tv.live', 'ru.yandex.androidkeyboard.tv', 'ru.sberdevices.starlauncher', 'com.tcl.suspension', 'com.cvte.tv.hkcfac', 'com.android.location.fused', 'com.google.android.gms', 'com.android.vending'];
    const patterns = ['inputmethod', 'keyboard', 'launcher', 'tvhome', 'systemui', 'installer', 'providers', '\\.settings', 'wifi', 'bluetooth', 'hdmi', 'tvinput', 'factory', 'hkcfac', 'location\\.fused', 'services\\.platform', 'yandex\\.tv\\.live', 'tcl\\.suspension', 'starlauncher', 'gms$', 'vending'];
    const categories = { ads: { label: 'Реклама', color: '#ff3d5e' }, telemetry: { label: 'Телеметрия', color: '#8b7bff' }, acr: { label: 'ACR-слежка', color: '#ff4dd8' }, update: { label: 'Обновления', color: '#ffb02e' }, bloat: { label: 'Bloatware', color: '#38c8ff' }, perf: { label: 'Производительность', color: '#c6ff4d' }, media: { label: 'Медиа', color: '#3dffa8' }, system: { label: 'Системные', color: '#8fa2bd' }, unknown: { label: 'Вне базы', color: '#5d6f8c' } };
    const risks = { low: 'низкий', medium: 'средний', high: 'высокий', critical: 'критический' };
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    const trouble = [
        ['«failed to connect / connection refused»', 'Отладка не включена или порт закрыт. Проверь «Отладку по USB»; на CVTE — ADB Mode; на Android 11+ часто нужен режим «с кодом». ПК и ТВ в одной сети.'],
        ['«unauthorized» / «failed to authenticate»', 'Подтверди RSA на экране ТВ. Нет окна — «Отозвать авторизации отладки» в меню разработчика, выкл/вкл отладку, повтори.'],
        ['ТВ не отвечает', 'Одна подсеть (оба 192.168.x.x). Гостевая Wi-Fi и AP isolation блокируют — отключи изоляцию или основную сеть.'],
        ['VPN мешает', 'Выключи VPN на ПК и ТВ: он перехватывает локальные маршруты.'],
        ['«more than one device»', 'Отключи лишние устройства от adb и повтори.'],
        ['Брандмауэр Windows', 'Сервер слушает только localhost. Если Windows спросит про adb — разреши исходящие в частной сети.']];
    const unsupported = [
        ['Samsung (Tizen) и LG (webOS)', 'Не Android: ADB-деблоат неприменим. Реально: отключить ACR — Samsung: Настройки → Общие и конфиденциальность → Условия и конфиденциальность → «Служба информации о просмотре» → Выкл; LG: Все настройки → Общие → Система → Доп. настройки → Live Plus → Выкл.'],
        ['DNS-фильтрация', 'На роутере или в сети ТВ: AdGuard DNS 94.140.14.14 / 94.140.15.15. Режет рекламу и телеметрию на любом ТВ.'],
        ['Радикально', 'Приставка на Android TV заменяет смарт-часть; её уже можно чистить этой программой.']];

    const training = {
        device: { serial: '192.168.0.0:5555', brand: 'УЧЕБНЫЙ', model: 'ПРИМЕР (не настоящий ТВ)', android: '11', sdk: '30', fingerprint: 'training/example', ip: '192.168.0.0', packageCount: 14, platform: 'yandex', launcher: 'com.yandex.tv.launcher', ime: 'ru.yandex.androidkeyboard.tv' },
        extra: ['com.yandex.tv.partnerpromo', 'com.yandex.tv.cloudmetrics']
    };

    return { SRC, platforms, packages, never, patterns, categories, risks, riskOrder, trouble, unsupported, training };
})();