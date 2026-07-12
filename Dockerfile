# Build the production JAR first:
#   cd frontend && npm run build && cp -r dist/* ../src/main/resources/static/
#   cd .. && mvn -f pom.xml package -DskipTests
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

COPY target/swagger-editor-backend-1.0.0.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
