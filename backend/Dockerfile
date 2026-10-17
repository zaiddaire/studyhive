# Multi-stage build: compile with Maven, then run on a slim JRE as a non-root user.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package \
 && java -Djarmode=tools -jar target/studyhive-api.jar extract --destination /extracted

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S studyhive && adduser -S studyhive -G studyhive
WORKDIR /app
COPY --from=build /extracted/ ./

# Tuned for free-tier containers (512 MB, a fraction of a CPU): bounded heap, small thread stacks, serial GC,
# quick JIT start-up. Override JAVA_OPTS on larger plans if desired.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=65 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1 -XX:+ExitOnOutOfMemoryError -Dspring.jmx.enabled=false"

# Class Data Sharing: a training start-up records the loaded classes into app.jsa so every real start (including
# waking from sleep on free hosting) loads them much faster. The training run needs no database: Flyway and JDBC
# metadata access are switched off and the context stops as soon as it has refreshed.
RUN java $JAVA_OPTS -XX:ArchiveClassesAtExit=app.jsa \
      -Dspring.context.exit=onRefresh \
      -Dspring.flyway.enabled=false \
      -Dspring.jpa.hibernate.ddl-auto=none \
      -Dspring.jpa.database-platform=org.hibernate.dialect.MySQLDialect \
      -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
      -jar studyhive-api.jar \
 && chown -R studyhive:studyhive /app

USER studyhive
EXPOSE 8080
# The platform provides PORT (Render, Railway); Spring Boot reads it via server.port=${PORT:8080}.
# If the archive ever doesn't match, the JVM simply starts without it.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -XX:SharedArchiveFile=app.jsa -jar studyhive-api.jar"]
