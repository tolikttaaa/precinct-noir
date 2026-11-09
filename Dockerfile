# syntax=docker/dockerfile:1
# Precinct Noir: one image serving the React client, the HTTP API and WebSockets.
# Contract: docs/HOSTING.md §2 (linux/amd64, uid 1000, $SERVER_PORT, stdout logs, 768 MB).

# ---- 1. Web client (React + Vite) -------------------------------------------
FROM node:24-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY web/ ./
# The client imports the suspect roster from shared/, next to the engine that uses the same ids.
COPY shared/ ../shared/
RUN npm run build

# ---- 2. Server (Gradle on JDK 25) -------------------------------------------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle/ gradle/
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon --quiet --version
COPY shared/ shared/
COPY engine/ engine/
COPY server/ server/
COPY --from=web /src/web/dist web/dist
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon :server:bootJar -x test
# Split the fat jar into Spring Boot layers: dependencies change rarely, so deploys reuse them.
RUN java -Djarmode=tools -jar server/build/libs/app.jar extract --layers --destination /extracted

# ---- 3. Runtime (JRE 25, non-root) -------------------------------------------
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /extracted/dependencies/ ./
COPY --from=build /extracted/spring-boot-loader/ ./
COPY --from=build /extracted/snapshot-dependencies/ ./
COPY --from=build /extracted/application/ ./
# Which release this is, from the release workflow (docs/RUNBOOK.md §5); blank in every other build.
# Spring reads them as app.version and app.commit, and /api/config reports them.
ARG APP_VERSION=""
ARG APP_COMMIT=""
ENV APP_VERSION=${APP_VERSION} APP_COMMIT=${APP_COMMIT}
USER 1000:1000
EXPOSE 8080
# The JRE image has no curl/wget; bash's /dev/tcp is enough to probe the health endpoint.
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=3 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/${SERVER_PORT:-8080} && printf "GET /actuator/health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3 && grep -q "\"status\":\"UP\"" <&3'
ENTRYPOINT ["java", "-jar", "app.jar"]
