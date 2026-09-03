# OpenAPI Visual Editor

Full-stack веб-приложение для визуального создания, редактирования и предпросмотра спецификаций **OpenAPI 3.0.0 (Swagger)**.

- **Главная страница** — список проектов, создание нового проекта, импорт готового OpenAPI-файла (JSON/YAML).
- **Редактор** — трёхпанельный интерфейс:
  - слева — список эндпоинтов, экспорт JSON/YAML, сохранение на GitHub;
  - в центре — форма-конструктор эндпоинта (метод, путь, параметры, request body, ответы);
  - справа — живой Swagger UI и сырой JSON спецификации (клик по эндпоинту в превью открывает его в редакторе).

Проекты хранятся **не в локальной базе**, а в заданном GitHub-репозитории: каждый проект — папка `{slug}/openapi.json`. Бэкенд работает с ними через GitHub REST API.

> Полная техническая документация для разработчиков — в [AGENTS.md](AGENTS.md).

---

## Конфигурация

Приложению нужен GitHub Personal Access Token с правами на чтение/запись содержимого репозитория.

| Переменная окружения | Назначение | По умолчанию |
|---|---|---|
| `GITHUB_TOKEN` | **Обязательно.** PAT для GitHub API | — |
| `GITHUB_OWNER` | Владелец репозитория | `KateMacevilo` |
| `GITHUB_REPO` | Имя репозитория | `swagger-editor-backend` |
| `GITHUB_BRANCH` | Целевая ветка | `main` |

Локально для dev-режима удобно использовать `.env` (шаблон — `.env.example`).

---

## Запуск

### Вариант 1. Docker (рекомендуется)

Нужен готовый JAR (`mvn package -DskipTests` после `npm run build` и копирования `frontend/dist/*` в `src/main/resources/static/`):

```bash
docker build -t swagger-editor-backend:1.0.0 .
docker run -d --name swagger-editor -p 8080:8080 \
  -e GITHUB_TOKEN=<токен> -e GITHUB_OWNER=<owner> -e GITHUB_REPO=<repo> \
  swagger-editor-backend:1.0.0
```

Приложение: **http://localhost:8080**.

Если на машине нет Node/Maven/JDK, образ можно собрать целиком в Docker (stages: node → maven → jre):

```bash
docker build -f Dockerfile.full -t swagger-editor-backend:1.0.0 .
```

### Вариант 2. Локально (dev-режим, два терминала)

```bash
# 1. Backend
mvn spring-boot:run          # http://localhost:8080

# 2. Frontend
cd frontend
npm install                  # только при первом запуске
npm run dev                  # http://localhost:5173
```

В dev-режиме Vite проксирует `/api` на `localhost:8080`.

### Вариант 3. Локально (production, один JAR)

```bash
cd frontend && npm run build && cp -r dist/* ../src/main/resources/static/ && cd ..
mvn package -DskipTests
java -jar target/swagger-editor-backend-1.0.0.jar
```

---

## Перенос на другой компьютер без интернета (offline)

Если на целевой машине нет доступа в интернет (нельзя скачать зависимости npm/maven или образы Docker), переносится **готовый образ**:

```bash
# На машине с Docker (здесь). ВАЖНО: под Windows нужен linux/amd64!
docker build --platform linux/amd64 -t swagger-editor-backend:1.0.0-amd64 .
docker save swagger-editor-backend:1.0.0-amd64 | gzip > swagger-editor-image.tar.gz
```

Перенести `swagger-editor-image.tar.gz` на целевую машину (флешка/локальная сеть), затем там:

```powershell
docker load -i swagger-editor-image.tar.gz

docker run -d --name swagger-editor -p 8080:8080 `
  -e GITHUB_TOKEN=<токен> -e GITHUB_OWNER=<owner> -e GITHUB_REPO=<repo> `
  swagger-editor-backend:1.0.0-amd64
```

Нюансы:

- На целевой машине нужен только Docker (при его отсутствии — перенести офлайн-инсталлятор Docker Desktop).
- Образ должен быть собран под архитектуру целевой машины (`linux/amd64` для обычных Windows/Linux, `linux/arm64` для Mac на Apple Silicon).
- При работе приложению нужен доступ к `api.github.com` — без него проекты не загрузятся.
- Обновление кода на offline-машине: правки здесь → пересборка образа → повторный `docker save` → перенос.

---

## Развёртывание в Kubernetes

Helm chart — в каталоге [`chart/`](chart/values.yaml). Установка (секреты — в `chart/values-local.yaml`, он в `.gitignore`):

```bash
helm install swagger-editor ./chart -f chart/values-local.yaml
```

Детали — в [AGENTS.md](AGENTS.md).

---

## Тесты

```bash
mvn test
```

Smoke-тест загрузки контекста + регрессионный `ImportRoundTripTest` на реальной open-banking-спецификации (`src/main/resources/json-test/swagger.json`, ~1 МБ).

---

## Технологии

**Backend:** Java 17, Spring Boot 3.2.3, GitHub REST API, swagger-models / swagger-core / swagger-parser, Jackson YAML, Lombok, Maven.

**Frontend:** React 18, React Router 6, Vite 5, Tailwind CSS 3, swagger-ui-react, Axios.
