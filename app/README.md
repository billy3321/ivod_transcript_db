# IVOD Transcripts Web Application (app)

## 1. Overview

This Next.js web application provides a user interface for browsing and searching IVOD transcripts:

- **Paginated list** of IVOD records showing date, meeting name, committee, speakers, and duration.
- **Search form** to filter by meeting name, committee, speaker, and full-text transcript (powered by Elasticsearch).
- **Detail pages** for each IVOD record with transcript display and expansion controls for long texts.

## 2. Technology Stack

- [Next.js](https://nextjs.org/) with React and TypeScript
- Node.js API routes for server-side data fetching
- [Prisma](https://www.prisma.io/) ORM for relational database (PostgreSQL / MySQL / SQLite)
- [Elasticsearch](https://www.elastic.co/) for full-text transcript search
- [bodybuilder](https://github.com/moscajs/bodybuilder) for building Elasticsearch query DSL
- [Searchkit](https://www.searchkit.co/) (optional) for building React search UIs with Elasticsearch
- [Tailwind CSS](https://tailwindcss.com/) (optional) for styling
- [React Query](https://react-query.tanstack.com/) (optional) for data fetching and caching

## 3. Architecture

The application structure and main routes/components:

```plain
app/
├── pages/
│   ├── index.tsx              # IVOD list + search page
│   ├── ivod/[id].tsx          # IVOD detail page
│   └── api/
│       ├── ivods.ts           # GET: list & filter IVODs with pagination
│       ├── ivods/[id].ts      # GET: fetch IVOD metadata and transcripts by ID
│       └── search.ts          # GET: full-text transcript search (fallback to DB if ES unavailable)
├── components/                # React UI components (List, SearchForm, Card, TranscriptViewer, etc.)
├── lib/
│   ├── db.ts                  # Database client setup
│   └── elastic.ts             # Elasticsearch client setup
└── public/
    └── ...                    # Static assets
```

## 4. UI/UX Design Guidelines

To ensure a responsive, modern, and user-friendly interface, follow these guidelines:

### 4.1 Design Principles

- Mobile-first, responsive layout using CSS Grid or Flexbox.
- Card-based or table-based list views with clear typography and spacing.
- Consistent color palette and typography; consider Tailwind CSS default or a custom theme.
- Intuitive search and pagination controls, with accessible form elements.
- Dark mode support (optional) via CSS variables or Tailwind's dark mode.

### 4.2 Layout and Components

| Page            | Desktop View                             | Mobile View                                           |
|-----------------|------------------------------------------|-------------------------------------------------------|
| IVOD List       | Table with columns: Date, Meeting, etc.  | Stacked cards showing same fields with icons/actions. |
| Search Form     | Horizontal filters and search input     | Collapsible accordion for filters, prominent search.  |
| Pagination      | Footer pagination links                  | Infinite scroll or simplified next/prev buttons.      |
| IVOD Detail     | Transcript viewer alongside metadata panel | Full-width metadata above collapsible transcript.     |

- Use Tailwind CSS utility classes to implement breakpoints (`sm`, `md`, `lg`, `xl`).
- Employ React components for List, Card, SearchForm, Pagination, and TranscriptViewer.
- Leverage SVG icons (e.g., Heroicons) for actions (search, clear, expand/collapse).

### 4.3 Styling Recommendations

- Color palette: Neutral grays, primary accent (#3B82F6), success (#10B981), warning (#FCD34D).
- Typography: Use system font stack or Google Fonts (e.g., Inter).
- Spacing: Use consistent padding (4/8/16px) and margin scale.

## 5. Environment Variables

Create a `.env.local` file in the `app/` directory based on `.env.example` and fill in your values:

```ini
# Database provider: one of 'postgresql', 'mysql', 'sqlite'
DB_PROVIDER="postgresql"

# Database connection to the IVOD metadata database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
# For MySQL: mysql://user:pass@host:3306/dbname
# For SQLite (file path to shared DB file; use sqlite:/// prefix): sqlite:///../db/ivod_local.db

# Elasticsearch connection settings
ES_HOST="localhost"
ES_PORT="9200"
ES_SCHEME="http"
# ES_USER="username"
# ES_PASS="password"
ES_INDEX="ivod_transcripts"

# (Optional) expose index name to browser
NEXT_PUBLIC_ES_INDEX="ivod_transcripts"
```

## 6. Local Development

```bash
cd app
npm install
cp .env.example .env.local
# (若使用 SQLite) 建立共享 DB 資料夾：mkdir -p ../db
# Edit .env.local to configure DATABASE_URL, DB_PROVIDER, and Elasticsearch settings
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000 to view the application.

## 7. Build and Production Deployment

```bash
cd app
npm run build
npm start
```


Alternatively, deploy to [Vercel](https://vercel.com/):

1. Push the `app/` directory to a Git repository.
2. Import the project in the Vercel dashboard.
3. Set the environment variables in Vercel settings.
4. Deploy.

## 8. Docker (Optional)

A sample `Dockerfile` for containerized deployment:

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t ivod-app .
docker run -p 3000:3000 \
  -e DATABASE_URL=... \
  -e ES_HOST=... \
  -e ES_PORT=... \
  -e ES_SCHEME=... \
  -e ES_INDEX=... \
  ivod-app
```
## 9. Production Deployment on Ubuntu Linux with Nginx

Follow these steps to set up a stable production environment on an Ubuntu server using nginx as a reverse proxy.

### 9.1 Prerequisites

- An Ubuntu (20.04+) server with sudo access.
- A domain name pointing to your server.
- Node.js (v16+) and npm.
- nginx installed.
- Optional: Certbot for SSL (Let's Encrypt).

### 9.2 Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y nodejs build-essential
```

### 9.3 Clone, Configure and Build

```bash
# Clone the repository and navigate to the app directory
git clone https://github.com/yourorg/ivod_transcript_db.git
cd ivod_transcript_db/app

# Copy and edit environment variables
cp .env.example .env.local
# Edit .env.local and fill in DATABASE_URL, ES_HOST, ES_PORT, ES_SCHEME, ES_INDEX, etc.

npm install --production
npm run build
```

### 9.4 Run as a systemd Service

Create a systemd service file `/etc/systemd/system/ivod-app.service`:

```ini
[Unit]
Description=IVOD Transcripts Next.js App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/ubuntu/ivod_transcript_db/app
ExecStart=/usr/bin/npm start
Environment=NODE_ENV=production
Environment=DATABASE_URL=<your_database_url>
Environment=ES_HOST=<your_es_host>
Environment=ES_PORT=<your_es_port>
Environment=ES_SCHEME=<your_es_scheme>
Environment=ES_INDEX=<your_es_index>
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ivod-app
sudo systemctl start ivod-app
```

### 9.5 Configure nginx

Create an nginx site file `/etc/nginx/sites-available/ivod-app`:

```nginx
server {
    listen 80;
    server_name your.domain.com;

    location /_next/static/ {
        alias /home/ubuntu/ivod_transcript_db/app/.next/static/;
        expires max;
        add_header Cache-Control public;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ivod-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo ufw allow 'Nginx Full'
```

### 9.6 (Optional) SSL with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com
```

## 10. Testing

Implement automated tests to ensure code quality and prevent regressions. Follow these best practices:

### 10.1 Unit Testing with Jest and React Testing Library

- Use Jest and React Testing Library for unit tests of React components, utility functions, and API route handlers.
- Organize tests under the `__tests__` directory at the project root (`app/__tests__`).
  Write tests for API routes (e.g., `search-api.test.ts`) mocking Elasticsearch and Prisma clients to verify fallback logic.

Example scripts in `package.json`:

```json
"scripts": {
  "test": "jest --passWithNoTests --watch",
  "test:ci": "jest --runInBand --passWithNoTests",
  "cypress:open": "cypress open",
  "cypress:run": "cypress run"
},
"devDependencies": {
  "jest": "^29.4.3",
  "ts-jest": "^29.0.5",
  "@testing-library/react": "^13.4.0",
  "@testing-library/jest-dom": "^5.16.5",
  "cypress": "^14.4.0"
}
```

### 10.2 End-to-End Testing

- Use Cypress for E2E tests to cover critical user flows.
- Place specs in `cypress/integration/`.
- Configure `cypress.json` and add scripts:

```json
"scripts": {
  "cypress:open": "cypress open",
  "cypress:run": "cypress run"
},
"devDependencies": {
  "cypress": "^14.4.0"
}
```

### 10.3 Running Tests

```bash
# Install dependencies
npm install

# Run unit tests (Jest)
npm run test

# Run E2E tests (Cypress interactive)
npm run cypress:open

# Run E2E tests headless (CI)
npm run cypress:run
```