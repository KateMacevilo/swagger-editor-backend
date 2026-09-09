# OpenAPI Visual Editor — AGENTS.md

## Обзор проекта

Full-stack веб-приложение для визуального создания, редактирования и предпросмотра спецификаций **OpenAPI 3.0.0 (Swagger)**.

- **Главная страница** (`/`) — список проектов, создание нового проекта, импорт готового OpenAPI-файла (JSON/YAML).
- **Редактор** (`/project/:projectId`) — трёхпанельный интерфейс:
  - **Левая панель** — список эндпоинтов проекта, кнопки экспорта JSON/YAML, сохранения на GitLab и редактирования мета-информации проекта.
  - **Центральная панель** — форма-конструктор эндпоинта: метод, путь, параметры, request body, ответы.
  - **Правая панель** — живой Swagger UI и сырой JSON сгенерированной спецификации.

Проекты хранятся не в локальной базе данных, а в заданном GitLab-проекте (репозитории): каждый проект — это папка `{slug}/openapi.json`. Бэкенд читает, создаёт, обновляет и удаляет эти файлы через GitLab REST API (v4). GitHub как хранилище полностью заменён на GitLab — GitHub-кода в проекте не осталось.

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
- **Maven** — сборка (`pom.xml` в корне). Базы данных (JPA/H2) в проекте нет.

### Frontend

- **React 18** + **React Router 6.26**.
- **Vite 5** (dev-сервер на порту 5173, прокси `/api` → `localhost:8080`, см. `frontend/vite.config.js`).
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
├── Dockerfile.prod-dist                 # Без npm-стадии: dist собирается dev-образом фронтенда заранее
├── certs/                               # *.crt → импорт в truststore JRE (корпоративный CA GitLab)
├── Dockerfile.testR                     # Образ для инфраструктуры pr (внутренний registry,
│                                        #   Java 21, конфиг через смонтированные файлы, не env)
├── docker-compose.yml                   # Dev-сервер фронтенда в Docker (VITE_API_TARGET)
├── .dockerignore
├── .env.example                         # Шаблон переменных окружения
├── error/                               # Скриншоты ошибок (не код)
├── gen/, target/                        # Артефакты сборки
├── swagger-editor-image.tar.gz,         # Сохранённые docker-образы (не код)
├── swagger-frontend-image.tar.gz
├── src/main/java/com/swaggereditor/
│   ├── SwaggerEditorApplication.java    # Точка входа Spring Boot
│   ├── config/
│   │   ├── CorsConfig.java              # CORS: разрешены :5173 и :3000 для /api/**
│   │   ├── GitLabConfig.java            # RestTemplate bean (EncodingMode.VALUES_ONLY!) + @EnableConfigurationProperties
│   │   ├── GitLabProperties.java        # gitlab.* properties (Java record, defaults: branch=main, url=gitlab.com)
│   │   └── SpaFallbackFilter.java       # Forward не-API путей в index.html (SPA)
│   ├── controller/
│   │   ├── ProjectController.java       # CRUD проектов (/api/projects)
│   │   ├── SpecificationController.java # Генерация OpenAPI JSON/YAML из ProjectDTO (/api/spec)
│   │   ├── ImportController.java        # Импорт файла/текста (/api/import)
│   │   └── GlobalExceptionHandler.java  # Единообразные ошибки (@RestControllerAdvice)
│   ├── dto/                             # Request/response DTO (Lombok @Data, jakarta.validation)
│   │   ├── ProjectDTO.java              #   (title @NotBlank; endpoints, serverUrl, version, schemas — компоненты,
│   │   │                              #    securityEnabled/securityAuthorizationUrl/securityScopes — OAuth2 и т.д.)
│   │   ├── ProjectSummaryDTO.java
│   │   ├── EndpointDTO.java             #   (path, method @NotBlank; tags — List<String>; secured — требует OAuth2)
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
│                                        #   (в .gitignore, артефакт сборки)
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
    ├── vite.config.js                   # Прокси /api → VITE_API_TARGET (default localhost:8080)
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── App.jsx                      # Роутинг (/, /project/:projectId) и навигация
        ├── main.jsx
        ├── index.css
        ├── services/api.js              # Все axios-запросы
        ├── pages/
        │   ├── HomePage.jsx             # Список проектов + создание/импорт
        │   └── EditorPage.jsx           # Трёхпанельный редактор
        └── components/
            ├── ParameterBuilder.jsx     # Query/Path/Header/Cookie параметры
            ├── ResponseBuilder.jsx      # HTTP-статусы и схемы ответов
            ├── SchemaBuilder.jsx        # Визуальный JSON Schema + Raw JSON; тела-$ref редактируются
            │                            #   как компоненты (dropdown выбора + «сохранить как компонент»)
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

Если локального Node.js нет, фронтенд можно поднять в Docker (прокси указывает на `host.docker.internal:8080`, т.е. бэкенд на хосте):

```bash
docker compose up --build frontend      # http://localhost:5173
# backend в контейнере: VITE_API_TARGET=http://backend:8080
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

Приложение доступно на **http://localhost:8080**. Каталог `src/main/resources/static/` — артефакт сборки (в `.gitignore`); перед упаковкой JAR его нужно обновить командой выше.

### Сборка Docker-образа

```bash
# Нужен готовый JAR (см. production-сборку выше)
docker build -t swagger-editor-backend:1.0.0 .
docker run -d --name swagger-editor -p 8080:8080 \
  -e GITLAB_TOKEN=<PAT> -e GITLAB_PROJECT=<group/project> \
  swagger-editor-backend:1.0.0
```

Базовый образ — `eclipse-temurin:17-jre`, порт 8080. `Dockerfile` копирует готовый JAR и сам ничего не собирает.

### Корпоративный сертификат GitLab (PKIX/SSLHandshake)

Если бэкенд при обращении к GitLab падает с `PKIX path building failed` / `SSLHandshakeException` (корпоративный CA не входит в truststore JRE), положите сертификат(ы) CA в `certs/*.crt` — все три Dockerfile (`Dockerfile`, `Dockerfile.full`, `Dockerfile.prod-dist`) импортируют их в truststore JRE (`keytool -cacerts`) при сборке. Сертификат возьмите у ИБ/админов GitLab либо выгрузите из браузера; как временная мера подойдёт и серверный сертификат:

```bash
openssl s_client -connect <gitlab-host>:443 -servername <gitlab-host> </dev/null 2>/dev/null \
  | openssl x509 > certs/prior-ca.crt
```

### Полная сборка в Docker (без локальных Node/Maven/JDK)

`Dockerfile.full` — multi-stage: frontend собирается в стадии `node`, JAR — в стадии `maven`, в финальный образ копируется только JAR:

```bash
docker build -f Dockerfile.full -t swagger-editor-backend:1.0.0 .
```

### Сборка на машине без Node.js, с готовым образом фронтенда

`Dockerfile.prod-dist` — как `Dockerfile.full`, но стадия npm пропущена: `frontend/dist` собирается заранее самим dev-образом фронтенда (в нём уже есть `node_modules`), затем собирается только JAR:

```bash
# 1) собрать dist образом фронтенда (в корне репозитория)
docker run --rm -v "$PWD/frontend:/fe" swagger-editor-backend-frontend sh -c \
  "rm -rf /tmp/f && cp -r /fe /tmp/f && ln -s /app/node_modules /tmp/f/node_modules \
   && cd /tmp/f && npm run build && rm -rf /fe/dist && cp -r /tmp/f/dist /fe/dist"
# 2) dist → ресурсы backend (docker-контекст frontend/dist игнорируется)
mkdir -p src/main/resources/static && cp -r frontend/dist/* src/main/resources/static/
# 3) сборка; базовые образы можно подставить из внутреннего registry
docker build -f Dockerfile.prod-dist \
  --build-arg MAVEN_IMAGE=<registry>/maven:3.9-eclipse-temurin-17 \
  --build-arg JRE_IMAGE=<registry>/eclipse-temurin:17-jre \
  -t swagger-editor:1.0.0 .
```

### Образ для инфраструктуры pr

`Dockerfile.testR` — внутренний образ для инфраструктуры заказчика: базовый образ из `artifacts.pr.by` (без доступа в интернет), Java 21, конфигурация через смонтированные файлы `/etc/config/config.yaml` и `/etc/secret/secret.yaml` (env-переменные по-прежнему работают и имеют приоритет). Обычной разработке не нужен.

### Развёртывание в Kubernetes через Helm

**Что понадобится**

- Кластер Kubernetes + настроенный `kubectl`, установленный Helm 3.
- GitLab Personal Access Token (scope `api`) и путь проекта вида `group/project`.
- Образ backend в registry, доступном из кластера (сборка — шаг 1).
- (Опционально) Ingress-контроллер (nginx) для внешнего доступа по DNS-имени. Без него можно пользоваться `kubectl port-forward`.

**Шаг 1. Собрать и доставить образ**

В контейнере одно приложение: backend (8080) раздаёт и собранный фронтенд, поэтому нужен только образ backend.

Вариант A — registry доступен из кластера (внутренний registry, GitLab Registry и т.п.):

```bash
# Полная сборка внутри Docker (frontend собирается в первой стадии, JAR — во второй)
docker build -f Dockerfile.full -t <registry>/<namespace>/swagger-editor-backend:1.0.0 .
docker push <registry>/<namespace>/swagger-editor-backend:1.0.0
```

Для приватного registry добавьте `imagePullSecrets` в values (шаг 2).

Вариант B — кластер без доступа в интернет (air-gapped, например площадка заказчика):

```bash
# На машине, где есть Docker и исходники:
docker build -f Dockerfile.full -t swagger-editor-backend:1.0.0 .
docker save swagger-editor-backend:1.0.0 | gzip > swagger-editor-backend.tar.gz

# Переносим архив на площадку и загружаем в containerd каждой ноды
# (или в registry кластера, если он есть):
gunzip -c swagger-editor-backend.tar.gz | ctr -n k8s.io images import -
```

В values (шаг 2) тогда: `image.repository: swagger-editor-backend`, `image.tag: "1.0.0"`, `image.pullPolicy: IfNotPresent`.

**Шаг 2. Подготовить `chart/values-local.yaml`** (файл в `.gitignore`, содержит секреты):

```bash
cat > chart/values-local.yaml <<EOF
gitlab:
  project: <group/project>        # путь без https:// и без .git
  branch: main
  url: https://gitlab.com         # для self-hosted — адрес вашего инстанса
gitlabToken: <PAT со scope api>
image:
  repository: <registry>/<namespace>/swagger-editor-backend
  tag: "1.0.0"
  pullPolicy: IfNotPresent
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: swagger-editor.example.com
      paths:
        - path: /
          pathType: Prefix
EOF
```

`secret.yaml` обязателен: при пустом `gitlabToken` установка завершится ошибкой (`required`). Лимиты/requests, HPA и т.п. — см. дефолты в `chart/values.yaml`.

**Шаг 3. Установка / обновление**

```bash
helm install swagger-editor ./chart -f chart/values-local.yaml
helm upgrade swagger-editor ./chart -f chart/values-local.yaml
```

Имя всех ресурсов (Deployment/Service/Ingress) фиксируется значением `fullnameOverride: "swagger-editor"` в `chart/values.yaml` — оно не зависит от имени релиза. Поменять имя сервиса — изменить только этот параметр.

**Шаг 4. Проверка**

```bash
kubectl get pods -l app.kubernetes.io/instance=swagger-editor
kubectl logs -l app.kubernetes.io/instance=swagger-editor --tail=100

# Доступ без ingress:
kubectl port-forward svc/swagger-editor 8080:8080
# → http://localhost:8080 (UI + API в одном)
```

С открытым UI: список проектов должен подтянуться из GitLab, «Сохранить на GitLab» должен создать коммит без ошибок.

**Типичные проблемы**

| Симптом | Причина / решение |
|---|---|
| `ImagePullBackOff` | Неверный `image.repository`/tag, приватный registry без `imagePullSecrets`, в air-gapped-кластере образ не загружен на ноду |
| 503 «GitLab integration is not configured» | Не заданы `GITLAB_TOKEN`/`GITLAB_PROJECT` (пустые `gitlabToken`/`gitlab.project` в values — secret/configmap не собрались) |
| 404 «Project Not Found» от GitLab | Неверный `gitlab.project` (должен быть путь `group/project`, не URL и не `.git`), либо у токена нет прав на проект |
| `PKIX path building failed` / `SSLHandshakeException` к GitLab | GitLab за корпоративным CA. Без пересборки образа: `kubectl create configmap gitlab-ca --from-file=prior-ca.crt=<crt>` + `gitlabCa.enabled=true` в values (initContainer соберёт truststore и подключит его через `JAVA_TOOL_OPTIONS`). С пересборкой: положить `.crt` в `certs/` — Dockerfile импортируют его в truststore JRE |
| Долгий старт списка проектов | Норма: `findAll()` делает N+1 запросов к GitLab API (дерево + каждый `openapi.json`) |
| Ingress 502 | Под не ready — смотреть `kubectl logs`; проверить `service.port` (8080) |

Удаление: `helm uninstall swagger-editor` (данные в GitLab остаются — удаляются только ресурсы в кластере).

#### CI/CD (GitLab CI)

`.gitlab-ci.yml` в корне собирает образ целиком через `Dockerfile.full` (frontend собирается в первой стадии, JAR — во второй) и пушит его в Artifactory:

- стадия `build-image` — `docker build -f Dockerfile.full` + push `artifacts.pr.by/<namespace>/swagger-editor-backend:<sha>` и `:latest`, запускается на пуш в `master-back`;
- стадия `deploy-k8s` (manual) — `helm upgrade --install` с подстановкой `image.tag=<sha>`, `gitlabToken` и `imagePullSecrets` через `--set`.

Для работы нужны CI-переменные (masked): `ARTIFACTORY_USER`, `ARTIFACTORY_PASSWORD`, `GITLAB_TOKEN` (+ опционально `GITLAB_PROJECT`/`GITLAB_BRANCH`/`GITLAB_URL`). Перед первым деплоем создать pull-secret: `kubectl create secret docker-registry artifactory-cred --docker-server=artifacts.pr.by --docker-username=<user> --docker-password=<pass>`. В `values-local.yaml` секреты можно не держать — деплой из CI передаёт их через `--set`.

**Air-gapped (нет доступа к Docker Hub/npm с runner'а).** Базовые образы `Dockerfile.full` параметризованы: `--build-arg NODE_IMAGE=/MAVEN_IMAGE=/JRE_IMAGE=` позволяют подставить пути из Artifactory-proxy (в CI — через одноимённые переменные, см. `.gitlab-ci.yml`). Если proxy-репозиториев в Artifactory нет — собирать образ на машине с интернетом и пушить в Artifactory вручную (`docker build -f Dockerfile.full -t <registry>/... . && docker push ...`), а CI оставить только на деплой. Если машина с интернетом не имеет доступа к Artifactory — перенести образ файлом: `docker save <image> | gzip > img.tar.gz` → на площадке `gunzip -c img.tar.gz | ctr -n k8s.io images import -` на каждой ноде (тогда `image.pullPolicy: IfNotPresent`). `npm ci` внутри стадии frontend тоже требует доступа к npm-registry — штатно его проксирует тот же Artifactory; внутренние образы node могут включать `engine-strict` через `NPM_CONFIG_ENGINE_STRICT` (env перекрывает `.npmrc`, поэтому в Dockerfile'ах используется флаг CLI `npm ci --engine-strict=false`).

Образ frontend (`swagger-editor-backend-frontend`, dev-сервер Vite) на k8s не нужен — в проде UI раздаётся из JAR бэкенда; dev-образ используется только для локальной разработки на машинах без Node.js.

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
| POST | `/api/projects/{id}/rename` | Переименовать проект: body `{"title": "..."}`, файл переносится в папку нового slug (400 если slug занят) |
| DELETE | `/api/projects/{id}` | Удалить `openapi.json` из GitLab (204) |
| POST | `/api/spec/json` | Сгенерировать OpenAPI JSON из `ProjectDTO` |
| POST | `/api/spec/yaml` | Сгенерировать OpenAPI YAML из `ProjectDTO` |
| POST | `/api/import/file` | Импорт файла (multipart/form-data, поле `file`) |
| POST | `/api/import/text` | Импорт строки (text/plain) |

Эндпоинты проекта не выделены в отдельный подресурс: они хранятся как список `endpoints` внутри `ProjectDTO` и перезаписываются целиком при `PUT /api/projects/{id}`.

Коды ошибок (`GlobalExceptionHandler`): `NoSuchElementException` → 404, `IllegalArgumentException` → 400, `IllegalStateException` → 503, `HttpClientErrorException` → статус GitLab (из тела извлекается поле `message`/`error`), `RestClientException` → 502, остальное → 500. Тело ошибки — `ErrorResponseDTO` (timestamp, status, error, message). Исключение — ошибки импорта в `ImportController`: они возвращаются как простой JSON `{"error": "..."}` со статусом 400.

---

## Архитектурные решения

### GitLab как единственный источник правды

Бэкенд не использует базу данных. Каждый проект — файл `{slug}/openapi.json` в GitLab-репозитории:

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
- Ответы, ожидающие JSON, проверяются на Content-Type: HTML-страница (SSO/прокси) → `IllegalStateException` с понятным сообщением вместо молчаливого падения.

**Важный подводный камень:** `GitLabConfig.restTemplate()` настроен с `DefaultUriBuilderFactory.EncodingMode.VALUES_ONLY`. URL в `GitLabService` уже pre-encoded (`group%2Fproject`), а дефолтный режим `TEMPLATE_AND_VALUES` перекодировал бы `%` → `%25`, и GitLab отвечал бы «404 Project Not Found». При рефакторинге RestTemplate это не сломать.

Если токен или project не заданы, `validateConfig()` бросает `IllegalStateException("GitLab integration is not configured...")` → HTTP 503. `effectiveProject()` подчищает случайные префиксы `https://.../` и суффикс `.git` у пути проекта. Self-hosted GitLab — через `gitlab.url`.

### Хранение схем

Request body и response body хранятся как **JSON-строки** внутри DTO (`requestBodySchema`, `bodySchema`). `OpenApiService` преобразует их в `io.swagger.v3.oas.models.media.Schema` через Jackson (`mapToSchema` / `schemaToMap`); поддерживаются типы `string`, `integer`, `number`, `boolean`, `array`, `object` и поля `format`, `description`, `example`, `default`, `enum`, `nullable`, `minLength`, `maxLength`, `pattern`, `minItems`, `maxItems`, `additionalProperties`, `oneOf`/`anyOf`/`allOf`, `properties`, `required`. Request body добавляется только для POST/PUT/PATCH и только с media type `application/json`; при парсинге сохраняется первый server из `servers`. Тело ответа/запроса выбирается из `content` хелпером `extractBodySchema`: точное `application/json` (с параметрами вроде `; charset=UTF-8` — конвертер Swagger 2.0 их генерирует), затем любой json, затем первый entry.

### Tags эндпоинтов

В `EndpointDTO` tags — это `List<String>`, **не** строка через запятую: тег может сам содержать запятые (например, «Создание, получение и отзыв платежа ...»), и join/split по `,` разрывал бы его на фрагменты. На этом основан регрессионный тест `ImportRoundTripTest`.

### Генерация и парсинг OpenAPI

- Генерация: `OpenApiService.toJson/toYaml` собирают объект `OpenAPI` из `swagger-models` (версия спецификации фиксирована — `3.0.0`) и сериализуют через `io.swagger.v3.core.util.Json` / `Yaml`. Если у эндпоинта нет ответов, добавляется дефолтный `200 OK`. Поддерживаются 7 HTTP-методов: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD (`OpenApiService.setOperation`). Если заданы `securityAuthorizationUrl`/`securityScopes`, в `components.securitySchemes` добавляется схема `default` (oauth2, implicit flow) — как в исходном SwaggerConfiguration java-проекта; `securityEnabled: true` добавляет глобальный `security: [{default: []}]`, а `EndpointDTO.secured` — security на уровне операции (эндпоинт можно сделать необязательным).
- Парсинг: файлы Swagger 2.0 (`"swagger":"2.0"`, например экспорт ReferenceData) сначала конвертируются в OpenAPI 3 через `SwaggerConverter`, затем `OpenAPIV3Parser` **без** `resolveFully` — `$ref` на `components.schemas` сохраняются ссылками: компоненты копируются в `ProjectDTO.schemas`, а тела запросов/ответов хранят `{"$ref": "#/components/schemas/<name>"}`. При регенерации компоненты возвращаются в `components.schemas`, поэтому схемы не дублируются в каждом эндпоинте. Раньше использовался `resolveFully(true)`, который инлайнил компоненты и раздувал спецификацию копиями.
- Слаг проекта (`toSlug`): нижний регистр, неалфавитно-цифровые символы → `-`, крайние дефисы удаляются; пустое название → `untitled-project`, пустой результат очистки → `project`. Транслитерации кириллицы нет: русское название даст дефолтный `project`.

### Обновление превью

`EditorPage` при изменении проекта с debounce 400 мс вызывает `POST /api/spec/json` и передаёт полученный spec в `SwaggerPreview`.

### CORS и прокси

В dev-режиме фронтенд ходит на `/api/*`, которые Vite проксирует на `VITE_API_TARGET` (по умолчанию `localhost:8080`; в docker-compose — `host.docker.internal:8080`). Дополнительно `CorsConfig` разрешает запросы с `http://localhost:5173` и `http://localhost:3000` к `/api/**` (methods GET/POST/PUT/DELETE/OPTIONS, `allowedHeaders("*")`, без credentials).

### Раздача UI в production

В production-сборке фронтенд (`frontend/dist`) копируется в `src/main/resources/static/` и раздаётся Spring Boot из того же JAR, что и backend. `SpaFallbackFilter` перенаправляет все запросы, не начинающиеся с `/api/` и `/assets/` (и не равные `/index.html`), на `index.html` — это позволяет client-side роутингу React Router работать при обновлении страницы и прямом заходе по ссылке (например, `/project/my-project`).

---

## Конфигурация

Основные параметры — `src/main/resources/application.properties`:

```properties
server.port=8080
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB

gitlab.token=${GITLAB_TOKEN:...}       # секрет: штатно через env / k8s Secret
gitlab.project=${GITLAB_PROJECT:macevilo.ekaterina/swagger-editor-backend}
gitlab.branch=${GITLAB_BRANCH:main}
gitlab.url=${GITLAB_URL:https://gitlab.com}
```

- `gitlab.token` — Personal Access Token GitLab со scope `api`. Штатно через переменную окружения `GITLAB_TOKEN` или Kubernetes Secret. **См. раздел безопасности — в файле сейчас зашит реальный токен.**
- `gitlab.project` — путь проекта с namespace (`group/project`, допускаются вложенные группы `group/sub/project`), **не полный URL**. Переопределяется через `GITLAB_PROJECT`. (В `README.md` указан другой дефолт — `KateMacevilo/swagger-editor-backend`; фактическое значение смотрите в `application.properties`.)
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

- **⚠️ Активный инцидент: реальный GitLab-токен в репозитории.** В `src/main/resources/application.properties` в fallback-значении `gitlab.token` зашит настоящий PAT (`glpat-...`), и файл закоммичен в git. Этот токен нужно считать скомпрометированным: отозвать/перевыпустить в GitLab, убрать из файла (оставить пустой fallback `${GITLAB_TOKEN:}`) и почистить git-историю, если репозиторий доступен кому-либо ещё.
- **Исторический инцидент**: до миграции на GitLab в `application.properties` были зашиты реальные GitHub-токены (`ghp_...`, `github_pat_...`), они попали в git-историю. Считать скомпрометированными и отозвать на GitHub.
- **GitLab PAT** штатно вынесен в переменную окружения `GITLAB_TOKEN` (dev) или Kubernetes Secret (`chart/templates/secret.yaml`). Для локальной разработки — `.env` (в `.gitignore`), для Kubernetes — `chart/values-local.yaml` (тоже в `.gitignore`).
- **CORS** настроен либерально для локальной разработки. Перед публикацией ограничьте origins.
- **Валидация входных данных** — `jakarta.validation` на DTO. Дополнительной авторизации, аутентификации и защиты от инъекций нет — приложение рассчитано на доверенную внутреннюю среду.
- **Импорт спецификаций** парсит произвольный JSON/YAML через `swagger-parser`; размер загрузки ограничен `10MB` (multipart).
- **Rate limits GitLab API** зависят от тарифа/инстанса. Список проектов выполняет `N+1` запросов (дерево + каждый `openapi.json`).

---

## Известные проблемы и подводные камни

1. **Реальный секрет в `application.properties`** — см. раздел «Соображения безопасности»; это самая срочная из известных проблем.
2. **`CLAUDE.md` устарел** — описывает H2-базу, JPA-сущности и эндпоинты вроде `/api/projects/{id}/endpoints`, которых в коде нет. `README.md` и этот файл актуальны.
3. **Нет базы данных** — несмотря на упоминание JPA/H2 в старой документации, в `pom.xml` нет `spring-boot-starter-data-jpa` и H2. Все данные живут в GitLab.
4. **Frontend-сборка**: `npm run build` завершается успешно, но выдаёт предупреждение о размере JS-чанка (>500 kB, в основном из-за swagger-ui). Косметическое, функциональность не нарушается.
5. **Сохранение на GitLab** требует валидного PAT (scope `api`) и прав на проект. При ошибках GitLab фронтенд показывает текст ошибки под кнопкой «Сохранить на GitLab».
6. **Slug как ID**: идентификатор проекта — папка в GitLab (slug названия). Смена названия в настройках проекта переносит файл в новую папку (`POST /api/projects/{id}/rename`, один коммит create+delete); если slug нового названия совпадает с существующим — ошибка 400. Кириллические названия дают неинформативный slug `project` (транслитерации нет).
7. **Потеря данных при перезаписи**: `PUT /api/projects/{id}` перезаписывает список эндпоинтов целиком; отдельной стратегии merge нет.
8. **`src/main/resources/scrins/`** — папка со скриншотами попала в ресурсы backend и уезжает в JAR; это не код, при желании её стоит вынести или удалить.
9. **Неиспользуемые поля `ProjectDTO`**: `createdAt`/`updatedAt`/`gitLabLastCommitSha`/`gitLabLastPublishedAt` есть в DTO, но бэкенд их не заполняет при чтении из GitLab — рассчитывать на них в UI не стоит.
10. **GitLab-интеграция не покрыта тестами** — тесты охватывают только парсинг/сериализацию OpenAPI; запись/чтение/удаление файлов проверяйте вручную с реальным токеном.
11. **Мусор в корне репозитория**: `swagger-editor-image.tar.gz` и `swagger-frontend-image.tar.gz` (сохранённые docker-образы), папка `error/` со скриншотами, `gen/` и `target/` — артефакты, которые стоит держать вне git.
