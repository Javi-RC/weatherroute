FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/WeatherRoute.slnx ./
COPY backend/Directory.Build.props ./
COPY backend/WeatherRoute.Domain/WeatherRoute.Domain.csproj backend/WeatherRoute.Domain/
COPY backend/WeatherRoute.Application/WeatherRoute.Application.csproj backend/WeatherRoute.Application/
COPY backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj backend/WeatherRoute.Infrastructure/
COPY backend/WeatherRoute.Api/WeatherRoute.Api.csproj backend/WeatherRoute.Api/
RUN dotnet restore backend/WeatherRoute.Api/WeatherRoute.Api.csproj
COPY backend/ /src/backend/
RUN dotnet publish backend/WeatherRoute.Api -c Release -o /app/out

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/out ./
EXPOSE 8080
ENTRYPOINT ["dotnet", "WeatherRoute.Api.dll"]