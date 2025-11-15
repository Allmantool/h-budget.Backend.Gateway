# === Base runtime image (.NET 10 ASP.NET) ===
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443
EXPOSE 7298

# === Build stage (.NET 10 SDK) ===
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /scr

# Copy shared runtime files — same behavior as your original
COPY --from=mcr.microsoft.com/dotnet/sdk:10.0 /usr/share/dotnet/shared /usr/share/dotnet/shared

# === Build arguments ===
ARG BUILD_VERSION
ENV BUILD_VERSION=${BUILD_VERSION}

# === Install dependencies (cached) ===
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && \
    apt-get install -y --quiet --no-install-recommends \
    apt-transport-https && \
    apt-get -y autoremove && \
    apt-get clean autoclean

# === Install Java 21 ===
RUN wget https://download.oracle.com/java/21/latest/jdk-21_linux-x64_bin.tar.gz -O jdk-21_linux-x64_bin.tar.gz
RUN mkdir -p /usr/lib/jvm && \
    tar -xvf jdk-21_linux-x64_bin.tar.gz -C /usr/lib/jvm

RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && \
    apt-get install -f -y --quiet --no-install-recommends \
    ant ca-certificates-java && \
    apt-get -y autoremove && \
    apt-get clean autoclean

# === Fix certs ===
RUN update-ca-certificates -f

ENV JAVA_HOME=/usr/lib/jvm/jdk-21.0.1
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# === .NET tools ===
RUN dotnet new tool-manifest

# Snitch now compatible with .NET 10
RUN dotnet tool install snitch --tool-path /tools --version 2.0.0
RUN dotnet tool restore

ENV PATH="$PATH:/root/.dotnet/tools:/tools"

# === Copy projects ===
COPY ["HomeBudget.Core/*.csproj",                 "HomeBudget.Core/"]
COPY ["HomeBudget.Backend.Gateway/*.csproj",      "HomeBudget.Backend.Gateway.Api/"]
COPY ["HomeBudgetBackendGateway.sln",             "HomeBudgetBackendGateway.sln"]
COPY ["startsonar.sh",                            "startsonar.sh"]

COPY . .

# === Build solution ===
RUN dotnet build HomeBudgetBackendGateway.sln \
    -c Release \
    --no-incremental \
    --framework net10.0 \
    -maxcpucount:1 \
    -o /app/build

# === Snitch analysis ===
RUN /tools/snitch

# === Publish ===
FROM build AS publish
RUN dotnet publish HomeBudgetBackendGateway.sln \
    --no-dependencies \
    --no-restore \
    --framework net10.0 \
    -c Release \
    -v Diagnostic \
    -o /app/publish

# === Final runtime image ===
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "HomeBudget.Backend.Gateway.Api.dll"]
