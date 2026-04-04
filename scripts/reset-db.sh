#!/usr/bin/env bash
set -e

echo "→ Wiping database..."
npx dotenv -e .env -- psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || \
  node -e "
    require('dotenv').config();
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      .then(() => { console.log('Schema wiped.'); pool.end(); })
      .catch(e => { console.error(e); pool.end(); process.exit(1); });
  "

echo "→ Running prisma db push..."
npx prisma db push

echo "→ Running prisma generate..."
npx prisma generate

echo "✓ Done."
