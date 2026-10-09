FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props global.json ./
COPY apps/api/Fylkren.Api.csproj apps/api/
COPY apps/data-protection-custody-core/Fylkren.DataProtectionCustody.Core.csproj apps/data-protection-custody-core/
RUN case "$TARGETARCH" in amd64) rid=linux-x64 ;; arm64) rid=linux-arm64 ;; *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; esac \
    && dotnet restore apps/api/Fylkren.Api.csproj -r "$rid"
COPY assets/branding/fylkren-logo-web-256.png assets/branding/fylkren-logo-web-256.png
COPY apps/api/ apps/api/
COPY apps/data-protection-custody-core/ apps/data-protection-custody-core/
RUN case "$TARGETARCH" in amd64) rid=linux-x64 ;; arm64) rid=linux-arm64 ;; *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; esac \
    && dotnet publish apps/api/Fylkren.Api.csproj -c Release -r "$rid" --self-contained false -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-azurelinux3.0
WORKDIR /app
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
RUN tdnf upgrade -y \
    && tdnf install -y curl krb5-libs tzdata \
    && tdnf clean all \
    && mkdir -p /var/lib/fylkren/keys \
    && chown -R "$APP_UID:$APP_UID" /var/lib/fylkren \
    && chmod 700 /var/lib/fylkren/keys
COPY --from=build /app ./
USER $APP_UID
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail --silent --show-error http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["dotnet", "Fylkren.Api.dll"]
