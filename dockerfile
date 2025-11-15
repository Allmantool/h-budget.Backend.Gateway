# syntax=docker/dockerfile:1.4
###############################################################################
# Build image (contains SDK + Java + Snitch)
###############################################################################
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

ARG BUILD_VERSION
LABEL build_version="${BUILD_VERSION}"

# Install Java 21 ONLY for build stage
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && \
    apt-get install -y --no-install-recommends wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ARG JAVA_URL="https://download.oracle.com/java/21/latest/jdk-21_linux-x64_bin.tar.gz"
ARG JAVA_DIR="/usr/lib/jvm/jdk-21"
RUN wget -q "${JAVA_URL}" -O /tmp/jdk.tar.gz && \
    mkdir -p ${JAVA_DIR} && \
    tar -xzf /tmp/jdk.tar.gz -C ${JAVA_DIR} --strip-components=1 && \
    rm /tmp/jdk.tar.gz

ENV JAVA_HOME=/usr/lib/jvm/jdk-21
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Copy csproj files for faster caching of restore
COPY HomeBudget.Core/*.csproj HomeBudget.Core/
COPY HomeBudget.Backend.Gateway/*.csproj HomeBudget.Backend.Gateway/
COPY HomeBudgetBackendGateway.sln ./

# Restore with caching
RUN --mount=type=cache,target=/root/.nuget/packages \
    dotnet restore HomeBudgetBackendGateway.sln

# Copy all source code
COPY . .

###############################################################################
# Optional: SNITCH stage (dependency analyzer)
###############################################################################
FROM build AS snitch
# Snitch currently supports up to .NET 8 (but runs fine in SDK 10)
RUN dotnet tool install snitch --tool-path /tools --version 2.0.0
RUN /tools/snitch --directory /src || echo "Snitch finished with warnings."

###############################################################################
# Publish stage (self-contained)
###############################################################################
FROM build AS publish

# Self-contained build:
# No .NET runtime required in final image
RUN dotnet publish HomeBudgetBackendGateway.sln \
    -c Release \
    -f net10.0 \
    -r linux-x64 \
    --self-contained true \
    /p:PublishSingleFile=true \
    /p:PublishTrimmed=false \
    -o /app/publish

###############################################################################
# Final small runtime image
###############################################################################
FROM debian:bookworm-slim AS final

WORKDIR /app

# Add your app
COPY --from=publish /app/publish .

# Mark executable
RUN chmod +x /app/HomeBudget.Backend.Gateway

# Healthcheck (optional)
HEALTHCHECK --interval=30s --timeout=5s \
    CMD pgrep HomeBudget.Backend.Gateway || exit 1

EXPOSE 80
EXPOSE 443
EXPOSE 7298

ENTRYPOINT ["/app/HomeBudget.Backend.Gateway"]
