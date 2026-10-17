# Multi-stage build: compile with Maven, run on a slim JRE as a non-root user.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S studyhive && adduser -S studyhive -G studyhive
WORKDIR /app
COPY --from=build /build/target/studyhive-api.jar app.jar
USER studyhive
# Tuned to fit free-tier containers (512 MB): bounded heap, small thread stacks, serial GC, and a quicker
# JIT start-up so a sleeping free instance wakes faster. Override JAVA_OPTS on larger plans if desired.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=65 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1 -XX:+ExitOnOutOfMemoryError -Dspring.jmx.enabled=false"
EXPOSE 8080
# The platform provides PORT (Render, Railway); Spring Boot reads it via server.port=${PORT:8080}.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
