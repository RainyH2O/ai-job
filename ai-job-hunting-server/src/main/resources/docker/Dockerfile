FROM maven:3.10.2-eclipse-temurin-21 AS build
WORKDIR /build/

COPY pom.xml ./
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp -DskipTests package

FROM hengyunabc/arthas:4.0.4 AS arthas

FROM eclipse-temurin:21-jdk
WORKDIR /app/

ENV ARTHAS_HOME=/opt/arthas
COPY --from=arthas /opt/arthas /opt/arthas
COPY --from=build /build/target/ai-job.jar /app/

# api端口
EXPOSE 9100

# 后台配置中心端口
EXPOSE 6768

ENTRYPOINT ["java", "-XX:+StartAttachListener", "-jar"]
CMD ["/app/ai-job.jar"]