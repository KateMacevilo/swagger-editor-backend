# OpenAPI Visual Editor — AGENTS.md

## Обзор проекта

Full-stack веб-приложение для визуального создания, редактирования и предпросмотра спецификаций **OpenAPI 3.0.0 (Swagger)**.

- **Главная страница** — список проектов, создание нового проекта, импорт готового OpenAPI-файла (JSON/YAML).
- **Редактор** — трёхпанельный интерфейс:
  - **Левая панель** — список эндпоинтов проекта, кнопки экспорта JSON/YAML и сохранения на GitHub.
  - **Центральная панель** — форма-конструктор эндпоинта: метод, путь, параметры, request body, ответы.
  - **Правая панель** — живой Swagger UI и сырой JSON сгенерированной спецификации.

Проекты хранятся не в локальной базе данных, а в заданном GitHub-репозитории: каждый проект — это папка `{slug}/openapi.json`. Бэкенд читает, создаёт, обновляет и удаляет эти файлы через GitHub REST API.

---

## Технологический стек

### Backend

- **Java 17** (target), фактически проверено на **OpenJDK 21.0.10**.
- **Spring Boot 3.2.3** (`spring-boot-starter-web`, `spring-boot-starter-validation`).
- **GitHub REST API** — единственное хранилище проектов.
- **Swagger ecosystem**:
  - `io.swagger.core.v3:swagger-models:2.2.20` — объектная модель OpenAPI 3.0.
  - `io.swagger.core.v3:swagger-core:2.2.20` — сериализация в JSON/YAML.
  - `io.swagger.parser.v3:swagger-parser:2.1.21` — импорт существующих спецификаций.
- **Jackson YAML** (`jackson-dataformat-yaml`).
- **Lombok**.
- **Maven** 3.9+ (в текущем окружении доступен и в `PATH`, и wrapper в `~/.m2/wrapper`).

### Frontend

- **React 18** + **React Router 6**.
- **Vite 5** (dev-сервер на порту 5173).
- **Tailwind CSS 3** + **PostCSS/Autoprefixer**.
- **swagger-ui-react 5** — встроенный Swagger UI.
- **Axios** — HTTP-клиент.
- **Node.js 26.3.0**, **npm 11.16.0** (пути `/opt/homebrew/bin/node` и `/opt/homebrew/bin/npm`).

---

## Структура проекта

```
/Users/katerinazaharenko/Documents/dkr-swagger/swagger-editor-backend/
├── pom.xml                              # Корневой Maven POM (backend)
├── Dockerfile                           # Контейнерный образ для k8s
├── src/main/java/com/swaggereditor/
│   ├── SwaggerEditorApplication.java    # Точка входа Spring Boot
│   ├── config/
│   │   ├── CorsConfig.java              # CORS: разрешены :5173 и :3000
│   │   ├── GitHubConfig.java            # RestTemplate bean + @EnableConfigurationProperties
│   │   └── GitHubProperties.java        # github.* properties (record)
│   ├── controller/                      # REST-контроллеры
│   │   ├── ProjectController.java       # CRUD проектов
│   │   ├── SpecificationController.java # Генерация OpenAPI JSON/YAML из ProjectDTO
│   │   ├── ImportController.java        # Импорт файла/текста
│   │   └── GlobalExceptionHandler.java  # Единообразные ошибки
│   ├── dto/                             # Request/response DTO (Lombok @Data, jakarta.validation)
│   │   ├── ProjectDTO.java
│   │   ├── ProjectSummaryDTO.java
│   │   ├── EndpointDTO.java
│   │   ├── ApiParameterDTO.java
│   │   ├── ApiResponseDTO.java
│   │   └── ErrorResponseDTO.java
│   └── service/                         # Бизнес-логика
│       ├── ProjectService.java          # Чтение/запись проектов в GitHub
│       ├── OpenApiService.java          # Парсинг/сериализация OpenAPI ↔ DTO
│       └── GitHubService.java           # Низкоуровневые операции с файлами GitHub
├── src/main/resources/
│   └── application.properties           # Порт, multipart, GitHub-конфиг (без секретов)
├── src/test/java/com/swaggereditor/
│   └── SwaggerEditorApplicationTests.java  # Smoke-тест загрузки контекста
├── chart/                               # Helm chart для Kubernetes
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
├── frontend/
│   ├── package.json
│   ├── vite.config.js                   # Прокси /api → localhost:8080
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx                      # Роутинг и навигация
│       ├── main.jsx
│       ├── index.css
│       ├── services/api.js              # Все axios-запросы
│       ├── pages/
│       │   ├── HomePage.jsx             # Список проектов + создание/импорт
│       │   └── EditorPage.jsx           # Трёхпанельный редактор
│       └── components/
│           ├── ParameterBuilder.jsx     # Query/Path/Header/Cookie параметры
│           ├── ResponseBuilder.jsx      # HTTP-статусы и схемы ответов
│           ├── SchemaBuilder.jsx        # Визуальный JSON Schema + Raw JSON
│           └── SwaggerPreview.jsx       # swagger-ui-react + вкладка JSON
```

---

## Команды сборки и запуска

### Dev-режим (два терминала)

```bash
# 1. Backend (из корня проекта, где лежит pom.xml)
mvn -f pom.xml spring-boot:run
```

Бэкенд стартует на **http://localhost:8080**.

```bash
# 2. Frontend (в отдельном терминале)
cd frontend
npm install   # только при первом запуске
npm run dev
```

Фронтенд стартует на **http://localhost:5173**.

> В текущем окружении `mvn` доступен в `PATH` как `/opt/homebrew/bin/mvn` (Apache Maven 3.9.16). Если `mvn` недоступен, используйте wrapper: `/Users/katerinazaharenko/.m2/wrapper/dists/apache-maven-3.9.9-bin/4nf9hui3q3djbarqar9g711ggc/apache-maven-3.9.9/bin/mvn`.

### Production-сборка (один JAR)

```bash
cd frontend
npm run build
cp -r dist/* ../src/main/resources/static/
cd ..
mvn -f pom.xml package -DskipTests
java -jar target/swagger-editor-backend-1.0.0.jar
```

Приложение будет доступно на **http://localhost:8080**.

### Сборка Docker-образа

```bash
cd frontend
npm run build
cp -r dist/* ../src/main/resources/static/
cd ..
mvn -f pom.xml package -DskipTests

docker build -t swagger-editor-backend:1.0.0 .
```

### Развёртывание в Kubernetes через Helm

Структура chart:

```
chart/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── _helpers.tpl
    ├── configmap.yaml
    ├── secret.yaml
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    └── hpa.yaml
```

Сборка образа и установка:

```bash
# 1. Собрать production JAR (frontend уже в src/main/resources/static/)
mvn -f pom.xml package -DskipTests

# 2. Собрать Docker-образ и загрузить в registry
#    (замените registry/namespace и тег на свои)
docker build -t <registry>/<namespace>/swagger-editor-backend:1.0.0 .
docker push <registry>/<namespace>/swagger-editor-backend:1.0.0

# 3. Подготовить values-local.yaml с секретами и локальными настройками
cat > chart/values-local.yaml <<EOF
github:
  owner: <owner>
  repo: <repo>
  branch: main
githubToken: <PAT>

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

# 4. Установить chart
helm install swagger-editor ./chart -f chart/values-local.yaml

# Обновление
helm upgrade swagger-editor ./chart -f chart/values-local.yaml
```

> `chart/values-local.yaml` добавлен в `.gitignore`, чтобы секреты и кластерные настройки не попали в git.

### Тесты

```bash
mvn -f pom.xml test
```

Проверено: smoke-тест `SwaggerEditorApplicationTests.contextLoads()` проходит успешно. Специфичные тесты бизнес-логики и GitHub-операций в проекте не настроены. Фронтенд-тесты и линтеры не настроены.

---

## API backend

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/projects` | Список проектов из GitHub |
| POST | `/api/projects` | Создать проект в GitHub |
| GET | `/api/projects/{id}` | Получить проект (JSON из GitHub) |
| PUT | `/api/projects/{id}` | Сохранить проект в GitHub |
| DELETE | `/api/projects/{id}` | Удалить `openapi.json` из GitHub |
| POST | `/api/spec/json` | Сгенерировать OpenAPI JSON из `ProjectDTO` |
| POST | `/api/spec/yaml` | Сгенерировать OpenAPI YAML из `ProjectDTO` |
| POST | `/api/import/file` | Импорт файла (multipart/form-data) |
| POST | `/api/import/text` | Импорт строки (text/plain) |

Эндпоинты проекта не выделены в отдельный подресурс: они хранятся как список `endpoints` внутри `ProjectDTO` и перезаписываются целиком при `PUT /api/projects/{id}`.

---

## Архитектурные решения

### GitHub как единственный источник правды

Бэкенд не использует базу данных. Каждый проект хранится в GitHub-репозитории как `{slug}/openapi.json`:

- `ProjectService.findAll()` получает список директорий через `GET /repos/{owner}/{repo}/contents/` и для каждой читает `openapi.json`. Загрузка выполняется параллельно в пуле до 10 потоков.
- `ProjectService.findById(id)` читает JSON по пути `{id}/openapi.json` и парсит его в `ProjectDTO`.
- `ProjectService.create(dto)` генерирует slug из названия, сериализует DTO в JSON и создаёт файл в GitHub.
- `ProjectService.update(id, dto)` сериализует `ProjectDTO` в JSON и обновляет файл в GitHub.
- `ProjectService.importSpec(content)` парсит стороннюю спецификацию и сразу коммитит результат в новую директорию.

Путь в репозитории и `sha` последнего коммита не сохраняются в БД (её нет), а вычисляются/запрашиваются у GitHub при каждой операции.

### Хранение схем

Request body и response body хранятся как **JSON-строки** внутри DTO (`requestBodySchema`, `bodySchema`). `OpenApiService` преобразует их в `io.swagger.v3.oas.models.media.Schema` через `ObjectMapper`.

### Генерация OpenAPI

`OpenApiService.toJson(projectDTO)` / `toYaml(projectDTO)` собирают объект `OpenAPI` из `swagger-models` и сериализуют через `io.swagger.v3.core.util.Json` / `Yaml`. Парсинг выполняет `OpenAPIV3Parser` из `swagger-parser` с включённым `resolve(true)`.

### Обновление превью

`EditorPage` при изменении проекта с задержкой (debounce 400 мс) вызывает `POST /api/spec/json` и передаёт полученный spec в `SwaggerPreview`.

### Идентификатор проекта

Идентификатором проекта служит имя папки в репозитории (slug от названия), которое формируется в `OpenApiService.toSlug()`: нижний регистр, неалфавитно-цифровые символы заменяются на `-`, крайние дефисы удаляются. Пустое название превращается в `untitled-project`.

### CORS и прокси

В dev-режиме фронтенд ходит на `/api/*`, которые Vite проксирует на `localhost:8080`. Дополнительно `CorsConfig` разрешает запросы с `http://localhost:5173` и `http://localhost:3000`.

---

## Конфигурация

Основные параметры в `src/main/resources/application.properties`:

```properties
server.port=8080
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB

# github.token задаётся через переменную окружения GITHUB_TOKEN
github.token=${GITHUB_TOKEN:}
github.owner=${GITHUB_OWNER:KateMacevilo}
github.repo=${GITHUB_REPO:swagger-editor-backend}
github.branch=${GITHUB_BRANCH:main}
```

- `github.token` — Personal Access Token с правами на чтение и запись содержимого репозитория. **Не хранится в `application.properties`**; передаётся через переменную окружения `GITHUB_TOKEN` или Kubernetes Secret.
- `github.owner` и `github.repo` — короткие имена (`KateMacevilo/swagger-editor-backend`), не полный URL. Можно переопределить через `GITHUB_OWNER`/`GITHUB_REPO`.
- `github.branch` — целевая ветка, по умолчанию `main`. Переопределяется через `GITHUB_BRANCH`.

> См. `.env.example` для локального запуска и `chart/values.yaml` для Kubernetes.

---

## Инструкции по тестированию

- **Backend**: единственный тест — `SwaggerEditorApplicationTests.contextLoads()`. Он проверяет, что Spring-контекст загружается.
- **Frontend**: тесты, линтеры и форматтеры не настроены.
- **Ручное тестирование**: убедитесь, что `github.token`, `github.owner` и `github.repo` заданы, иначе любой запрос к `/api/projects` вернёт `503 Service Unavailable` с сообщением `GitHub integration is not configured`.

---

## Стиль кода и соглашения

- **Backend**:
  - Lombok `@Data` / `@RequiredArgsConstructor` для DTO и сервисов.
  - `jakarta.validation.constraints.NotBlank` на обязательных полях DTO.
  - Контроллеры возвращают DTO напрямую или `ResponseEntity<T>`.
  - Глобальная обработка ошибок в `GlobalExceptionHandler`.
  - Java-записи используются только для `GitHubProperties`.
  - Логирование через SLF4J (`LoggerFactory.getLogger(...)`).

- **Frontend**:
  - Функциональные компоненты React, хуки (`useState`, `useEffect`, `useRef`, `useCallback`).
  - Tailwind CSS для стилизации.
  - API-вызовы централизованы в `services/api.js`.
  - UI-тексты и сообщения пользователю на русском языке.

---

## Соображения безопасности

- **CORS** настроен либерально для локальной разработки (`allowedOrigins` включает `localhost:5173` и `localhost:3000`, `allowedHeaders("*")`). Перед публикацией ограничьте origins.
- **GitHub PAT** вынесен из `application.properties`. Токен передаётся через переменную окружения `GITHUB_TOKEN` (dev) или Kubernetes Secret (`chart/templates/secret.yaml`) и не должен попадать в git. Для локальной разработки используйте `.env` (он в `.gitignore`), для Kubernetes — `chart/values-local.yaml` (тоже в `.gitignore`).
- **Валидация входных данных** использует `jakarta.validation` на DTO (`@NotBlank`). Дополнительной авторизации, аутентификации и защиты от инъекций нет.
- **Импорт спецификаций** парсит произвольный JSON/YAML через `swagger-parser`. Размер загружаемых файлов ограничен `spring.servlet.multipart.max-file-size=10MB`.
- **Rate limits GitHub API** — 5000 запросов в час для PAT. Список проектов выполняет `N+1` запросов (директории + каждый `openapi.json`).

---

## Известные проблемы и подводные камни

1. **`README.md` и `CLAUDE.md` устарели**: они описывают H2-базу данных, JPA-сущности и API-эндпоинты вроде `/api/projects/{id}/endpoints`, которых в коде нет. Доверяйте `AGENTS.md` и исходному коду.
2. **Нет базы данных**: несмотря на упоминание JPA/H2 в старой документации, в `pom.xml` нет `spring-boot-starter-data-jpa` и H2. Все данные живут в GitHub.
3. **Frontend-сборка**: `npm run build` завершается успешно, но выдаёт предупреждение о размере JS-чанка (>500 kB). Это косметическое, функциональность не нарушается.
4. **Сохранение на GitHub** требует валидного PAT и прав на репозиторий. При ошибках GitHub фронтенд показывает текст ошибки под кнопкой «Сохранить на GitHub».
5. **Slug как ID**: после создания проекта изменить его идентификатор (имя папки) через UI нельзя — только путём переименования файла в GitHub.
