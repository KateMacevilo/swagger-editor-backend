# Build the production JAR first:
#   cd frontend && npm run build && cp -r dist/* ../src/main/resources/static/
#   cd .. && mvn -f pom.xml package -DskipTests
FROM eclipse-temurin:21-jre

WORKDIR /app

# Optional corporate CA certificates: put *.crt files into certs/ before building
# (see Dockerfile.full for details). Fixes PKIX/SSLHandshake errors against
# GitLab behind an internal CA.
COPY certs /tmp/certs
RUN for f in /tmp/certs/*.crt; do \
      [ -e "$f" ] || continue; \
      keytool -importcert -trustcacerts -cacerts -storepass changeit -noprompt \
        -alias "$(basename "$f" .crt)" -file "$f"; \
    done

COPY target/swagger-editor-backend-1.0.0.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
