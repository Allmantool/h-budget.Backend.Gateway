FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 80 443 7298

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

ARG BUILD_VERSION
ENV BUILD_VERSION=${BUILD_VERSION}

COPY HomeBudgetBackendGateway.sln ./
COPY HomeBudget.Core/*.csproj HomeBudget.Core/
COPY HomeBudget.Backend.Gateway/*.csproj HomeBudget.Backend.Gateway/

RUN dotnet restore

# === Install system dependencies + Java 21 ===
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && \
    apt-get install -y --no-install-recommends wget ant ca-certificates-java && \
    apt-get clean autoclean && \
    rm -rf /var/lib/apt/lists/*

# Download & extract Java 21
RUN wget https://download.oracle.com/java/21/latest/jdk-21_linux-x64_bin.tar.gz -O /tmp/jdk-21_linux-x64_bin.tar.gz && \
    mkdir -p /usr/lib/jvm && \
    tar -xzf /tmp/jdk-21_linux-x64_bin.tar.gz -C /usr/lib/jvm && \
    rm /tmp/jdk-21_linux-x64_bin.tar.gz

ENV JAVA_HOME=/usr/lib/jvm/jdk-21.0.1
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# === Install Snitch tool ===
RUN dotnet new tool-manifest
RUN dotnet tool install snitch --tool-path /tools --version 2.0.0
ENV PATH="$PATH:/root/.dotnet/tools:/tools"

COPY . .

RUN dotnet build HomeBudgetBackendGateway.sln \
    -c Release \
    -f net10.0 \
    -o /app/build \
    /maxcpucount:1 \
    --no-incremental

# === Run Snitch analysis ===
RUN /tools/snitch

RUN dotnet publish HomeBudgetBackendGateway.sln \
    -c Release \
    -f net10.0 \
    -o /app/publish \
    /p:StaticWebAssetsUseLegacyCache=false \
    /p:StaticWebAssetsSkipManifestGeneration=false

FROM base AS final
WORKDIR /app

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "HomeBudget.Backend.Gateway.dll"]
