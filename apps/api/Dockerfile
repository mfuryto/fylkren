FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props global.json ./
COPY apps/api/Fylkren.Api.csproj apps/api/
RUN dotnet restore apps/api/Fylkren.Api.csproj
COPY assets/branding/fylkren-logo-web-256.png assets/branding/fylkren-logo-web-256.png
COPY apps/api/ apps/api/
RUN dotnet publish apps/api/Fylkren.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends curl libgssapi-krb5-2 libldap2 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/fylkren/keys \
    && chown -R "$APP_UID:$APP_UID" /var/lib/fylkren \
    && chmod 700 /var/lib/fylkren/keys
COPY --from=build /app ./
USER $APP_UID
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail --silent --show-error http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["dotnet", "Fylkren.Api.dll"]
