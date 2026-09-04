# OpenAPI Visual Editor — AGENTS.md

## Обзор проекта

Full-stack веб-приложение для визуального создания, редактирования и предпросмотра спецификаций **OpenAPI 3.0.0 (Swagger)**.

- **Главная страница** — список проектов, создание нового проекта, импорт готового OpenAPI-файла (JSON/YAML).
- **Редактор** — трёхпанельный интерфейс:
  - **Левая панель** — список эндпоинтов проекта, кнопки экспорта JSON/YAML, сохранения на GitLab и редактирования мета-информации проекта.
  - **Центральная панель** — форма-конструктор эндпоинта: метод, путь, параметры, request body, ответы.
  - **Правая панель** — живой Swagger UI и сырой JSON сгенерированной спецификации.

Проекты хранятся не в локальной базе данных, а в заданном GitLab-проекте (репозитории): каждый проект — это папка `{slug}/openapi.json`. Бэкенд читает, создаёт, обновляет и удаляет эти файлы через GitLab REST API (v4). GitHub как хранилище был полностью заменён на GitLab — GitHub-кода в проекте не осталось.

> **Важно:** файл `CLAUDE.md` в корне устарел — он описывает H2/JPA-версию и API с подресурсами `/api/projects/{id}/endpoints`, которых в текущей кодовой базе нет. `README.md` актуален. Доверяйте этому `AGENTS.md` и исходному коду.

---

## Технологический стек

### Backend

- **Java 17** (target для сборки), Spring Boot 3.2.3 (`spring-boot-starter-web`, `spring-boot-starter-validation`).
- **GitLab REST API (v4)** — единственное хранилище проектов.
- **Swagger ecosystem**:
  - `io.swagger.core.v3:swagger-models:2.2.20` — объектная модель OpenAPI 3.0.
  - `io.swagger.core.v3:swagger-core:2.2.20` — сериализация в JSON/YAML.
  - `io.swagger.parser.v3:swagger-parser:2.1.21` — импорт существующих спецификаций.
- **Jackson YAML** (`jackson-dataformat-yaml`).
- **Lombok** (scope `provided`, исключён из fat-jar через `spring-boot-maven-plugin`).
- **Maven** — сборка (`pom.xml` в корне).

### Frontend

- **React 18** + **React Router 6.26**.
- **Vite 5** (dev-сервер на порту 5173, прокси `/api` → `localhost:8080`).
- **Tailwind CSS 3** + **PostCSS/Autoprefixer**.
- **swagger-ui-react 5** — встроенный Swagger UI.
- **Axios** — HTTP-клиент.
- Фронтенд-тесты, линтеры и форматтеры **не настроены**.

---

## Структура проекта

```
swagger-editor-backend/
├── pom.xml                              # Корневой Maven POM (backend)
├── Dockerfile                           # Контейнерный образ для k8s (eclipse-temurin:17-jre)
├── Dockerfile.full                      # Multi-stage: собирает frontend+backend внутри Docker
├── .dockerignore
├── .env.example                         # Шаблон переменных окружения
├── src/main/java/com/swaggereditor/
│   ├── SwaggerEditorApplication.java    # Точка входа Spring Boot
│   ├── config/
│   │   ├── CorsConfig.java              # CORS: разрешены :5173 и :3000 для /api/**
│   │   ├── GitLabConfig.java            # RestTemplate bean + @EnableConfigurationProperties
│   │   ├── GitLabProperties.java        # gitlab.* properties (Java record, defaults: branch=main, url=gitlab.com)
│   │   └── SpaFallbackFilter.java       # Forward не-API путей в index.html (SPA)
│   ├── controller/
│   │   ├── ProjectController.java       # CRUD проектов (/api/projects)
│   │   ├── SpecificationController.java # Генерация OpenAPI JSON/YAML из ProjectDTO (/api/spec)
│   │   ├── ImportController.java        # Импорт файла/текста (/api/import)
│   │   └── GlobalExceptionHandler.java  # Единообразные ошибки (@RestControllerAdvice)
│   ├── dto/                             # Request/response DTO (Lombok @Data, jakarta.validation)
│   │   ├── ProjectDTO.java              #   (title @NotBlank; endpoints, serverUrl, version и т.д.)
│   │   ├── ProjectSummaryDTO.java
│   │   ├── EndpointDTO.java             #   (path, method @NotBlank; tags — List<String>)
│   │   ├── ApiParameterDTO.java
│   │   ├── ApiResponseDTO.java
│   │   └── ErrorResponseDTO.java
│   └── service/
│       ├── ProjectService.java          # Чтение/создание/обновление/удаление проектов в GitLab
│       ├── OpenApiService.java          # Парсинг/сериализация OpenAPI ↔ DTO, toSlug()
│       └── GitLabService.java           # Низкоуровневые операции с файлами GitLab (API v4)
├── src/main/resources/
│   ├── application.properties           # Порт 8080, multipart 10MB, gitlab-конфиг
│   ├── json-test/swagger.json           # Фикстура open-banking-спецификации для регрессионного теста (~1 МБ)
│   ├── scrins/                          # Скриншоты (не код; попадают в JAR, см. «Известные проблемы»)
│   └── static/                          # Сюда копируется frontend/dist при production-сборке
├── src/test/java/com/swaggereditor/
│   ├── SwaggerEditorApplicationTests.java  # Smoke-тест загрузки контекста
│   └── ImportRoundTripTest.java            # Регрессионный round-trip импорта реальной спецификации
├── chart/                               # Helm chart для Kubernetes
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── _helpers.tpl
│       ├── configmap.yaml               # GITLAB_PROJECT / GITLAB_BRANCH / GITLAB_URL и др.
│       ├── secret.yaml                  # GITLAB_TOKEN (required)
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       └── hpa.yaml
└── frontend/
    ├── package.json
    ├── vite.config.js                   # Прокси /api → localhost:8080
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── App.jsx                      # Роутинг и навигация
        ├── main.jsx
        ├── index.css
        ├── services/api.js              # Все axios-запросы
        ├── pages/
        │   ├── HomePage.jsx             # Список проектов + создание/импорт
        │   └── EditorPage.jsx           # Трёхпанельный редактор
        └── components/
            ├── ParameterBuilder.jsx     # Query/Path/Header/Cookie параметры
            ├── ResponseBuilder.jsx      # HTTP-статусы и схемы ответов
            ├── SchemaBuilder.jsx        # Визуальный JSON Schema + Raw JSON
            └── SwaggerPreview.jsx       # swagger-ui-react + вкладка JSON
```

---

## Сборка и запуск

### Dev-режим (два терминала)

```bash
# 1. Backend (из корня проекта)
mvn -f pom.xml spring-boot:run          # стартует на http://localhost:8080

# 2. Frontend (в отдельном терминале)
cd frontend
npm install                             # только при первом запуске
npm run dev                             # стартует на http://localhost:5173
```

### Production-сборка (один JAR)

```bash
cd frontend
npm run build
cp -r dist/* ../src/main/resources/static/
cd ..
mvn -f pom.xml package -DskipTests
java -jar target/swagger-editor-backend-1.0.0.jar
```

Приложение доступно на **http://localhost:8080**. Каталог `src/main/resources/static/` — артефакт сборки; перед упаковкой JAR его нужно обновить командой выше.

### Сборка Docker-образа

```bash
# Нужен готовый JAR (см. production-сборку выше)
docker build -t swagger-editor-backend:1.0.0 .
docker run -d --name swagger-editor -p 8080:8080 \
  -e GITLAB_TOKEN=<PAT> -e GITLAB_PROJECT=<group/project> \
  swagger-editor-backend:1.0.0
```

Базовый образ — `eclipse-temurin:17-jre`, порт 8080. `Dockerfile` копирует готовый JAR и сам ничего не собирает.

### Полная сборка в Docker (без локальных Node/Maven/JDK)

`Dockerfile.full` — multi-stage: frontend собирается в стадии `node`, JAR — в стадии `maven`, в финальный образ копируется только JAR:

```bash
docker build -f Dockerfile.full -t swagger-editor-backend:1.0.0 .
```

### Развёртывание в Kubernetes через Helm

```bash
# 1. Собрать production JAR, собрать и запушить образ в registry (см. выше)
# 2. Подготовить chart/values-local.yaml с секретами и локальными настройками
cat > chart/values-local.yaml <<EOF
gitlab:
  project: <group/project>
  branch: main
  url: https://gitlab.com
gitlabToken: <PAT>
image:
  repository: <registry>/<namespace>/swagger-editor-backend
  tag: "1.0.0"
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: swagger-editor.example.com
      paths:
        - path: /
          pathType: Prefix
EOF

# 3. Установить / обновить
helm install swagger-editor ./chart -f chart/values-local.yaml
helm upgrade swagger-editor ./chart -f chart/values-local.yaml
```

`chart/values-local.yaml` добавлен в `.gitignore` (может содержать секреты). Шаблон `secret.yaml` обязателен: при пустом `gitlabToken` установка завершится ошибкой (`required`).

### Тесты

```bash
mvn -f pom.xml test
```

Состав тестов:

- `SwaggerEditorApplicationTests.contextLoads()` — smoke-тест загрузки контекста Spring.
- `ImportRoundTripTest` — регрессионный round-trip: парсит реальную open-banking-спецификацию из `src/main/resources/json-test/swagger.json` (34 пути, 471 схема в компонентах; после разворачивания методов — 42 эндпоинта) и проверяет: теги с запятыми не разрываются, `$ref`-тела раскрываются с сохранением примеров, все эндпоинты имеют summary, ограничения схем (`minLength`/`maxLength`/`pattern`) и кириллица выживают в регенерированном JSON.

Тесты GitLab-операций не настроены (требуют живого токена) — чтение/запись/удаление файлов нужно один раз проверить руками с реальным PAT. Фронтенд-тестов нет.

---

## API backend

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/projects` | Список проектов из GitLab |
| POST | `/api/projects` | Создать проект в GitLab (201) |
| GET | `/api/projects/{id}` | Получить проект (JSON из GitLab); 404 если нет |
| PUT | `/api/projects/{id}` | Сохранить проект в GitLab |
| DELETE | `/api/projects/{id}` | Удалить `openapi.json` из GitLab (204) |
| POST | `/api/spec/json` | Сгенерировать OpenAPI JSON из `ProjectDTO` |
| POST | `/api/spec/yaml` | Сгенерировать OpenAPI YAML из `ProjectDTO` |
| POST | `/api/import/file` | Импорт файла (multipart/form-data, поле `file`) |
| POST | `/api/import/text` | Импорт строки (text/plain) |

Эндпоинты проекта не выделены в отдельный подресурс: они хранятся как список `endpoints` внутри `ProjectDTO` и перезаписываются целиком при `PUT /api/projects/{id}`.

Коды ошибок (`GlobalExceptionHandler`): `NoSuchElementException` → 404, `IllegalArgumentException` → 400, `IllegalStateException` → 503, `HttpClientErrorException` → статус GitLab, остальное → 500. Тело ошибки — `ErrorResponseDTO` (timestamp, status, error, message).

---

## Архитектурные решения

### GitLab как единственный источник правды

Бэкенд не использует базу данных (JPA/H2 в `pom.xml` отсутствуют). Каждый проект — файл `{slug}/openapi.json` в GitLab-репозитории:

- `ProjectService.findAll()` получает список директорий через `GET /projects/{id}/repository/tree` и для каждой читает `openapi.json`. Загрузка параллельна: пул `min(кол-во записей, 10)` потоков, результат сортируется по названию (без учёта регистра). Проекты, которые не удалось прочитать, молча пропускаются с warn в лог.
- `findById(id)` читает `{id}/openapi.json`; 404 → `NoSuchElementException` → HTTP 404.
- `create(dto)` генерирует slug из названия, сериализует DTO в JSON и создаёт файл; пустая версия заменяется на `1.0.0`.
- `update(id, dto)` сериализует `ProjectDTO` в JSON и обновляет файл целиком.
- `importSpec(content)` парсит стороннюю спецификацию и сразу коммитит результат в новую директорию.

`GitLabService` работает напрямую с REST API v4 (база `{gitlab.url}/api/v4/projects/{project}`, где `{project}` — URL-encoded путь вида `group%2Fproject`):

- **Список директорий** — `GET .../repository/tree?path=...&ref={branch}&per_page=100`. GitLab возвращает типы `tree`/`blob`; сервис нормализует их в `dir`/`file`.
- **Чтение файла** — `GET .../repository/files/{file_path}/raw?ref={branch}`. Читается в `byte[]` с явным декодированием UTF-8: RestTemplate без charset в ответе декодировал бы в ISO-8859-1 и портил кириллицу.
- **Запись** — один коммит `POST .../repository/commits` с `actions: [{action: create|update, file_path, content}]`. В отличие от GitHub, sha не нужен: существование файла проверяется через `GET .../files/{path}?ref=...` (200/404), контент передаётся открытым текстом (без base64).
- **Удаление** — коммит с `action: delete`.
- Аутентификация — заголовок `PRIVATE-TOKEN: {token}`, плюс `User-Agent: swagger-editor-backend`.

Если токен или project не заданы, `validateConfig()` бросает `IllegalStateException("GitLab integration is not configured...")` → HTTP 503. `effectiveProject()` подчищает случайные префиксы `https://.../` и суффикс `.git` у пути проекта. Self-hosted GitLab — через `gitlab.url`.

### Хранение схем

Request body и response body хранятся как **JSON-строки** внутри DTO (`requestBodySchema`, `bodySchema`). `OpenApiService` преобразует их в `io.swagger.v3.oas.models.media.Schema` через Jackson (`mapToSchema` / `schemaToMap`); поддерживаются типы `string`, `integer`, `number`, `boolean`, `array`, `object` и поля `format`, `description`, `example`, `default`, `enum`, `nullable`, `minLength`, `maxLength`, `pattern`, `minItems`, `maxItems`, `additionalProperties`, `oneOf`/`anyOf`/`allOf`, `properties`, `required`. Request body добавляется только для POST/PUT/PATCH и только с media type `application/json`; при парсинге сохраняется первый server из `servers` и только тело под `application/json`.

### Tags эндпоинтов

В `EndpointDTO` tags — это `List<String>`, **не** строка через запятую: тег может сам содержать запятые (например, «Создание, получение и отзыв платежа ...»), и join/split по `,` разрывал бы его на фрагменты. На этом основан регрессионный тест `ImportRoundTripTest`.

### Генерация и парсинг OpenAPI

- Генерация: `OpenApiService.toJson/toYaml` собирают объект `OpenAPI` из `swagger-models` (версия спецификации фиксирована — `3.0.0`) и сериализуют через `io.swagger.v3.core.util.Json` / `Yaml`. Если у эндпоинта нет ответов, добавляется дефолтный `200 OK`. Поддерживаются 7 HTTP-методов: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD (`OpenApiService.setOperation`).
- Парсинг: `OpenAPIV3Parser` с `resolveFully(true)` — внутренние `$ref` на `components.schemas` раскрываются inline, иначе тела запросов/ответов, ссылающиеся на компоненты, превращались бы в `{}`.
- Слаг проекта (`toSlug`): нижний регистр, неалфавитно-цифровые символы → `-`, крайние дефисы удаляются; пустое название → `untitled-project`, пустой результат очистки → `project`.

### Обновление превью

`EditorPage` при изменении проекта с debounce 400 мс вызывает `POST /api/spec/json` и передаёт полученный spec в `SwaggerPreview`.

### CORS и прокси

В dev-режиме фронтенд ходит на `/api/*`, которые Vite проксирует на `localhost:8080`. Дополнительно `CorsConfig` разрешает запросы с `http://localhost:5173` и `http://localhost:3000` к `/api/**` (methods GET/POST/PUT/DELETE/OPTIONS, `allowedHeaders("*")`, без credentials).

### Раздача UI в production

В production-сборке фронтенд (`frontend/dist`) копируется в `src/main/resources/static/` и раздаётся Spring Boot из того же JAR, что и backend. `SpaFallbackFilter` перенаправляет все запросы, не начинающиеся с `/api/` и `/assets/` (и не равные `/index.html`), на `index.html` — это позволяет client-side роутингу React Router работать при обновлении страницы и прямом заходе по ссылке (например, `/editor/my-project`).

---

## Конфигурация

Основные параметры — `src/main/resources/application.properties`:

```properties
server.port=8080
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB

gitlab.token=${GITLAB_TOKEN:}          # секрет: только через env / k8s Secret
gitlab.project=${GITLAB_PROJECT:KateMacevilo/swagger-editor-backend}
gitlab.branch=${GITLAB_BRANCH:main}
gitlab.url=${GITLAB_URL:https://gitlab.com}
```

- `gitlab.token` — Personal Access Token GitLab со scope `api`. Штатно через переменную окружения `GITLAB_TOKEN` или Kubernetes Secret. В файле fallback пустой — секретов в репозитории нет.
- `gitlab.project` — путь проекта с namespace (`group/project`, допускаются вложенные группы `group/sub/project`), **не полный URL**. Переопределяется через `GITLAB_PROJECT`.
- `gitlab.branch` — целевая ветка, по умолчанию `main`.
- `gitlab.url` — базовый URL инстанса без trailing slash и без `/api/v4`; для self-hosted задайте `GITLAB_URL`.

> См. `.env.example` для локального запуска и `chart/values.yaml` для Kubernetes. Helm-шаблон `configmap.yaml` пробрасывает `GITLAB_PROJECT`/`GITLAB_BRANCH`/`GITLAB_URL` (и настройки порта/multipart), `secret.yaml` — `GITLAB_TOKEN`.

---

## Стиль кода и соглашения

- **Backend**:
  - Lombok `@Data` / `@RequiredArgsConstructor` для DTO и сервисов.
  - `jakarta.validation.constraints.NotBlank` на обязательных полях DTO (`ProjectDTO.title`, `EndpointDTO.path`, `EndpointDTO.method`).
  - Контроллеры возвращают DTO напрямую или `ResponseEntity<T>`.
  - Глобальная обработка ошибок — `GlobalExceptionHandler` (`@RestControllerAdvice`).
  - Java-записи используются только для `GitLabProperties`.
  - Логирование через SLF4J (`LoggerFactory.getLogger(...)`), логи на английском.
  - Комментарии и Javadoc в коде — на английском; UI и сообщения пользователю — на русском.

- **Frontend**:
  - Функциональные компоненты React, хуки (`useState`, `useEffect`, `useRef`, `useCallback`).
  - Tailwind CSS для стилизации.
  - API-вызовы централизованы в `services/api.js`.
  - UI-тексты и сообщения пользователю на русском языке.

---

## Соображения безопасности

- **GitLab PAT** вынесен из кода в переменную окружения `GITLAB_TOKEN` (dev) или Kubernetes Secret (`chart/templates/secret.yaml`). Для локальной разработки — `.env` (в `.gitignore`), для Kubernetes — `chart/values-local.yaml` (тоже в `.gitignore`).
- **⚠️ Исторический инцидент**: до миграции на GitLab в `application.properties` был зашит реальный GitHub-токен (`ghp_...`, `github_pat_...`), он попал в git-историю. Эти токены нужно считать скомпрометированными: отозвать на GitHub и, если репозиторий публичный, почистить историю git.
- **CORS** настроен либерально для локальной разработки. Перед публикацией ограничьте origins.
- **Валидация входных данных** — `jakarta.validation` на DTO. Дополнительной авторизации, аутентификации и защиты от инъекций нет — приложение рассчитано на доверенную внутреннюю среду.
- **Импорт спецификаций** парсит произвольный JSON/YAML через `swagger-parser`; размер загрузки ограничен `10MB` (multipart).
- **Rate limits GitLab API** зависят от тарифа/инстанса. Список проектов выполняет `N+1` запросов (дерево + каждый `openapi.json`).

---

## Известные проблемы и подводные камни

1. **Исторический секрет в git-истории** — см. раздел «Соображения безопасности».
2. **`CLAUDE.md` устарел** — описывает H2-базу, JPA-сущности и эндпоинты вроде `/api/projects/{id}/endpoints`, которых в коде нет. `README.md` и этот файл актуальны.
3. **Нет базы данных** — несмотря на упоминание JPA/H2 в старой документации, в `pom.xml` нет `spring-boot-starter-data-jpa` и H2. Все данные живут в GitLab.
4. **Frontend-сборка**: `npm run build` завершается успешно, но выдаёт предупреждение о размере JS-чанка (>500 kB, в основном из-за swagger-ui). Косметическое, функциональность не нарушается.
5. **Сохранение на GitLab** требует валидного PAT (scope `api`) и прав на проект. При ошибках GitLab фронтенд показывает текст ошибки под кнопкой «Сохранить на GitLab».
6. **Slug как ID**: после создания проекта изменить его идентификатор (имя папки) через UI нельзя — только переименованием файла в GitLab.
7. **Потеря данных при перезаписи**: `PUT /api/projects/{id}` перезаписывает список эндпоинтов целиком; отдельной стратегии merge нет.
8. **`src/main/resources/scrins/`** — папка со скриншотами попала в ресурсы backend и уезжает в JAR; это не код, при желании её стоит вынести или удалить.
9. **Неиспользуемые поля `ProjectDTO`**: `createdAt`/`updatedAt`/`gitLabLastCommitSha`/`gitLabLastPublishedAt` есть в DTO, но бэкенд их не заполняет при чтении из GitLab — рассчитывать на них в UI не стоит.
10. **Миграция данных не автоматизирована**: при переходе с GitHub на GitLab существующие проекты в старом репозитории остались на месте. Переносятся вручную: скачать `{slug}/openapi.json` из GitHub и запушить в GitLab-проект с той же структурой папок.
11. **GitLab-интеграция не покрыта тестами** — тесты охватывают только парсинг/сериализацию OpenAPI; запись/чтение/удаление файлов проверяйте вручную с реальным токеном.
