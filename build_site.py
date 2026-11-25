# -*- coding: utf-8 -*-
"""
Сборщик статического сайта MathVizor.

Берёт каркас из «Структура_сайта.html», извлекает оттуда готовый код
index.html и technology.html, затем по тому же шаблону (шапка/подвал)
собирает остальные страницы. Запуск: python build_site.py
"""
import html
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SPEC = ROOT / "Структура_сайта.html"

# --------------------------------------------------------------------------
# 1. Извлекаем код из рабочего документа
# --------------------------------------------------------------------------
spec = SPEC.read_text(encoding="utf-8")
blocks = {}
for match in re.finditer(r'<div class="code-head">.*?<span class="name">(.*?)</span>.*?<pre><code>(.*?)</code></pre>', spec, re.S):
    name = html.unescape(match.group(1)).strip()
    blocks[name] = html.unescape(match.group(2))

index_code = blocks["index.html"]
technology_code = blocks["technology.html"]

# Шапка и подвал — из index.html, чтобы все страницы были идентичны
h_start = index_code.index("  <!-- ================= ШАПКА")
h_end = index_code.index('  <main id="main">')
header = index_code[h_start:h_end].rstrip() + "\n"

f_start = index_code.index("  <!-- ================= ПОДВАЛ")
f_end = index_code.index('  <script src="assets/js/main.js"')
footer = index_code[f_start:f_end].rstrip() + "\n"

head_start = index_code.index("<head>")
head_end = index_code.index("</head>") + len("</head>")
base_head = index_code[head_start:head_end]


def make_head(title, desc):
    h = base_head
    h = re.sub(r"<title>.*?</title>", "<title>%s</title>" % title, h, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content=".*?">',
               '<meta name="description" content="%s">' % desc, h, count=1, flags=re.S)
    h = re.sub(r'<meta property="og:title" content=".*?">',
               '<meta property="og:title" content="%s">' % title, h, count=1, flags=re.S)
    h = re.sub(r'<meta property="og:description" content=".*?">',
               '<meta property="og:description" content="%s">' % desc, h, count=1, flags=re.S)
    return h


def set_active(head, href):
    head = head.replace(' class="is-active"', "").replace(' aria-current="page"', "")
    pattern = re.compile(r'<a([^>]*?href="%s"[^>]*?)>' % re.escape(href))
    replacement = lambda m: "<a" + m.group(1) + ' class="is-active" aria-current="page">'
    head, count = pattern.subn(replacement, head, count=1)
    if count == 0:
        raise ValueError("Не найден активный пункт меню: " + href)
    return head


def write_page(filename, title, desc, active, main, head=None):
    page = (
        "<!doctype html>\n"
        + (head if head else make_head(title, desc))
        + '\n<body>\n  <a class="skip-link" href="#main">Перейти к содержимому</a>\n\n'
        + set_active(header, active)
        + '\n\n  <main id="main">\n'
        + main.strip()
        + "\n  </main>\n\n"
        + footer
        + '\n  <script src="assets/js/main.js" defer></script>\n</body>\n</html>\n'
    )
    (ROOT / filename).write_text(page, encoding="utf-8")


def crumbs(*items):
    links = "".join('<li><a href="%s">%s</a></li>' % pair for pair in items[:-1])
    last = items[-1]
    if isinstance(last, (tuple, list)):
        last = last[0]
    return ('<nav class="breadcrumbs" aria-label="Хлебные крошки"><ol>'
            + links + '<li aria-current="page">' + last + '</li></ol></nav>')


# --------------------------------------------------------------------------
# 2. index.html и technology.html — из готового кода документа
# --------------------------------------------------------------------------
hero_needle = """        </div>
      </div>
    </section>

    <!-- 2. КЛЮЧЕВЫЕ ЦИФРЫ -->"""
hero_replacement = """        </div>
        <figure class="hero-art">
          <img src="assets/img/hero-math.svg" alt="Абстрактная визуализация графиков функций и критических точек">
        </figure>
      </div>
    </section>

    <!-- 2. КЛЮЧЕВЫЕ ЦИФРЫ -->"""
assert hero_needle in index_code, "Не найден hero-блок для вставки иллюстрации"
index_code = index_code.replace(hero_needle, hero_replacement, 1)

# Рабочий адрес опубликованного сайта (не демонстрационная заглушка)
hero_actions = """        <div class="actions">
          <a class="btn btn-primary" href="platform.html">Познакомиться с платформой</a>
          <a class="btn btn-ghost" href="publications.html">Читать статью</a>
        </div>"""
hero_actions_new = """        <div class="actions">
          <a class="btn btn-primary" href="platform.html">Познакомиться с платформой</a>
          <a class="btn btn-ghost" href="publications.html">Читать статью</a>
          <a class="btn btn-ghost" href="https://asmankinigor.github.io/mysite/" target="_blank" rel="noopener">Открыть сайт проекта</a>
        </div>"""
assert hero_actions in index_code, "Не найдены кнопки hero-блока"
index_code = index_code.replace(hero_actions, hero_actions_new, 1)

(ROOT / "index.html").write_text(index_code.rstrip() + "\n", encoding="utf-8")

tech_main = technology_code[technology_code.index('  <main id="main">'):technology_code.index("  </main>") + len("  </main>")]
tech_main = tech_main.replace('  <main id="main">', "", 1).replace("  </main>", "", 1)
write_page(
    "technology.html",
    "Архитектура и технологии — MathVizor",
    "Трёхслойная архитектура платформы MathVizor: TypeScript, React, Python, FastAPI, SymPy, PostgreSQL, LTI 1.3 и xAPI.",
    "platform.html",
    tech_main,
)

# --------------------------------------------------------------------------
# 3. Остальные страницы
# --------------------------------------------------------------------------

platform_main = """
""" + crumbs(("index.html", "Главная"), ("Платформа",)) + """

<section class="page-head">
  <div class="container">
    <h1>Платформа MathVizor</h1>
    <p class="lead">Веб-приложение для математического эксперимента: от постановки задачи до рефлексии — в одном рабочем пространстве.</p>
  </div>
</section>

<section class="section" id="cycle">
  <div class="container">
    <h2>Непрерывный цикл исследования</h2>
    <ol class="steps steps-inline">
      <li>Постановка задачи</li><li>Модель</li><li>Эксперимент</li><li>Объяснение</li><li>Рефлексия</li>
    </ol>
    <p>Каждая группа цифровых ресурсов решает собственную задачу, но не обеспечивает непрерывности этого цикла. MathVizor объединяет все пять этапов в одной среде.</p>
  </div>
</section>

<section class="section section-alt" id="workspace">
  <div class="container">
    <h2>Рабочий лист</h2>
    <div class="two-columns">
      <div>
        <p>Слева — условие задания и инструменты визуализации, в центре — график или геометрическая конфигурация, справа — панель пошагового решения. Обучающийся изменяет параметры ползунками, формулирует гипотезу и проверяет её вычислениями.</p>
        <p>Преподаватель видит задачу в режиме мониторинга и может отправлять подсказки.</p>
      </div>
      <figure>
        <img src="assets/img/screenshots/01-workspace.jpg" alt="Скриншот рабочего листа платформы MathVizor">
        <figcaption>Рисунок 1 — рабочий лист MathVizor (скриншот из материалов заявки)</figcaption>
      </figure>
    </div>
  </div>
</section>

<section class="section section-alt" id="interface">
  <div class="container">
    <h2>Образовательная среда университета</h2>
    <p>Разработка создаётся в среде педагогического технопарка, где объединены естественно-математические дисциплины, информационные технологии и методики обучения. Ниже — фотографии с официального сайта МГПУ им. М. Е. Евсевьева (<a href="https://www.mordgpi.ru/" target="_blank" rel="noopener">mordgpi.ru</a>).</p>
    <div class="gallery">
      <figure><img src="assets/img/screenshots/01-kvanatorium.jpg" alt="Педагогический технопарк «Кванториум» МГПУ"><figcaption>Педагогический технопарк «Кванториум»</figcaption></figure>
      <figure><img src="assets/img/screenshots/02-open-day-workshops.jpg" alt="Мастер-классы факультетов в День открытых дверей МГПУ"><figcaption>Мастер-классы в День открытых дверей</figcaption></figure>
      <figure><img src="assets/img/screenshots/03-open-day.jpg" alt="День открытых дверей в МГПУ им. М. Е. Евсевьева"><figcaption>День открытых дверей</figcaption></figure>
      <figure><img src="assets/img/screenshots/04-research-ideas.jpg" alt="Студенческие исследовательские идеи в МГПУ"><figcaption>Исследовательские идеи студентов</figcaption></figure>
      <figure><img src="assets/img/screenshots/05-profile-classes.jpg" alt="Профильные классы психолого-педагогической направленности МГПУ"><figcaption>Профильные классы психолого-педагогической направленности</figcaption></figure>
      <figure><img src="assets/img/screenshots/06-olympiad.jpg" alt="Открытие Всероссийской олимпиады по иностранным языкам в МГПУ"><figcaption>Всероссийская олимпиада студентов</figcaption></figure>
    </div>
  </div>
</section>

<section class="section" id="modules">
  <div class="container">
    <h2>Четыре модуля платформы</h2>
    <ul class="card-grid">
      <li class="card"><h3>Визуализация</h3><p>Графики функций и динамические модели с изменением параметров.</p></li>
      <li class="card"><h3>Вычисления</h3><p>Пошаговые преобразования с подсказками и объяснениями.</p></li>
      <li class="card"><h3>Практика</h3><p>Индивидуальные задания с учётом типа ошибок.</p></li>
      <li class="card"><h3>Аналитика</h3><p>Сводка действий и типичных затруднений для преподавателя.</p></li>
    </ul>
  </div>
</section>

<section class="section section-alt" id="matrix">
  <div class="container">
    <h2>Компоненты и педагогические задачи</h2>
    <figure class="table-block">
      <table class="data-table">
        <caption>Таблица 1. Соответствие компонентов платформы педагогическим задачам</caption>
        <thead><tr><th scope="col">Компонент</th><th scope="col">Педагогическая задача</th><th scope="col">Ожидаемый эффект</th></tr></thead>
        <tbody>
          <tr><th scope="row">Модуль визуализации</th><td>Перевод абстрактного объекта в наглядную форму</td><td>Развитие функционального мышления</td></tr>
          <tr><th scope="row">Символьный решатель</th><td>Демонстрация логики преобразований</td><td>Понимание структуры алгоритма</td></tr>
          <tr><th scope="row">Адаптивные задания</th><td>Индивидуализация темпа и сложности</td><td>Рост учебной мотивации</td></tr>
          <tr><th scope="row">Журнал действий</th><td>Выявление типичных затруднений</td><td>Адресная корректировка работы</td></tr>
        </tbody>
      </table>
    </figure>
    <div class="note">Стиль интерфейса намеренно сдержан: игровые элементы не отвлекают от математического содержания. Мотивация реализована через развитие сюжета задания и сравнение гипотезы с результатом моделирования.</div>
  </div>
</section>

<section class="cta">
  <div class="container"><h2>Хотите узнать больше?</h2><a class="btn btn-light" href="technology.html">Архитектура платформы</a></div>
</section>
"""

write_page("platform.html", "Платформа — MathVizor",
           "Возможности и интерфейс платформы MathVizor: четыре модуля, рабочий лист и таблица соответствия компонентов педагогическим задачам.",
           "platform.html", platform_main)


tasks_main = """
""" + crumbs(("index.html", "Главная"), ("platform.html", "Платформа"), ("Задания",)) + """

<section class="page-head">
  <div class="container">
    <h1>Задания и обратная связь</h1>
    <p class="lead">Четыре типа заданий и три уровня обратной связи: система помогает найти ошибку, но не подменяет рассуждение готовым ответом.</p>
  </div>
</section>

<section class="section" id="types">
  <div class="container">
    <h2>Типы заданий</h2>
    <ul class="card-grid">
      <li class="card"><h3>1. Распознавание структуры</h3><p>Сопоставить график, формулу и словесное описание зависимости. Проверка — выбором соответствия и кратким пояснением.</p></li>
      <li class="card"><h3>2. Построение модели</h3><p>Изменить параметры и исследовать их влияние на поведение функции.</p></li>
      <li class="card"><h3>3. Объяснение</h3><p>Выбрать корректное обоснование перехода от одного выражения к другому.</p></li>
      <li class="card"><h3>4. Исследовательские</h3><p>Сформулировать гипотезу, проверить её в среде и аргументировать вывод.</p></li>
    </ul>
  </div>
</section>

<section class="section section-alt" id="feedback">
  <div class="container">
    <h2>Три уровня обратной связи</h2>
    <figure>
      <img src="assets/img/feedback-levels.svg" alt="Схема из трёх уровней: сигнальный, объясняющий, рефлексивный">
      <figcaption>Рисунок 2 — уровни обратной связи в MathVizor</figcaption>
    </figure>
    <div class="two-columns">
      <article class="card"><h3>Сигнальный</h3><p>Указание на шаг, где возникло расхождение.</p></article>
      <article class="card"><h3>Объясняющий</h3><p>Подсказка о применяемом свойстве или теореме.</p></article>
      <article class="card"><h3>Рефлексивный</h3><p>Предложение сравнить результат с исходной гипотезой.</p></article>
    </div>
    <p class="mt">Каждое обращение к подсказке фиксируется в журнале и учитывается преподавателем при формировании индивидуальной траектории.</p>
  </div>
</section>

<section class="section" id="example">
  <div class="container">
    <h2>Пример задания</h2>
    <p>Функция <strong>f(x) = x³ + ax</strong>. При <em>a</em> &lt; 0 производная имеет два нуля и функция имеет два экстремума; при <em>a</em> ≥ 0 экстремумов нет. Это правило используется в заданиях на формулировку и проверку гипотезы.</p>
    <p><a class="text-link" href="methodology.html">Посмотреть фрагмент урока →</a></p>
  </div>
</section>

<section class="section section-alt" id="recognizer">
  <div class="container">
    <h2>Введите своё задание</h2>
    <p>Запишите формулу функции — сервис определит тип задания, вычислит производную и построит методику именно для вашего примера.</p>
    <form id="task-form" class="task-form" novalidate autocomplete="off">
      <div class="form-field form-field-wide">
        <label for="task-formula">Формула функции</label>
        <input type="text" id="task-formula" name="formula" placeholder="Например: f(x) = x^3 + a*x или f(x,y) = x^2 + y^2" autocomplete="off">
        <p class="field-hint">Переменные задаются буквами в скобках: <code>f(x)</code>, <code>f(t)</code>, <code>f(x,y)</code>. Остальные буквы считаются параметрами. Доступны + − * / ^, скобки, sin, cos, tan, sqrt, exp, ln, lg, abs, arcsin, arccos, arctan.</p>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">Распознать и построить методику</button>
        <button class="btn btn-light" type="reset">Очистить</button>
      </div>
    </form>
    <p class="small mt">Все вычисления выполняются локально, в браузере. График можно перемещать перетаскиванием и масштабировать колесом мыши; координаты показываются только при наведении на линию графика.</p>
    <div id="task-result" class="task-result" hidden aria-live="polite"></div>
  </div>
</section>

<section class="cta">
  <div class="container"><h2>Как это применяется на уроке</h2><a class="btn btn-light" href="methodology.html">Перейти к методике</a></div>
</section>
"""

write_page("tasks.html", "Задания и обратная связь — MathVizor",
           "Четыре типа заданий, три уровня обратной связи и форма ввода формулы функции: распознавание типа, производная, интерактивный график и методика под конкретный пример.",
           "tasks.html", tasks_main)


pedagogy_main = """
""" + crumbs(("index.html", "Главная"), ("Педагогика",)) + """

<section class="page-head">
  <div class="container">
    <h1>Педагогический дизайн</h1>
    <p class="lead">Концепция «видимого мышления»: каждый этап решения представлен в наглядной и обсуждаемой форме.</p>
  </div>
</section>

<section class="section" id="concept">
  <div class="container">
    <h2>Концепция</h2>
    <p>В отличие от электронного учебника, платформа предлагает не линейное изложение, а пространство математического эксперимента. Подход опирается на принципы наглядности, доступности, индивидуализации и обратной связи, а также на таксономию учебных целей.</p>
    <figure>
      <img src="assets/img/pedagogy-illustration.svg" alt="Иллюстрация цикла: гипотеза, эксперимент, объяснение, рефлексия">
      <figcaption>Рисунок 1 — этапы «видимого мышления» в платформе</figcaption>
    </figure>
    <ul class="card-grid four">
      <li class="card"><h3>Наглядность</h3><p>Абстрактный объект переводится в наблюдаемую форму.</p></li>
      <li class="card"><h3>Доступность</h3><p>Интерфейс и материалы доступны разным категориям пользователей.</p></li>
      <li class="card"><h3>Индивидуализация</h3><p>Темп и сложность заданий учитывают тип ошибки.</p></li>
      <li class="card"><h3>Обратная связь</h3><p>Объяснение хода решения, а не только вердикт.</p></li>
    </ul>
  </div>
</section>

<section class="section section-alt" id="taxonomy">
  <div class="container">
    <h2>Таксономия учебных целей</h2>
    <ol class="steps steps-inline">
      <li>Знать</li><li>Понимать</li><li>Применять</li><li>Анализировать</li><li>Создавать</li>
    </ol>
    <p>Задания платформы сопоставляются с уровнями таксономии: от распознавания структуры объекта до формулировки и аргументации собственной гипотезы.</p>
  </div>
</section>

<section class="section" id="before-after">
  <div class="container">
    <h2>От учебника к среде эксперимента</h2>
    <figure class="table-block">
      <table class="data-table">
        <caption>Сравнение подходов</caption>
        <thead><tr><th scope="col">Электронный учебник</th><th scope="col">MathVizor</th></tr></thead>
        <tbody>
          <tr><td>Готовый результат, поиск скрыт</td><td>Пошаговый поиск и обсуждаемые этапы</td></tr>
          <tr><td>Линейное изложение</td><td>Пространство математического эксперимента</td></tr>
          <tr><td>Проверка верности ответа</td><td>Выявление характера ошибки и типа затруднения</td></tr>
          <tr><td>Одинаковый темп для всех</td><td>Индивидуальная траектория по журналу действий</td></tr>
        </tbody>
      </table>
    </figure>
  </div>
</section>

<section class="section section-alt" id="analogues">
  <div class="container">
    <h2>Анализ цифровых ресурсов</h2>
    <figure class="table-block">
      <table class="data-table">
        <caption>Группы аналогов и их ограничения</caption>
        <thead><tr><th scope="col">Группа</th><th scope="col">Примеры</th><th scope="col">Ограничение</th></tr></thead>
        <tbody>
          <tr><td>Динамические среды</td><td>GeoGebra, Cabri</td><td>Нет методически выстроенной последовательности и отчётности для преподавателя</td></tr>
          <tr><td>Графовые калькуляторы</td><td>Desmos</td><td>Ограниченная символьная объясняющая часть</td></tr>
          <tr><td>Системы компьютерной алгебры</td><td>Wolfram Mathematica, SymPy</td><td>Интерфейс ориентирован на владеющего математическим аппаратом</td></tr>
          <tr><td>Платформы онлайн-курсов</td><td>Stepik, Coursera, Khan Academy</td><td>Ход рассуждений остаётся невидимым; англоязычный контент</td></tr>
        </tbody>
      </table>
    </figure>
    <p class="mt">Востребована отечественная разработка, объединяющая наглядность визуализации, объясняющую силу вычислений, адаптивность и прозрачную аналитику.</p>
  </div>
</section>

<section class="cta">
  <div class="container"><h2>Как это реализовано в методике</h2><a class="btn btn-light" href="methodology.html">Перейти к методике</a></div>
</section>
"""

write_page("pedagogy.html", "Педагогический дизайн — MathVizor",
           "Концепция видимого мышления, принципы, таксономия учебных целей и анализ цифровых аналогов платформы MathVizor.",
           "pedagogy.html", pedagogy_main)


methodology_main = """
""" + crumbs(("index.html", "Главная"), ("pedagogy.html", "Педагогика"), ("Методика",)) + """

<section class="page-head">
  <div class="container">
    <h1>Методика использования</h1>
    <p class="lead">Четыре этапа исследовательского цикла, поддерживаемые встроенной аналитикой платформы.</p>
  </div>
</section>

<section class="section" id="cycle-steps">
  <div class="container">
    <h2>Исследовательский цикл</h2>
    <figure class="cycle-figure">
      <img src="assets/img/methodology-cycle.svg" alt="Схема исследовательского цикла из четырёх этапов">
      <figcaption>Рисунок 1 — четыре этапа исследовательского цикла</figcaption>
    </figure>
    <ol class="timeline">
      <li><h3>1. Проблемная ситуация</h3><p>Преподаватель формулирует вопрос, например: «Как изменение коэффициента при x влияет на число экстремумов функции?» Обучающиеся фиксируют гипотезы до начала экспериментов.</p></li>
      <li><h3>2. Эксперимент</h3><p>Строится семейство графиков, варьируются параметры, отыскиваются критические значения.</p></li>
      <li><h3>3. Аналитическое подтверждение</h3><p>Наглядное наблюдение связывается с символьными вычислениями.</p></li>
      <li><h3>4. Рефлексия</h3><p>Сопоставление гипотезы с выводом; при изучении производной — переход от стремления секущей к касательной к пределу отношения приращений.</p></li>
    </ol>
  </div>
</section>

<section class="section section-alt" id="lesson">
  <div class="container">
    <h2>Фрагмент урока: «Производная и исследование функции»</h2>
    <details class="accordion" open>
      <summary>Шаг 1. Предсказание</summary>
      <p>Учитель задаёт функцию <strong>f(x) = x³ − 3x</strong> и просит предсказать число экстремумов, не выполняя вычислений.</p>
    </details>
    <details class="accordion">
      <summary>Шаг 2. Визуальный эксперимент</summary>
      <p>Обучающиеся строят график в среде, варьируют коэффициенты и сравнивают исходное предсказание с наблюдаемым результатом.</p>
    </details>
    <details class="accordion">
      <summary>Шаг 3. Символьное дифференцирование</summary>
      <p>Переход к f′(x) = 3x² − 3, поиск критических точек x = ±1 и объяснение смены знака производной.</p>
    </details>
    <details class="accordion">
      <summary>Шаг 4. Рефлексия</summary>
      <p>Обучающиеся указывают, какая информация о функции была получена визуально, а какая — аналитически.</p>
    </details>
  </div>
</section>

<section class="section" id="support">
  <div class="container">
    <h2>Ошибка и аналитика</h2>
    <div class="two-columns">
      <article class="card"><h3>Работа с ошибкой</h3><p>Ошибка не прерывает работу: система показывает, на каком преобразовании возникло расхождение.</p></article>
      <article class="card"><h3>Режим преподавателя</h3><p>Агрегированная аналитика: доля неверных гипотез, распределение времени, список типичных ошибок.</p></article>
    </div>
    <p class="mt">Методика апробирована в очном и дистанционном вариантах с сохранением логики исследовательского цикла.</p>
  </div>
</section>

<section class="section section-alt" id="type-methods">
  <div class="container">
    <h2>Методики по типам заданий</h2>
    <p>Каждый тип задания имеет свою последовательность работы. Сохранён общий исследовательский цикл: проблема — эксперимент — подтверждение — рефлексия.</p>
    <ul class="card-grid four">
      <li class="card"><h3>1. Распознавание структуры</h3><p>Сопоставление графика, формулы и описания.</p><a class="text-link" href="#task-structure">Методика →</a></li>
      <li class="card"><h3>2. Построение модели</h3><p>Варьирование параметров и описание их влияния.</p><a class="text-link" href="#task-model">Методика →</a></li>
      <li class="card"><h3>3. Объяснение</h3><p>Обоснование переходов и смены знака.</p><a class="text-link" href="#task-explanation">Методика →</a></li>
      <li class="card"><h3>4. Исследовательские</h3><p>Гипотеза, проверка и аргументация вывода.</p><a class="text-link" href="#task-research">Методика →</a></li>
    </ul>
    <p class="mt"><a class="text-link" href="tasks.html#recognizer">Ввести своё задание →</a></p>
  </div>
</section>

<section class="section" id="task-structure">
  <div class="container">
    <h2>Методика: распознавание структуры</h2>
    <p class="small">Для заданий, в которых нужно сопоставить график, формулу и словесное описание зависимости.</p>
    <ol class="timeline">
      <li><h3>1. Проблемная ситуация</h3><p>Учитель даёт три представления одного объекта и спрашивает: «По какому признаку можно узнать, что они описывают одну и ту же функцию?»</p></li>
      <li><h3>2. Выделение признаков</h3><p>Обучающиеся называют области определения, нули, знак, монотонность, экстремумы и поведение на бесконечности; каждый признак связывается с видом графика.</p></li>
      <li><h3>3. Сопоставление и проверка</h3><p>Пары «график — формула — описание» проверяются подстановкой характерных точек и сравнением свойств, а не внешним сходством рисунка.</p></li>
      <li><h3>4. Рефлексия</h3><p>Формулируется правило: какие признаки оказались решающими и почему остальные могли быть неоднозначными.</p></li>
    </ol>
    <div class="note"><strong>Обратная связь:</strong> сигнальный уровень называет пару с расхождением; объясняющий напоминает признак (например, знак производной); рефлексивный предлагает проверить выбор подстановкой.</div>
    <p class="mt"><a class="text-link" href="tasks.html#recognizer">Вернуться к вводу задания →</a></p>
  </div>
</section>

<section class="section section-alt" id="task-model">
  <div class="container">
    <h2>Методика: построение модели</h2>
    <p class="small">Для заданий, в которых нужно изменить параметры и исследовать их влияние на поведение функции.</p>
    <ol class="timeline">
      <li><h3>1. Проблемная ситуация</h3><p>Фиксируется вопрос: «Как изменение коэффициента при x влияет на число экстремумов?» Обучающиеся записывают предварительное предположение.</p></li>
      <li><h3>2. Эксперимент с параметром</h3><p>Строится семейство графиков f(x) = x³ + ax при разных a; отмечается критическое значение параметра, при котором меняется число экстремумов.</p></li>
      <li><h3>3. Аналитическое подтверждение</h3><p>Вычисляется производная f′(x) = 3x² + a; условие существования двух нулей a &lt; 0 объясняет наблюдение.</p></li>
      <li><h3>4. Рефлексия</h3><p>Модель сравнивается с гипотезой: где визуальный вывод совпал с вычислением, а где потребовалась уточнённая формулировка.</p></li>
    </ol>
    <div class="note"><strong>Обратная связь:</strong> сигнальный уровень указывает на шаг, где параметр изменён неверно; объясняющий подсказывает связь числа корней производной и экстремумов; рефлексивный предлагает проверить граничный случай a = 0.</div>
    <p class="mt"><a class="text-link" href="tasks.html#recognizer">Вернуться к вводу задания →</a></p>
  </div>
</section>

<section class="section" id="task-explanation">
  <div class="container">
    <h2>Методика: объяснение</h2>
    <p class="small">Для заданий, в которых нужно выбрать или сформулировать корректное обоснование перехода от одного выражения к другому.</p>
    <ol class="timeline">
      <li><h3>1. Проблемная ситуация</h3><p>Показываются два выражения или участки графика и вопрос: «Какое свойство позволяет перейти от первого ко второму?»</p></li>
      <li><h3>2. Поиск обоснования</h3><p>Обучающиеся перебирают возможные свойства: монотонность, знак производной, теорема о крайних значениях — и отбрасывают неподходящие.</p></li>
      <li><h3>3. Символьная проверка</h3><p>Выбранное свойство подтверждается вычислением: например, смена знака f′ в точке x = −1 для f(x) = x³ − 3x.</p></li>
      <li><h3>4. Рефлексия</h3><p>Обучающийся формулирует вывод своими словами и указывает, какая информация была получена из графика, а какая — из формулы.</p></li>
    </ol>
    <div class="note"><strong>Обратная связь:</strong> сигнальный уровень помечает шаг с необоснованным переходом; объясняющий называет свойство или теорему; рефлексивный просит привести контрапример, если обоснование неверно.</div>
    <p class="mt"><a class="text-link" href="tasks.html#recognizer">Вернуться к вводу задания →</a></p>
  </div>
</section>

<section class="section section-alt" id="task-research">
  <div class="container">
    <h2>Методика: исследовательские задания</h2>
    <p class="small">Для заданий, в которых нужно сформулировать гипотезу, проверить её в среде и аргументировать вывод.</p>
    <ol class="timeline">
      <li><h3>1. Гипотеза до эксперимента</h3><p>Преподаватель задаёт проблемный вопрос; обучающиеся фиксируют предположение до построения графиков, чтобы сделать мышление видимым.</p></li>
      <li><h3>2. Проверка в среде</h3><p>Строится семейство графиков, варьируются параметры, отыскиваются критические значения; каждый результат сравнивается с исходным предсказанием.</p></li>
      <li><h3>3. Аналитическое обоснование</h3><p>Наблюдение подтверждается символьными вычислениями (производная, нули, знак), после чего формулируется вывод.</p></li>
      <li><h3>4. Рефлексия и аргументация</h3><p>Обучающиеся объясняют, какие данные получены визуально, какие аналитически, и насколько вывод совпал с гипотезой.</p></li>
    </ol>
    <div class="note"><strong>Обратная связь:</strong> сигнальный уровень показывает расхождение с гипотезой; объясняющий предлагает изменить параметр или перейти к производной; рефлексивный просит сформулировать, что именно подтвердило или опровергло предположение.</div>
    <p class="mt"><a class="text-link" href="tasks.html#recognizer">Вернуться к вводу задания →</a></p>
  </div>
</section>

<section class="cta">
  <div class="container"><h2>Увидеть результаты апробации</h2><a class="btn btn-light" href="results.html">Перейти к результатам</a></div>
</section>
"""

write_page("methodology.html", "Методика использования — MathVizor",
           "Методика использования MathVizor: исследовательский цикл, фрагмент урока и готовые методики для четырёх типов заданий: распознавание структуры, построение модели, объяснение и исследовательские задачи.",
           "methodology.html", methodology_main)


results_main = """
""" + crumbs(("index.html", "Главная"), ("pedagogy.html", "Педагогика"), ("Результаты",)) + """

<section class="page-head">
  <div class="container">
    <h1>Результаты опытной работы</h1>
    <p class="lead">Апробация платформы в течение семестра: 44 обучающихся в экспериментальной группе и 42 в контрольной.</p>
  </div>
</section>

<section class="section" id="design">
  <div class="container">
    <h2>Дизайн диагностики</h2>
    <p>Диагностика включала задания на смысл производной, интерпретацию графиков и прикладные задачи на моделирование. Уровень компетенций оценивался по критериям работы. Эмпирическую базу составили 86 обучающихся 9–11 классов и 1–2 курсов.</p>
    <ul class="stats-grid compact">
      <li><strong>44</strong><span>экспериментальная группа</span></li>
      <li><strong>42</strong><span>контрольная группа</span></li>
      <li><strong>1 семестр</strong><span>длительность апробации</span></li>
      <li><strong>p &lt; 0,05</strong><span>уровень значимости</span></li>
    </ul>
  </div>
</section>

<section class="section section-alt" id="dynamics">
  <div class="container">
    <h2>Динамика верных заданий</h2>
    <figure>
      <img src="assets/img/results-chart.svg" alt="Доля верных заданий: в экспериментальной группе с 54 до 78 процентов, в контрольной — с 53 до 64 процентов">
      <figcaption>Доля верно выполненных заданий до и после внедрения платформы</figcaption>
    </figure>
    <p>В экспериментальной группе показатель вырос с 54 % до 78 % (+24 п.п.), в контрольной — с 53 % до 64 % (+11 п.п.). Наиболее заметный прирост отмечен в заданиях на формулировку гипотезы.</p>
  </div>
</section>

<section class="section" id="table">
  <div class="container">
    <h2>Показатели диагностики</h2>
    <figure class="table-block">
      <table class="data-table">
        <caption>Таблица 2. Динамика показателей диагностики</caption>
        <thead><tr><th scope="col">Показатель</th><th scope="col">Контрольная группа</th><th scope="col">Экспериментальная группа</th></tr></thead>
        <tbody>
          <tr><th scope="row">Верные задания до внедрения</th><td>53 %</td><td>54 %</td></tr>
          <tr><th scope="row">Верные задания после внедрения</th><td>64 %</td><td>78 %</td></tr>
          <tr><th scope="row">Обоснованные гипотезы<sup>1</sup></th><td>41 %</td><td>72 %</td></tr>
          <tr><th scope="row">Индекс удовлетворённости, баллы (шкала 1–5)</th><td>3,6</td><td>4,5</td></tr>
        </tbody>
      </table>
      <figcaption><sup>1</sup> Межгрупповое сравнение после внедрения; данные для оценки динамики этого показателя в источнике не приведены.</figcaption>
    </figure>
  </div>
</section>

<section class="section section-alt" id="survey">
  <div class="container">
    <h2>Опрос и статистика</h2>
    <p><strong>87 %</strong> респондентов экспериментальной группы отметили помощь визуализации в понимании материала, <strong>79 %</strong> — пользу пошаговой обратной связи. Преподаватели отметили сокращение времени на рутинную проверку.</p>
    <p>Статистическая обработка включала средние значения, стандартные отклонения, t-критерий Стьюдента для независимых выборок и непараметрический U-критерий Манна — Уитни; выводы совпали. Рост результатов обусловлен главным образом заданиями на интерпретацию графиков и обоснование гипотез, тогда как вычислительные навыки изменились в обеих группах примерно одинаково.</p>
    <div class="note"><strong>Ограничения:</strong> выборка не репрезентативна, длительность апробации составила один семестр.</div>
  </div>
</section>

<section class="cta">
  <div class="container"><h2>Статья и публикации</h2><a class="btn btn-light" href="publications.html">Перейти к публикациям</a></div>
</section>
"""

write_page("results.html", "Результаты апробации — MathVizor",
           "Результаты опытной работы платформы MathVizor: 86 обучающихся, рост верных заданий с 54 до 78 процентов, таблица показателей.",
           "results.html", results_main)


about_main = """
""" + crumbs(("index.html", "Главная"), ("О проекте",)) + """

<section class="page-head">
  <div class="container">
    <h1>О проекте</h1>
    <p class="lead">MathVizor — онлайн-разработка, ориентированная на развитие математического моделирования и исследовательских компетенций.</p>
  </div>
</section>

<section class="section" id="authors">
  <div class="container">
    <h2>Авторы</h2>
    <p>Федеральное государственное бюджетное образовательное учреждение высшего образования «Мордовский государственный педагогический университет имени М. Е. Евсевьева», физико-математический факультет. Россия, г. Саранск.</p>
    <div class="two-columns">
      <figure>
        <img src="assets/img/education-abstract.svg" alt="Иллюстрация образовательной среды: книга, график функции и карточки этапов обучения">
        <figcaption>Рисунок 1 — образовательная среда проекта</figcaption>
      </figure>
      <div>
        <article class="card"><h3>Асманкин И. М.</h3><p>Автор разработки</p></article>
        <article class="card"><h3>Игушкина К. Н.</h3><p>Научный руководитель, преподаватель кафедры физики, информационных технологий и методик обучения</p></article>
      </div>
    </div>
  </div>
</section>

<section class="section section-alt" id="novelty">
  <div class="container">
    <h2>Новизна исследования</h2>
    <ol class="timeline">
      <li><h3>Модель интеграции</h3><p>Динамическая визуализация и символьные вычисления с объясняющей обратной связью в единой веб-среде.</p></li>
      <li><h3>Механизм выявления затруднений</h3><p>Анализ пути решения: последовательность преобразований, число подсказок, время работы.</p></li>
      <li><h3>Методика исследовательского цикла</h3><p>Поддерживается встроенной аналитикой и работает в очном и дистанционном форматах.</p></li>
    </ol>
  </div>
</section>

<section class="section" id="application">
  <div class="container">
    <h2>Область применения</h2>
    <p>Результаты применимы в школах, колледжах и вузах при изучении математического анализа, алгебры и геометрии, а также в дополнительном образовании. Платформа может использоваться на уроке, для домашней работы и как компонент электронной образовательной среды вуза.</p>
    <p><strong>Практическая значимость:</strong> использование платформы преподавателями без дополнительных технических знаний.</p>
    <p><strong>Перспективы:</strong> расширение функционала за счёт генеративных заданий и инструментов коллективного решения задач.</p>
  </div>
</section>

<section class="section section-alt" id="contacts">
  <div class="container">
    <h2>Контакты</h2>
    <p><strong>ФГБОУ ВО «Мордовский государственный педагогический университет имени М. Е. Евсевьева»</strong>, физико-математический факультет, г. Саранск.</p>
    <p>По вопросам разработки и апробации: <a href="mailto:mathvizor@mppu.ru">mathvizor@mppu.ru</a></p>
    <p><a href="https://www.mppu.ru/" target="_blank" rel="noopener">Сайт Мордовского государственного педагогического университета им. М. Е. Евсевьева</a></p>
    <p>Рабочая версия сайта проекта: <a href="https://asmankinigor.github.io/mysite/" target="_blank" rel="noopener">asmankinigor.github.io/mysite/</a></p>
  </div>
</section>

<section class="cta">
  <div class="container"><h2>Ознакомиться с публикациями</h2><a class="btn btn-light" href="publications.html">Перейти к публикациям</a></div>
</section>
"""

write_page("about.html", "О проекте — MathVizor",
           "Авторы, новизна и область применения платформы MathVizor; Мордовский государственный педагогический университет, Саранск.",
           "about.html", about_main)


publications_main = """
""" + crumbs(("index.html", "Главная"), ("Публикации",)) + """

<section class="page-head">
  <div class="container">
    <h1>Публикации</h1>
    <p class="lead">Аннотации статьи-заявки на русском и английском языках, текст работы и список литературы.</p>
  </div>
</section>

<section class="section" id="ru">
  <div class="container">
    <h2>Аннотация</h2>
    <p>В статье представлена интерактивная образовательная платформа «MathVizor» для обучения математике в школе и вузе. Платформа объединяет динамическую визуализацию функций, символьные вычисления с пошаговой обратной связью, адаптивные задания и аналитику обучения. Опытная работа с 86 обучающимися показала статистически значимый рост уровня математического моделирования и исследовательских компетенций.</p>
    <p><strong>Ключевые слова:</strong> интерактивная платформа, математическое моделирование, визуализация функций, адаптивное обучение, исследовательские компетенции, аналитика обучения.</p>
    <p><a class="btn btn-primary" href="assets/docs/article-ru.pdf" download>Скачать статью (PDF)</a></p>
  </div>
</section>

<section class="section section-alt" id="en">
  <div class="container">
    <h2>Abstract</h2>
    <p>The paper presents MathVizor, an interactive web platform for teaching mathematics at secondary and university levels. The platform integrates dynamic visualisation of functions, symbolic computation with step-by-step feedback, adaptive tasks and learning analytics. A pilot study involving 86 students demonstrated a statistically significant growth in mathematical modelling and research competences.</p>
    <p><strong>Keywords:</strong> interactive platform, mathematical modelling, function visualisation, adaptive learning, research competences, learning analytics.</p>
  </div>
</section>

<section class="section" id="references">
  <div class="container">
    <h2>Список литературы</h2>
    <ol class="pub-list">
      <li>Федеральный государственный образовательный стандарт основного общего образования / утв. приказом Минпросвещения России от 31.05.2021 № 287. — М., 2021.</li>
      <li>Шакирова Л. Р. (сост.) Лобачевский и университет. — Изд-е 2-е, переработанное. — Казань: Казан. ун-т, 2018. — 216 с.</li>
      <li>Пахомов С. В. Цифровые технологии в образовании: учеб. пособие. — М.: Юрайт, 2020. — 287 с.</li>
      <li>National Council of Teachers of Mathematics. Principles to Actions: Ensuring Mathematical Success for All. — Reston: NCTM, 2014. — 160 p.</li>
      <li>OECD. PISA 2022 Mathematics Framework. — Paris: OECD Publishing, 2023. — 76 p.</li>
      <li><a href="https://www.geogebra.org" target="_blank" rel="noopener">GeoGebra</a> (дата обращения: 12.11.2026).</li>
      <li><a href="https://www.desmos.com/calculator" target="_blank" rel="noopener">Desmos Graphing Calculator</a> (дата обращения: 12.11.2026).</li>
      <li><a href="https://www.wolframalpha.com" target="_blank" rel="noopener">Wolfram|Alpha</a> (дата обращения: 12.11.2026).</li>
      <li>Блум Б. С. Таксономия целей обучения: когнитивная область. — М.: Просвещение, 1982. — 124 с.</li>
      <li>Хатти Дж. Видимое обучение. — М.: Альпина Паблишер, 2018. — 440 с.</li>
      <li><a href="https://www.w3.org/TR/WCAG21/" target="_blank" rel="noopener">Web Content Accessibility Guidelines (WCAG) 2.1</a> / W3C Recommendation, 05 June 2018.</li>
      <li>Смирнов С. Д. Педагогика и психология высшего образования: от деятельности к личности. — М.: Академия, 2011. — 304 с.</li>
    </ol>
  </div>
</section>

<section class="cta">
  <div class="container"><h2>Вернуться к проекту</h2><a class="btn btn-light" href="index.html">На главную</a></div>
</section>
"""

write_page("publications.html", "Публикации — MathVizor",
           "Аннотации на русском и английском языках, статья-заявка и список литературы проекта MathVizor.",
           "publications.html", publications_main)


notfound_main = """
<section class="page-head">
  <div class="container"><h1>Страница не найдена</h1><p class="lead">Такой страницы нет. Вернитесь на главную или воспользуйтесь меню.</p></div>
</section>
<section class="section"><div class="container"><p><a class="btn btn-primary" href="index.html">На главную</a></p></div></section>
"""
write_page("404.html", "Страница не найдена — MathVizor",
           "Страница не найдена — MathVizor", "index.html", notfound_main)

# --------------------------------------------------------------------------
# 4. Копируем материалы из документа
# --------------------------------------------------------------------------
docs = ROOT / "assets" / "docs"
docs.mkdir(parents=True, exist_ok=True)
shots = ROOT / "assets" / "img" / "screenshots"
shots.mkdir(parents=True, exist_ok=True)

pdf_sources = [
    ROOT.parent / "Статья_Лучшая_онлайн-разработка.pdf",
    Path("C:/Users/HOME/Desktop/Статья_Лучшая_онлайн-разработка.pdf"),
]
for src in pdf_sources:
    if src.exists():
        shutil.copy2(src, docs / "article-ru.pdf")
        print("PDF скопирован:", src)
        break

img_src = Path("C:/Users/HOME/AppData/Local/Temp/opencode/doc_image1.jpeg")
if img_src.exists():
    shutil.copy2(img_src, shots / "01-workspace.jpg")
    print("Скриншот скопирован")

print("Готово: собрано", len(list(ROOT.glob('*.html'))), "HTML-файлов")
