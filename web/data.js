window.CTV_DATA = (() => {
    const SRC = { habr: 'https://habr.com/ru/articles/1097472/', pda: 'https://4pda.to/forum/index.php?showforum=876' };
    const P = (name, label, cat, act, risk, note, src) => ({ name, label, cat, act, risk, note, src: src || null });

    const platforms = {
        identify: {
            title: 'Как определить систему', code: '?', color: '#c6ff4d', vendors: 'Начни отсюда, если не знаешь ОС',
            steps: [
                { t: 'Открой сведения о ТВ', b: ['Настройки → Об устройстве (Google TV: Настройки → Система → Об устройстве).', 'Ищи «Версия Android», «Сборка», «Яндекс ТВ», «Салют ТВ», «MIUI TV».'] },
                { t: 'Сопоставь с платформой', b: ['Android TV / Google TV → «Google TV / Android TV». TCL и iFFALCON на Google TV — туда же.', 'Яндекс ТВ (DEXP, Hartens, Leff, Hyundai, Novex, Starwind) → «Яндекс ТВ».', 'Салют ТВ / Sber → «Салют ТВ». MIUI TV / Mi TV → «Xiaomi».', 'Tizen (Samsung) / webOS (LG) → метод НЕ подходит, смотри блок ниже.'] },
                { t: 'Запомни точную модель', b: ['Настройки → Об устройстве → Модель. Понадобится для темы на 4PDA.'] }]
        },
        googletv: {
            title: 'Google TV / Android TV', code: 'G', color: '#38c8ff', vendors: 'Sony · Philips · TCL · iFFALCON · Chromecast · Shield',
            steps: [
                { t: 'Режим разработчика', b: ['Настройки → Система → Об устройстве → «Сборка» → 7 раз OK.', 'На части ТВ: Настройки → Устройство → Об устройстве → Сборка.'] },
                { t: 'Отладка', b: ['Настройки → Система → Для разработчиков → «Отладка по USB» → Вкл.', 'Обычно этого достаточно: порт 5555 откроется сам.', 'Есть «Отладка по сети» — включи и её.'] },
                { t: 'Android 11+: беспроводная отладка', b: ['Для разработчиков → «Беспроводная отладка» → Вкл.', '«Подключение с помощью кода сопряжения» → ip:port и 6-значный код.', 'В форме включи режим «с кодом». После сопряжения введи ip:port с ГЛАВНОГО экрана отладки (порт другой).'] },
                { t: 'IP телевизора', b: ['Настройки → Сеть и интернет → выбранная сеть → Сведения → IPv4-адрес.', 'Или список клиентов в роутере.'] },
                { t: 'Подтверди ПК', b: ['На экране ТВ «Разрешить отладку?» → «Всегда разрешать» → ОК.'] }]
        },
        yandex: {
            title: 'Яндекс ТВ', code: 'Я', color: '#ffb02e', vendors: 'DEXP · Hartens · Leff · Hyundai · Novex · Starwind (CVTE)',
            steps: [
                { t: 'Режим разработчика', b: ['Настройки → Об устройстве → 7 раз «Сборка».', 'Для разработчиков → «Отладка по USB» → Вкл.'] },
                { t: 'Если пункта нет (прошивки 2025+, CVTE)', b: ['Зажми «Меню» на пульте ~1 сек → сервисное меню.', 'Стрелки: ← ↑ ← ↑ →, затем «Назад».', 'Other options → ADB Mode → On.'], w: 'Больше в сервисном меню НИЧЕГО не трогай: Panel Type, LVDS, Shipping Init = чёрный экран.' },
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
                { t: 'IP и подтверждение', b: ['Настройки → Сеть → сведения → IPv4. Подтверди RSA на экране.'], w: 'На TCL много системных пакетов com.tcl.* — программа блокирует их по умолчанию. Отключай только то, что помечено как разрешённое.' }]
        },
        haier: {
            title: 'Haier / CVTE', code: 'H', color: '#ff4dd8', vendors: 'Haier · Candy · платы CVTE/Cultraview',
            steps: [
                { t: 'Отладка', b: ['Настройки → Об устройстве → 7 раз «Сборка» → «Отладка по USB».', 'Нет пункта — сервисное меню CVTE: зажать «Меню» → ← ↑ ← ↑ → → «Назад» → ADB Mode → On.'], w: 'com.cvte.tv.hkcfac нельзя даже запускать: заводской режим, умирают Input и HDMI-CEC.' },
                { t: 'IP и подтверждение', b: ['Настройки → Сеть → сведения → IPv4. Подтверди RSA.'] }]
        }
    };

    /* ЯДРО СИСТЕМЫ — отключение запрещено сервером. note = что сломается. */
    const core = [
        P('android', 'Ядро системы Android', 'system', 'never', 'critical', 'Отключится всё: интерфейс, запуск приложений, возможна невозможность загрузки ТВ.'),
        P('com.android.shell', 'Оболочка ADB (shell)', 'system', 'never', 'critical', 'Программа потеряет связь с телевизором, откат станет невозможен без сброса до заводских.'),
        P('com.android.externalstorage', 'Доступ к USB-накопителям', 'system', 'never', 'critical', 'Флешки и внешние диски перестанут читаться.'),
        P('com.android.permissioncontroller', 'Выдача разрешений приложениям', 'system', 'never', 'critical', 'Приложения не смогут получить доступ к памяти, сети, микрофону.'),
        P('com.google.android.permissioncontroller', 'Выдача разрешений (Google)', 'system', 'never', 'critical', 'То же: диалоги разрешений перестанут появляться.'),
        P('com.android.keychain', 'Хранилище ключей и сертификатов', 'system', 'never', 'critical', 'Сломаются VPN, Wi-Fi с сертификатами, часть HTTPS-соединений.'),
        P('com.android.se', 'Secure Element', 'system', 'never', 'critical', 'DRM и защищённые платёжные операции.'),
        P('com.android.proxyhandler', 'Системный прокси', 'system', 'never', 'critical', 'Часть приложений потеряет доступ в интернет.'),
        P('com.android.pacprocessor', 'Автонастройка прокси (PAC)', 'system', 'never', 'high', 'Автоматическая конфигурация прокси в сети.'),
        P('com.android.captiveportallogin', 'Вход в публичные Wi-Fi', 'system', 'never', 'high', 'Не откроется страница авторизации в отеле/кафе.'),
        P('com.android.networkstack.inprocess', 'Сетевой стек Android', 'system', 'never', 'critical', 'Пропадёт сеть и Wi-Fi.'),
        P('com.android.networkstack.permissionconfig', 'Разрешения сетевого стека', 'system', 'never', 'critical', 'Сетевые разрешения перестанут выдаваться.'),
        P('com.android.networkstack.tethering.inprocess', 'Раздача интернета', 'system', 'never', 'high', 'Точка доступа и режим модема.'),
        P('com.android.tethering.overlay', 'Оверлей раздачи интернета', 'system', 'never', 'high', 'Настройки раздачи интернета.'),
        P('com.android.tethering.overlay.gsi', 'Оверлей раздачи (GSI)', 'system', 'never', 'high', 'Настройки раздачи интернета.'),
        P('com.android.hotspot2.osulogin', 'Hotspot 2.0', 'system', 'never', 'medium', 'Автоподключение к публичным Wi-Fi.'),
        P('com.android.inputdevices', 'Устройства ввода', 'system', 'never', 'critical', 'Пульт, клавиатура и мышь могут перестать работать.'),
        P('com.android.statementservice', 'Проверка ссылок между приложениями', 'system', 'never', 'high', 'Ссылки перестанут открываться в нужных приложениях.'),
        P('com.android.sharedstoragebackup', 'Бэкап общего хранилища', 'system', 'never', 'medium', 'Резервное копирование файлов.'),
        P('com.android.localtransport', 'Локальный транспорт бэкапа', 'system', 'never', 'medium', 'Локальное резервное копирование.'),
        P('com.android.backupconfirm', 'Подтверждение бэкапа', 'system', 'never', 'medium', 'Диалог подтверждения резервного копирования.'),
        P('com.android.dynsystem', 'Динамические обновления системы', 'system', 'never', 'high', 'Установка системных образов DSU.'),
        P('com.android.htmlviewer', 'Просмотр HTML-файлов', 'system', 'never', 'low', 'Открытие локальных HTML-файлов.'),
        P('com.android.soundpicker', 'Выбор системных звуков', 'system', 'never', 'low', 'Выбор мелодий и звуков уведомлений.'),
        P('com.android.printspooler', 'Служба печати', 'system', 'never', 'low', 'Печать с телевизора.'),
        P('com.android.deskclock', 'Часы и будильник', 'system', 'never', 'low', 'Штатные часы и будильники.'),
        P('com.android.dreams.basic', 'Базовая заставка', 'system', 'never', 'low', 'Стандартная заставка Android.'),
        P('com.android.wallpaperbackup', 'Резервная копия обоев', 'system', 'never', 'low', 'Восстановление обоев.'),
        P('com.android.wallpaper.livepicker', 'Выбор живых обоев', 'system', 'never', 'low', 'Установка живых обоев.'),
        P('com.android.vpndialogs', 'Разрешение на VPN', 'system', 'never', 'critical', 'VPN-приложения перестанут подключаться: не появится окно разрешения.'),
        P('com.android.companiondevicemanager', 'Сопряжение с устройствами', 'system', 'never', 'medium', 'Подключение часов, наушников и аксессуаров.'),
        P('com.android.cts.ctsshim', 'Заглушка CTS-тестов', 'system', 'never', 'low', 'Служебный компонент совместимости.'),
        P('com.android.cts.priv.ctsshim', 'Заглушка CTS (priv)', 'system', 'never', 'low', 'Служебный компонент совместимости.'),
        P('com.google.android.gsf', 'Google Services Framework', 'system', 'never', 'critical', 'Аккаунт Google, Play Маркет и пуш-уведомления перестанут работать.'),
        P('com.google.android.webview', 'WebView (встроенный браузер)', 'system', 'never', 'critical', 'Веб-экраны внутри приложений: вход, оплата, справки.'),
        P('com.tcl.android.webview', 'WebView (TCL)', 'system', 'never', 'critical', 'Веб-экраны внутри приложений на платах TCL.'),
        P('com.google.android.tts', 'Синтез речи (TTS)', 'system', 'never', 'high', 'Озвучка интерфейса и голосовые ответы.'),
        P('com.google.android.marvin.talkback', 'TalkBack — озвучка экрана', 'system', 'never', 'high', 'Экранная читалка для слабовидящих.'),
        P('com.google.android.syncadapters.calendar', 'Синхронизация календаря', 'system', 'never', 'low', 'Синхронизация календаря Google.'),
        P('com.google.android.tv.remote.service', 'Пульт из приложения Google TV', 'system', 'never', 'high', 'Управление телевизором со телефона перестанет работать.'),
        P('com.google.android.tv.frameworkpackagestubs', 'Заглушки системных пакетов TV', 'system', 'never', 'high', 'Системные вызовы Android TV.'),
        P('com.google.android.sss.authbridge', 'Мост авторизации Google', 'system', 'never', 'critical', 'Вход в аккаунт Google.'),
        P('com.google.android.apps.mediashell', 'Chromecast built-in', 'system', 'never', 'high', 'Трансляция видео с телефона на телевизор.'),
        P('com.google.android.apps.nbu.smartconnect.tv', 'Smart Connect', 'system', 'never', 'medium', 'Сопряжение и быстрое подключение устройств.'),
        P('com.google.android.ext.services', 'Расширения системных сервисов', 'system', 'never', 'high', 'Системные расширения Android.'),
        P('com.google.android.ext.shared', 'Общие системные расширения', 'system', 'never', 'high', 'Общие библиотеки системных сервисов.'),
        P('com.google.android.overlay.modules.ext.services', 'Оверлей системных расширений', 'system', 'never', 'high', 'Конфигурация системных модулей.'),
        P('com.google.android.overlay.modules.modulemetadata.forframework', 'Метаданные модулей (framework)', 'system', 'never', 'high', 'Конфигурация модулей системы.'),
        P('com.google.android.overlay.modules.permissioncontroller', 'Оверлей разрешений', 'system', 'never', 'high', 'Конфигурация выдачи разрешений.'),
        P('com.google.android.overlay.modules.permissioncontroller.forframework', 'Оверлей разрешений (framework)', 'system', 'never', 'high', 'Конфигурация выдачи разрешений.'),
        P('com.google.android.modulemetadata', 'Метаданные модулей', 'system', 'never', 'high', 'Обновляемые модули системы.'),
        P('com.google.android.onetimeinitializer', 'Первичная инициализация', 'system', 'never', 'high', 'Первичная настройка компонентов.'),
        P('com.google.android.tungsten.setupwraith', 'Мастер первичной настройки', 'system', 'never', 'critical', 'Настройка телевизора после сброса.'),
        P('com.tcl.system.server', 'Системный сервер TCL', 'system', 'never', 'critical', 'Ядро оболочки TCL: интерфейс и службы телевизора.'),
        P('com.tcl.tv', 'Эфирное ТВ TCL', 'system', 'never', 'critical', 'Просмотр эфирных каналов и работа тюнера.'),
        P('com.tcl.ttvs', 'ТВ-сервис TCL', 'system', 'never', 'critical', 'Служба телевидения.'),
        P('com.tcl.guard', 'Служба защиты TCL', 'system', 'never', 'high', 'Системные проверки безопасности.'),
        P('com.tcl.initsetup', 'Первичная настройка TCL', 'system', 'never', 'critical', 'Настройка телевизора после сброса.'),
        P('com.tcl.autopair', 'Автосопряжение пульта', 'system', 'never', 'critical', 'Пульт перестанет подключаться по Bluetooth.'),
        P('com.tcl.micmanager', 'Менеджер микрофона', 'system', 'never', 'high', 'Голосовое управление и микрофон пульта.'),
        P('com.tcl.tv.tclhome_passive', 'Домашний экран TCL', 'system', 'never', 'critical', 'Главный экран телевизора.'),
        P('com.tcl.channelpus', 'Каналы TCL', 'system', 'never', 'high', 'Список и переключение каналов.'),
        P('com.tcl.t_solo', 'Служба TCL Solo', 'system', 'never', 'high', 'Системная служба платформы TCL.'),
        P('com.tcl.ui_mediaCenter', 'Медиацентр TCL', 'system', 'never', 'high', 'Просмотр файлов с флешки и по сети через штатный медиацентр.'),
        P('com.tcl.suspension', 'Меню источников (HDMI)', 'system', 'never', 'critical', 'Пропадёт меню источников — HDMI не переключить.', 'habr'),
        P('com.google.android.apps.tv.launcherx', 'Лаунчер Google TV', 'system', 'never', 'critical', 'Главный экран. Меняй на Projectivy, не отключай.'),
        P('com.google.android.gms', 'Сервисы Google Play', 'system', 'never', 'critical', 'DRM, пуш, аккаунты, работа большинства приложений.'),
        P('com.android.vending', 'Google Play Маркет', 'system', 'never', 'high', 'Установка и обновление приложений.'),
        P('com.android.location.fused', 'Служба геолокации', 'system', 'never', 'critical', 'Циклическая перезагрузка.', 'habr'),
        P('com.google.android.leanback.ime', 'Клавиатура Leanback', 'system', 'never', 'critical', 'Экранная клавиатура Android TV.'),
        P('com.tcl.inputmethod.international', 'Клавиатура TCL', 'system', 'never', 'critical', 'Экранная клавиатура: нечем будет вводить текст.'),
        P('com.yandex.tv.services.platform', 'Платформенные сервисы Яндекс ТВ', 'system', 'never', 'critical', 'Recovery и чёрный экран.', 'habr'),
        P('com.yandex.tv.live', 'Эфир и входы HDMI (Яндекс)', 'system', 'never', 'critical', 'Перестают переключаться входы и HDMI.', 'habr'),
        P('ru.yandex.androidkeyboard.tv', 'Клавиатура Яндекс ТВ', 'system', 'never', 'critical', 'Единственная клавиатура в системе.', 'habr'),
        P('com.yandex.tv.launcher', 'Лаунчер Яндекс ТВ', 'system', 'never', 'critical', 'Главный экран.'),
        P('ru.sberdevices.starlauncher', 'Лаунчер Салют', 'system', 'never', 'critical', 'Recovery-петля даже со сторонним лаунчером.', 'habr'),
        P('com.cvte.tv.hkcfac', 'Заводской режим CVTE', 'system', 'never', 'critical', 'Нельзя даже запускать: заводской режим, умирают Input и HDMI-CEC.', 'habr'),
        P('com.mitv.tvhome', 'Лаунчер Mi TV', 'system', 'never', 'critical', 'Главный экран.'),
        P('com.android.inputmethod.latin', 'Клавиатура AOSP', 'system', 'never', 'critical', 'Экранная клавиатура.')
    ];

    /* РАЗРЕШЕНО: реклама, телеметрия, bloat и производительность. */
    const googletv = [
        P('com.google.android.tvrecommendations', 'Рекламные рекомендации Google TV', 'ads', 'disable', 'low', 'Исчезнут промо-ряды на главном экране. Перестанет постоянно тянуть сеть.', 'pda'),
        P('com.google.android.katniss', 'Голосовой ассистент Google', 'perf', 'ask', 'medium', 'Умрёт голосовой поиск с пульта. Освободит заметную часть ОЗУ на 2 ГБ.', 'pda'),
        P('com.google.android.apps.tv.dreamx', 'Ambient-заставка', 'perf', 'ask', 'low', 'Пропадёт фоторежим при простое. Меньше фоновой активности и трафика.', 'pda'),
        P('com.google.android.feedback', 'Отчёты об ошибках', 'telemetry', 'ask', 'low', 'Диагностика перестанет отправляться в Google. На работу ТВ не влияет.', 'pda'),
        P('com.google.android.backuptransport', 'Облачный бэкап настроек', 'telemetry', 'ask', 'low', 'Настройки перестанут синхронизироваться с аккаунтом Google.'),
        P('com.google.android.partnersetup', 'Партнёрская настройка', 'bloat', 'ask', 'low', 'Предустановка партнёрских сервисов. Обычно не нужна.'),
        P('com.google.android.videos', 'Play Movies (фильмы Google)', 'bloat', 'ask', 'low', 'Магазин фильмов Google в РФ не работает — сервис просто висит в памяти.'),
        P('com.google.android.play.games', 'Play Games', 'bloat', 'ask', 'low', 'Игровой сервис Google: достижения и облачные сохранения.'),
        P('com.google.android.youtube.tv', 'YouTube официальный', 'media', 'ask', 'medium', 'YouTube исчезнет. Замена без рекламы — SmartTube (ставится отдельно).', 'pda'),
        P('com.google.android.youtube.tvmusic', 'YouTube Music', 'media', 'ask', 'low', 'Приложение YouTube Music исчезнет из лаунчера.')
    ];

    const tcl = [
        P('com.tcl.waterfall.overseas', 'Лента рекомендаций TCL', 'ads', 'ask', 'low', 'Пропадёт лента промо на главном экране TCL.'),
        P('com.tcl.tclchannel.overlay', 'FAST-каналы TCL', 'ads', 'ask', 'medium', 'Пропадут бесплатные рекламные интернет-каналы TCL.'),
        P('com.tcl.advertise', 'Рекламный модуль TCL', 'ads', 'ask', 'medium', 'Имя-кандидат: сверь сканом на своей модели.', 'pda'),
        P('com.tcl.assistant', 'Ассистент TCL', 'perf', 'ask', 'medium', 'Голосовой помощник TCL перестанет отвечать.'),
        P('com.tcl.browser', 'Браузер TCL', 'bloat', 'ask', 'low', 'Штатный браузер исчезнет. Сторонний браузер продолжит работать.'),
        P('com.tcl.gallery', 'Галерея TCL', 'bloat', 'ask', 'medium', 'Просмотр фото и видео через штатную галерею. Файлы на флешке останутся доступны другим приложениям.'),
        P('com.tcl.esticker', 'Стикеры TCL', 'bloat', 'ask', 'low', 'Декоративные стикеры в интерфейсе.'),
        P('com.tcl.messagebox', 'Уведомления TCL', 'bloat', 'ask', 'low', 'Всплывающие сообщения и промо от TCL.'),
        P('com.tcl.useragreement', 'Пользовательское соглашение', 'bloat', 'ask', 'low', 'Экран соглашения при настройке.'),
        P('com.tcl.usercenter', 'Личный кабинет TCL', 'bloat', 'ask', 'low', 'Аккаунт TCL и его сервисы.'),
        P('com.tcl.dashboard', 'Панель TCL', 'bloat', 'ask', 'medium', 'Быстрая панель настроек TCL.'),
        P('com.tcl.customize.overlay', 'Кастомизация интерфейса', 'bloat', 'ask', 'medium', 'Часть настроек внешнего вида оболочки.'),
        P('com.tcl.partnercustomizer', 'Партнёрские настройки', 'bloat', 'ask', 'low', 'Предустановленные партнёрские параметры.'),
        P('com.tcl.miracast', 'Miracast', 'media', 'ask', 'medium', 'Трансляция экрана телефона по Wi-Fi Direct.'),
        P('com.tcl.MultiScreenInteraction_TV', 'Мультиэкран TCL', 'media', 'ask', 'medium', 'Взаимодействие с несколькими экранами.'),
        P('com.tcl.keyhelp', 'Подсказки по кнопкам пульта', 'bloat', 'ask', 'low', 'Всплывающие подсказки по пульту.'),
        P('com.tcl.hotemenu', 'Отельный режим', 'bloat', 'ask', 'low', 'Меню отельного режима. Дома не используется.')
    ];

    const yandex = [
        P('com.yandex.android.advid', 'Рекламный движок Яндекс ТВ', 'ads', 'disable', 'low', 'Исчезнет реклама на главной и перед приложениями.', 'habr'),
        P('com.yandex.tv.recommendations', 'Рекламные рекомендации', 'ads', 'ask', 'medium', 'Промо-ряды кинотеатров. Имя уточни сканом.', 'pda'),
        P('com.yandex.tv.analytics', 'Телеметрия интерфейса', 'telemetry', 'ask', 'medium', 'Статистика использования. На части прошивок связана с отчётами об ошибках.', 'pda'),
        P('com.yandex.tv.acr', 'ACR — распознавание контента', 'acr', 'ask', 'medium', 'Перестанет распознавать, что ты смотришь, для таргетинга рекламы.', 'habr'),
        P('com.yandex.tv.updater', 'Обновления прошивки', 'update', 'ask', 'medium', 'OTA перестанет приходить. Реклама не вернётся, но и патчи тоже.', 'habr')
    ];
    const xiaomi = [
        P('com.miui.tv.analytics', 'Аналитика Mi TV', 'telemetry', 'disable', 'low', 'Статистика MIUI TV перестанет собираться.', 'habr'),
        P('com.xiaomi.mitv.advertise', 'Рекламный сервис Mi TV', 'ads', 'disable', 'low', 'Исчезнет реклама перед приложениями и на главной.', 'pda'),
        P('com.xiaomi.mitv.upgrade', 'Обновления прошивки', 'update', 'ask', 'medium', 'OTA MIUI TV перестанет приходить.'),
        P('com.xiaomi.mitv.tvpushservice', 'Push-уведомления Mi TV', 'telemetry', 'ask', 'medium', 'Фоновые маркетинговые уведомления.')
    ];
    const sber = [
        P('ru.sberdevices.ads', 'Рекламный модуль Салют', 'ads', 'ask', 'medium', 'Имя-кандидат: уточни сканом на своей прошивке.', 'pda'),
        P('ru.sberdevices.analytics', 'Аналитика Салют', 'telemetry', 'ask', 'medium', 'Кандидат сообщества, требует проверки.', 'pda')
    ];
    const haier = [P('com.cvte.tv.advertise', 'Реклама CVTE', 'ads', 'ask', 'medium', 'Кандидат для плат CVTE/Cultraview.', 'pda')];

    /* ПОЛЬЗОВАТЕЛЬСКИЕ ПРИЛОЖЕНИЯ — отключать безопасно, просто исчезнут из лаунчера. */
    const apps = [
        P('ru.kinopoisk.tv', 'Кинопоиск', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера. Фильмы через него смотреть не получится.'),
        P('ru.start.androidmobile', 'START', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера.'),
        P('gpm.tnt_premier', 'PREMIER', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера.'),
        P('mobi.zona', 'ZONA', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера.'),
        P('com.vk.tv', 'VK Видео', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера.'),
        P('ru.yandex.music', 'Яндекс Музыка', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера.'),
        P('tv.wuaki.apptv', 'Видеосервис Wuaki / Wink', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера. Точное название сверь на ТВ.'),
        P('com.tvos', 'Приложение TVOS', 'apps', 'ask', 'medium', 'Назначение уточни на ТВ перед отключением.'),
        P('com.netflix.ninja', 'Netflix', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера.'),
        P('com.amazon.amazonvideo.livingroom', 'Prime Video', 'apps', 'ask', 'low', 'Приложение исчезнет из лаунчера.'),
        P('com.valvesoftware.steamlink', 'Steam Link', 'apps', 'ask', 'low', 'Трансляция игр с ПК на телевизор.'),
        P('com.hiro.vpn', 'Hiro VPN', 'apps', 'ask', 'low', 'VPN-приложение исчезнет. Учти: системный com.android.vpndialogs отключать нельзя.'),
        P('com.lagomproductsllc.lagomvpn', 'Lagom VPN', 'apps', 'ask', 'low', 'VPN-приложение исчезнет из лаунчера.'),
        P('com.ogonconnect.app', 'Ogon Connect (VPN)', 'apps', 'ask', 'low', 'VPN-приложение исчезнет из лаунчера.'),
        P('com.pipinetwork.piplvpn', 'PIPL VPN', 'apps', 'ask', 'low', 'VPN-приложение исчезнет из лаунчера.')
    ];

    const packages = { core, googletv, tcl, yandex, xiaomi, sber, haier, apps };
    packages.generic = googletv;

    const all = Object.values(packages).flat();
    const never = all.filter(p => p.act === 'never').map(p => p.name);
    const patterns = ['inputmethod', 'keyboard', 'launcher', 'tvhome', 'tclhome', 'systemui', 'installer', 'providers',
        '\\.settings', 'wifi', 'bluetooth', 'hdmi', 'tvinput', 'factory', 'hkcfac', 'location\\.fused', 'services\\.platform',
        'yandex\\.tv\\.live', 'tcl\\.suspension', 'starlauncher', 'gms$', 'gsf$', 'vending', '^android$', '^com\\.android\\.',
        'webview', 'permissioncontroller', 'externalstorage', 'documentsui', '\\.shell$', 'networkstack', 'tethering',
        'captiveportal', 'keychain', 'proxyhandler', 'pacprocessor', 'statementservice', 'sharedstoragebackup',
        'localtransport', 'backupconfirm', 'dynsystem', 'inputdevices', 'vpndialogs', 'companiondevicemanager', 'ctsshim',
        'setupwraith', 'authbridge', 'mediashell', 'smartconnect', 'ext\\.services', 'ext\\.shared', 'modulemetadata',
        'onetimeinitializer', 'overlay\\.modules', 'syncadapters', '\\.tts$', 'talkback', 'remote\\.service',
        'frameworkpackagestubs', 'com\\.tcl\\.system', 'com\\.tcl\\.guard', 'com\\.tcl\\.initsetup', 'com\\.tcl\\.autopair',
        'com\\.tcl\\.micmanager', 'com\\.tcl\\.ttvs', '^com\\.tcl\\.tv$', 'channelpus', 't_solo', 'ui_mediacenter'];

    const categories = {
        ads: { label: 'Реклама', color: '#ff3d5e' }, telemetry: { label: 'Телеметрия', color: '#8b7bff' },
        acr: { label: 'ACR-слежка', color: '#ff4dd8' }, update: { label: 'Обновления', color: '#ffb02e' },
        bloat: { label: 'Bloatware', color: '#38c8ff' }, perf: { label: 'Производительность', color: '#c6ff4d' },
        media: { label: 'Медиа', color: '#3dffa8' }, apps: { label: 'Приложения', color: '#38c8ff' },
        system: { label: 'Системные', color: '#8fa2bd' }, unknown: { label: 'Вне базы', color: '#5d6f8c' }
    };
    const risks = { low: 'низкий', medium: 'средний', high: 'высокий', critical: 'критический' };
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    const trouble = [
        ['«failed to connect / connection refused»', 'Отладка не включена или порт закрыт. Проверь «Отладку по USB»; на CVTE — ADB Mode; на Android 11+ нужен режим «с кодом». ПК и ТВ в одной сети.'],
        ['«unauthorized» / «failed to authenticate»', 'Подтверди RSA на экране ТВ. Нет окна — «Отозвать авторизации отладки», выкл/вкл отладку, повтори.'],
        ['ТВ не отвечает', 'Одна подсеть (оба 192.168.x.x). Гостевая Wi-Fi и AP isolation блокируют соединение.'],
        ['VPN мешает', 'Выключи VPN на ПК и ТВ: он перехватывает локальные маршруты.'],
        ['«more than one device»', 'Отключи лишние устройства от adb и повтори.'],
        ['Пропали флешки / HDMI / пульт', 'Значит, был отключён системный пакет. Журналы → Откатить. Новая версия блокирует такие пакеты на сервере.']];
    const unsupported = [
        ['Samsung (Tizen) и LG (webOS)', 'Не Android: ADB-деблоат неприменим. Реально: отключить ACR — Samsung: Настройки → Общие и конфиденциальность → Условия и конфиденциальность → Служба информации о просмотре → Выкл; LG: Все настройки → Общие → Система → Доп. настройки → Live Plus → Выкл.'],
        ['DNS-фильтрация', 'На роутере или в сети ТВ: AdGuard DNS 94.140.14.14 / 94.140.15.15.'],
        ['Радикально', 'Приставка на Android TV заменяет смарт-часть; её можно чистить этой программой.']];

    const training = {
        device: { serial: '192.168.0.0:5555', brand: 'УЧЕБНЫЙ', model: 'ПРИМЕР (не настоящий ТВ)', android: '11', sdk: '30', fingerprint: 'training/example', ip: '192.168.0.0', packageCount: 14, platform: 'yandex', launcher: 'com.yandex.tv.launcher', ime: 'ru.yandex.androidkeyboard.tv' },
        extra: ['com.yandex.tv.partnerpromo', 'com.yandex.tv.cloudmetrics']
    };

    return { SRC, platforms, packages, never, patterns, categories, risks, riskOrder, trouble, unsupported, training };
})();