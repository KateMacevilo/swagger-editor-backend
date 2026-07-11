# OpenAPI Visual Editor — CLAUDE.md

## Project overview

Full-stack web app for visually creating, editing, and previewing OpenAPI 3.0.0 specifications.
Two-panel UI: left side is a visual constructor (forms, lists), right side is live Swagger UI preview.

**Backend:** Spring Boot 3.2.3 / Java 17 / Maven — runs on `localhost:8080`
**Frontend:** Vite + React 18 + Tailwind CSS 3 — runs on `localhost:5173`
**Database:** H2 in-memory (resets on restart)

---

## Project structure

```
untitled/
├── pom.xml                          # Maven root (backend)
├── src/
│   ├── main/java/com/swaggereditor/
│   │   ├── SwaggerEditorApplication.java
│   │   ├── config/CorsConfig.java         # CORS: allows :5173 and :3000
│   │   ├── controller/
│   │   │   ├── ProjectController.java     # CRUD /api/projects
│   │   │   ├── EndpointController.java    # CRUD /api/projects/{id}/endpoints
│   │   │   ├── SpecificationController.java  # GET/download /api/projects/{id}/spec
│   │   │   └── ImportController.java      # POST /api/import/file|text
│   │   ├── dto/                           # Request/response shapes (Lombok @Data)
│   │   ├── entity/                        # JPA entities (Project, Endpoint, ApiParameter, ApiResponse)
│   │   ├── repository/                    # Spring Data JPA interfaces
│   │   └── service/
│   │       ├── ProjectService.java
│   │       ├── EndpointService.java
│   │       └── OpenApiService.java        # Core: builds OpenAPI object, import/export
│   └── resources/application.properties  # H2, port, multipart
└── frontend/
    ├── package.json
    ├── vite.config.js                     # Proxy /api → :8080
    └── src/
        ├── services/api.js                # All axios calls in one place
        ├── pages/
        │   ├── HomePage.jsx               # Project list + create/import
        │   └── EditorPage.jsx             # 3-panel editor (list | form | preview)
        └── components/
            ├── ParameterBuilder.jsx       # Query/Path/Header/Cookie params
            ├── ResponseBuilder.jsx        # HTTP status codes + schema per response
            ├── SchemaBuilder.jsx          # Visual JSON Schema tree + raw JSON toggle
            └── SwaggerPreview.jsx         # swagger-ui-react + JSON tab
```

---

## Dev commands

`mvn` не доступен в PATH напрямую — используй полный путь к бинарю из `.m2/wrapper`.

```bash
# Backend — запускать из корня проекта (где pom.xml)
MVN=~/.m2/wrapper/dists/apache-maven-3.9.9-bin/4nf9hui3q3djbarqar9g711ggc/apache-maven-3.9.9/bin/mvn
$MVN -f /Users/katerinazaharenko/Documents/dkr-swagger/untitled/pom.xml spring-boot:run

# Frontend — в отдельном терминале
cd /Users/katerinazaharenko/Documents/dkr-swagger/untitled/frontend
npm install   # только при первом запуске или после обновления package.json
npm run dev
```

**Важно:** всегда передавай `-f <путь>/pom.xml` при запуске Maven из другого рабочего каталога — иначе `spring-boot` plugin не найдётся.

Node.js установлен через Homebrew: `/opt/homebrew/bin/node` (v26.3.0), npm v11.16.0. Если `npm` не в PATH — использовать `/opt/homebrew/bin/npm`.

---

## Key architecture decisions

**Schema storage:** Request body and response schemas are stored as JSON strings (`TEXT` columns) and converted to/from `io.swagger.v3.oas.models.media.Schema` objects in `OpenApiService`. This keeps the DB simple while supporting full schema nesting.

**Cascade deletes:** `Endpoint` owns `ApiParameter` and `ApiResponse` via `CascadeType.ALL` + `orphanRemoval=true`. `EndpointService.update()` clears and re-adds collections on every save — no partial-update complexity.

**OpenAPI generation:** `OpenApiService.buildOpenApi(projectId)` constructs the full `OpenAPI` object using `swagger-models` and serializes via `io.swagger.v3.core.util.Json` / `Yaml`. Import uses `OpenAPIV3Parser` from `swagger-parser`.

**Preview refresh:** `EditorPage` holds a `previewKey` integer that increments after every save. `SwaggerPreview` re-fetches `GET /api/projects/{id}/spec` whenever `previewKey` changes. Swagger UI natively renders Markdown in descriptions, so multi-line text and lists (e.g. `- item`) are displayed correctly.

**Vite proxy:** All `/api/*` calls from the frontend go through the Vite dev server proxy to `:8080`, so no CORS issues during development and no hardcoded backend URL in frontend code.

---

## API surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Get project |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |
| GET | `/api/projects/{id}/endpoints` | List endpoints |
| POST | `/api/projects/{id}/endpoints` | Create endpoint |
| PUT | `/api/projects/{id}/endpoints/{eid}` | Update endpoint |
| DELETE | `/api/projects/{id}/endpoints/{eid}` | Delete endpoint |
| GET | `/api/projects/{id}/spec` | Spec as JSON (for preview) |
| GET | `/api/projects/{id}/spec/download/json` | Download openapi.json |
| GET | `/api/projects/{id}/spec/download/yaml` | Download openapi.yaml |
| POST | `/api/import/file` | Import multipart file |
| POST | `/api/import/text` | Import raw text body |

---

## Key dependencies

**Backend**
- `spring-boot-starter-web` + `spring-boot-starter-data-jpa` + `spring-boot-starter-validation`
- `io.swagger.core.v3:swagger-models:2.2.20` — OpenAPI 3.0 object model
- `io.swagger.core.v3:swagger-core:2.2.20` — JSON/YAML serialization
- `io.swagger.parser.v3:swagger-parser:2.1.21` — spec import/parsing
- `com.h2database:h2` — in-memory DB
- `org.projectlombok:lombok`

**Frontend**
- `react` 18, `react-router-dom` 6, `axios`
- `swagger-ui-react` 5 — embedded Swagger UI (renders Markdown in descriptions)
- `tailwindcss` 3, `vite` 5

**Runtime** (verified 2026-06-13)
- Java: OpenJDK 21.0.10 (Microsoft build) — `/usr/bin/java`
- Maven: 3.9.9 — `~/.m2/wrapper/dists/apache-maven-3.9.9-bin/.../bin/mvn`
- Node.js: 26.3.0 — `/opt/homebrew/bin/node`
- npm: 11.16.0 — `/opt/homebrew/bin/npm`

---

## Known issues / gotchas

- **`mvn` not in PATH** — используй полный путь (см. Dev commands выше). Причина: Maven установлен только через `.m2/wrapper`, не через Homebrew.
- **`npm`/`node` не в PATH в шелле Claude** — использовать `/opt/homebrew/bin/npm` и `/opt/homebrew/bin/node`.
- **`"type": "module"` в `package.json`** — добавлено, чтобы убрать предупреждение Node о `postcss.config.js`. Уже присутствует в файле.
- **H2 данные сбрасываются** при каждом рестарте бэкенда (`create-drop`). Для persistence — см. раздел H2 console ниже.
- **Vite CJS deprecation warning** — косметическое, на работу не влияет (Vite 5 + Node 26).

---

## H2 console

Available at `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:mem:swaggerdb`
- User: `sa`, Password: _(empty)_

Data resets on every backend restart (DDL mode: `create-drop`).
To persist data across restarts, change `application.properties`:
```properties
spring.datasource.url=jdbc:h2:file:./data/swaggerdb
spring.jpa.hibernate.ddl-auto=update
```
