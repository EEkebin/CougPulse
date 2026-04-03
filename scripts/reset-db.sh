#!/usr/bin/env bash
set -e

echo "Wiping database..."
npx prisma migrate reset --force --skip-seed

echo "Pushing schema..."
npx prisma db push

echo "Generating client..."
npx prisma generate

echo "Done."
