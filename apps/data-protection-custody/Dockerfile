FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props global.json ./
COPY apps/api/Fylkren.Api.csproj apps/api/
COPY apps/data-protection-custody-core/Fylkren.DataProtectionCustody.Core.csproj apps/data-protection-custody-core/
COPY tools/data-protection-custody/Fylkren.DataProtectionCustody.csproj tools/data-protection-custody/
RUN case "$TARGETARCH" in amd64) rid=linux-musl-x64 ;; arm64) rid=linux-musl-arm64 ;; *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; esac \
    && dotnet restore tools/data-protection-custody/Fylkren.DataProtectionCustody.csproj -r "$rid"
COPY assets/branding/fylkren-logo-web-256.png assets/branding/fylkren-logo-web-256.png
COPY apps/api/ apps/api/
COPY apps/data-protection-custody-core/ apps/data-protection-custody-core/
COPY tools/data-protection-custody/ tools/data-protection-custody/
RUN case "$TARGETARCH" in amd64) rid=linux-musl-x64 ;; arm64) rid=linux-musl-arm64 ;; *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; esac \
    && dotnet publish tools/data-protection-custody/Fylkren.DataProtectionCustody.csproj -c Release -r "$rid" --self-contained false -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
WORKDIR /app
COPY --from=build /app ./
USER $APP_UID
ENTRYPOINT ["dotnet", "Fylkren.DataProtectionCustody.dll", "/var/lib/fylkren/keys", "/run/fylkren-data-protection/data-protection.crt", "/run/fylkren-data-protection/data-protection.key"]
