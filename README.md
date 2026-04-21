# Финансист AI New

Индивидуальный менеджер финансов с использованием ИИ для отслеживания транзакций, планирования бюджета и постановки финансовых целей.

## Быстрый старт с Docker

Для развертывания проекта в один клик убедитесь, что у вас установлены [Docker](https://docs.docker.com/get-docker/) и [Docker Compose](https://docs.docker.com/compose/install/).

### 1. Подготовка переменных окружения

Создайте файл `.env` в корневом каталоге проекта и заполните его необходимыми значениями (см. `.env.example`):

```env
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=finance_db
JWT_SECRET=your_secure_random_secret
DEEPSEEK_API_KEY=your_deepseek_api_key
```

### 2. Запуск приложения

Выполните следующую команду в терминале:

```bash
docker compose up -d --build
```

Эта команда:
1. Выполнит сборку Docker-образа приложения.
2. Поднимет контейнер с базой данных PostgreSQL.
3. Применит все миграции базы данных через Prisma.
4. Скомпилирует фронтенд и запустит сервер на порту `3000`.

### 3. Доступ к приложению

После успешного запуска приложение будет доступно по адресу:
[http://localhost:3000](http://localhost:3000)

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

Если вы хотите запустить проект локально для разработки:

1. **Установите зависимости:**
   ```bash
   npm install
   ```

2. **Настройте базу данных:**
   Укажите `DATABASE_URL` в `.env` и примените миграции:
   ```bash
   npx prisma migrate dev
   ```

3. **Запустите сервер:**
   ```bash
   npm run dev
   ```

## Технологический стек

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide icons.
- **Backend:** Node.js (Express), Prisma ORM.
- **AI:** Google Gemini API.
- **Database:** PostgreSQL.
- **Deployment:** Docker, Docker Compose.
