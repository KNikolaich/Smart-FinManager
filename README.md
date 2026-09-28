# Финансист AI New

Индивидуальный менеджер финансов с использованием ИИ для отслеживания транзакций, планирования бюджета и постановки финансовых целей.

## Быстрый старт с Docker

Для развертывания проекта в один клик убедитесь, что у вас установлены [Docker](https://docs.docker.com/get-docker/) и [Docker Compose](https://docs.docker.com/compose/install/).

### 1. Подготовка переменных окружения

Создайте файл `.env` в корневом каталоге проекта и заполните его необходимыми значениями (см. `.env.example`):

```env
# Домен, A-запись которого указывает на IP сервера (для локального запуска: localhost)
DOMAIN=fin.example.com
# Встроенный Caddy с HTTPS (нужны свободные порты 80/443). Оставьте пустым,
# если на сервере уже есть свой обратный прокси — тогда он должен проксировать на 127.0.0.1:3000
COMPOSE_PROFILES=caddy
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=finance_db
JWT_SECRET=your_secure_random_secret
# Ровно 32 символа (ключ AES-256), например: openssl rand -hex 16
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
# Необязательно: ключ для AI-ассистента
DEEPSEEK_API_KEY=your_deepseek_api_key
```

`JWT_SECRET` и `ENCRYPTION_KEY` обязательны — без них compose не запустится.

На сервере должны быть открыты порты `80` и `443`: через них Caddy получает сертификат Let's Encrypt и отдаёт сайт по HTTPS.

### 2. Запуск приложения

Выполните следующую команду в терминале:

```bash
docker compose up -d --build
```

Эта команда:
1. Выполнит сборку Docker-образа приложения.
2. Поднимет контейнер с базой данных PostgreSQL.
3. Применит все миграции базы данных через Prisma.
4. Скомпилирует фронтенд и запустит сервер.
5. Если `COMPOSE_PROFILES=caddy` — поднимет Caddy, обратный прокси с автоматическим HTTPS на портах `80`/`443`.

Приложение публикуется только на `127.0.0.1:3000` (порт меняется через `APP_PORT`) и снаружи напрямую недоступно.

### 3. Доступ к приложению

После успешного запуска приложение будет доступно по адресу `https://<DOMAIN>`.

### Смена домена

1. Направьте A-запись нового домена на IP сервера.
2. Измените `DOMAIN` в `.env`.
3. Перезапустите Caddy: `docker compose up -d caddy` — новый сертификат будет получен автоматически.

## Основные команды Docker

- **Остановить контейнеры:**
  ```bash
  docker compose down
  ```

- **Просмотр логов:**
  ```bash
  docker compose logs -f app
  ```

- **Перезагрузка контейнеров:**
  ```bash
  docker compose restart
  ```

## Разработка без Docker

Если вы хотите запустить проект локально для разработки (нужны Node.js 20+ и PostgreSQL):

1. **Установите зависимости:**
   ```bash
   npm install
   ```

2. **Настройте окружение:**
   Скопируйте `.env.example` в `.env` и заполните как минимум `DATABASE_URL`, `JWT_SECRET` и `ENCRYPTION_KEY` (ровно 32 символа).

3. **Примените миграции базы данных:**
   ```bash
   npx prisma migrate deploy
   ```

4. **Запустите сервер в режиме разработки** (Vite с горячей перезагрузкой):
   ```bash
   npm run dev
   ```
   Приложение будет доступно по адресу [http://localhost:5000](http://localhost:5000). Порт можно изменить переменной `PORT`.

### Production-запуск без Docker

```bash
npm run build
# NODE_ENV=production в .env (или в окружении)
npm start
```

## Технологический стек

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide icons.
- **Backend:** Node.js (Express), Prisma ORM.
- **AI:** Google Gemini API.
- **Database:** PostgreSQL.
- **Deployment:** Docker, Docker Compose.
