# Catclic — Backend (NestJS)

Serwer API oparty na [NestJS](https://nestjs.com/), odpowiedzialny za analizę meczów z użyciem **Google Gemini AI**.

## Endpointy

| Metoda | Ścieżka | Opis |
|:------:|:--------|:-----|
| `POST` | `/predict` | Analiza pojedynczego meczu (teamA vs teamB) — zwraca predykcję, podsumowanie i statystyki radarowe |
| `POST` | `/predict/rank` | Ranking najlepszych zakładów spośród podanej listy meczów |

## Uruchomienie

### 1. Zainstaluj zależności
```bash
npm install
```

### 2. Skonfiguruj zmienne środowiskowe
Skopiuj plik `.env.example` i uzupełnij swój klucz API:
```bash
cp .env.example .env
```

Wymagane zmienne:
| Zmienna | Opis |
|:--------|:-----|
| `GEMINI_API_KEY` | Klucz API do Google Gemini |
| `PORT` | Port serwera (domyślnie `3000`) |

### 3. Uruchom serwer
```bash
# Tryb deweloperski (hot-reload)
npm run start:dev

# Produkcja
npm run build
npm run start:prod
```

## Technologie

- **NestJS** — framework backendowy
- **Google Generative AI SDK** — integracja z Gemini
- **ConfigModule** — bezpieczne zarządzanie zmiennymi środowiskowymi
