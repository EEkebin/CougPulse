import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    async adapter() {
      return new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }))
    },
  },
})
