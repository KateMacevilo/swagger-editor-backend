# OpenAPI Visual Editor

Веб-приложение для визуального создания, редактирования и просмотра спецификаций **OpenAPI 3.0.0 (Swagger)**.

- **Левая панель** — список эндпоинтов и форма-конструктор
- **Правая панель** — живой Swagger UI или JSON-код спецификации, обновляется после каждого сохранения
- Экспорт готовой спецификации в **JSON** или **YAML**
- Импорт существующего OpenAPI-файла для редактирования

---

## Требования

| Инструмент  | Версия       |
|-------------|--------------|
| Java        | 17 или новее |
| Maven       | 3.8+         |
| Node.js     | 18 или новее |
| npm         | 9+           |

---

## Быстрый старт (dev-режим)

### 1. Запуск бэкенда

```bash
# Из корня проекта (где лежит pom.xml)
mvn spring-boot:run
```

Бэкенд стартует на **http://localhost:8080**.

Первый запуск скачает зависимости Maven (~2–3 минуты).

### 2. Запуск фронтенда

В **отдельном** терминале:

```bash
cd frontend
npm install      # только при первом запуске
npm run dev
```

Фронтенд стартует на **http://localhost:5173** — откройте эту страницу в браузере.

---

## Работа с приложением

### Главная страница — список проектов

- Нажмите **«+ Новый проект»** — введите название, версию, URL сервера.
- Нажмите **«Импортировать JSON/YAML»** — загрузите готовый файл OpenAPI 3.0, он автоматически разберётся и откроется в редакторе.
- Клик по карточке проекта открывает редактор.
- Крестик в правом верхнем углу карточки — удаление проекта.

### Редактор — трёхпанельный интерфейс

```
[ Список эндпоинтов ] [ Форма редактирования ] [ Swagger UI preview ]
```

**Левая колонка:**
- Список всех эндпоинтов проекта с цветными метками метода (GET/POST/PUT/...).
- Кнопка **«+ Новый эндпоинт»**.
- Кнопки **«JSON»** и **«YAML»** для скачивания готовой спецификации.
- Кнопка ✏️ — редактирование мета-информации проекта (title, version, server URL и т.д.).

**Центральная колонка — форма эндпоинта:**

1. Выберите **HTTP-метод** и введите **путь** (`/api/users/{id}`)
2. Заполните `Summary`, `Tags`, `Description`, `Operation ID`
3. Вкладка **Параметры** — добавляйте Query / Path / Header / Cookie параметры:
   - Имя, расположение (`in`), тип, формат, флаг `required`, описание, пример
4. Вкладка **Request Body** — доступна для POST/PUT/PATCH:
   - Визуальный конструктор полей с типами и вложенностью
   - Переключатель на Raw JSON для прямого ввода JSON Schema
5. Вкладка **Ответы** — добавляйте HTTP-статусы (200, 201, 400 и др.):
   - Каждому статусу — описание и схема тела ответа
6. Нажмите **«Сохранить»** — правая панель обновит предпросмотр.

**Правая колонка — предпросмотр:**
- Вкладка **Swagger UI** — интерактивный Swagger UI с развёрнутыми эндпоинтами
- Вкладка **JSON** — сырой JSON сгенерированной спецификации

---

## Экспорт спецификации

В левой панели редактора:

```
[ JSON ]   →  скачивает openapi.json
[ YAML ]   →  скачивает openapi.yaml
```

Файлы готовы к использованию в любом инструменте, поддерживающем OpenAPI 3.0 (Postman, Insomnia, AWS API Gateway, и т.д.).

---

## Импорт существующей спецификации

На главной странице нажмите **«Импортировать JSON/YAML»** и выберите файл.

Парсер принимает любую валидную спецификацию OpenAPI 3.0 — создаёт проект и заполняет все эндпоинты, параметры и схемы.

---

## H2 база данных (отладка)

Данные хранятся **в памяти** и сбрасываются при перезапуске бэкенда.

Веб-интерфейс H2 консоли: **http://localhost:8080/h2-console**

| Поле      | Значение                |
|-----------|-------------------------|
| JDBC URL  | `jdbc:h2:mem:swaggerdb` |
| User Name | `sa`                    |
| Password  | _(пусто)_               |

Чтобы данные сохранялись между перезапусками, измените `src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:h2:file:./data/swaggerdb
spring.jpa.hibernate.ddl-auto=update
```

---

## Production сборка (один JAR)

```bash
# 1. Собрать фронтенд
cd frontend
npm run build

# 2. Скопировать dist в static-ресурсы Spring Boot
cp -r dist/* ../src/main/resources/static/

# 3. Собрать JAR
cd ..
mvn package -DskipTests

# 4. Запустить
java -jar target/swagger-editor-backend-1.0.0.jar
```

Приложение будет доступно на **http://localhost:8080**.

---

## Технологии

**Backend**
- Java 17, Spring Boot 3.2.3
- Spring Data JPA + H2
- `io.swagger.core.v3:swagger-models` — объектная модель OpenAPI 3.0
- `io.swagger.parser.v3:swagger-parser` — парсинг и импорт спецификаций
- Lombok

**Frontend**
- React 18, React Router 6
- Vite 5
- Tailwind CSS 3
- `swagger-ui-react` — встроенный Swagger UI
- Axios

---

## Структура API (backend)

```
GET    /api/projects                          — список проектов
POST   /api/projects                          — создать проект
GET    /api/projects/{id}                     — получить проект
PUT    /api/projects/{id}                     — обновить проект
DELETE /api/projects/{id}                     — удалить проект

GET    /api/projects/{id}/endpoints           — список эндпоинтов
POST   /api/projects/{id}/endpoints           — создать эндпоинт
GET    /api/projects/{id}/endpoints/{eid}     — получить эндпоинт
PUT    /api/projects/{id}/endpoints/{eid}     — обновить эндпоинт
DELETE /api/projects/{id}/endpoints/{eid}     — удалить эндпоинт

GET    /api/projects/{id}/spec                — спецификация JSON (для превью)
GET    /api/projects/{id}/spec/download/json  — скачать openapi.json
GET    /api/projects/{id}/spec/download/yaml  — скачать openapi.yaml

POST   /api/import/file                       — импорт файла (multipart)
POST   /api/import/text                       — импорт из строки
```
