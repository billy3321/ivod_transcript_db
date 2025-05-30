import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config();
const backend = process.env.DB_BACKEND;
if (backend) {
  if (backend === 'sqlite') {
    const sqlitePath = process.env.SQLITE_PATH || '../db/ivod_test.db';
    process.env.DATABASE_URL = `file://${resolve(sqlitePath)}`;
  } else if (backend === 'postgresql') {
    const { PG_USER, PG_PASS, PG_HOST, PG_PORT, PG_DB } = process.env;
    process.env.DATABASE_URL = `${backend}://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
  } else if (backend === 'mysql') {
    const { MYSQL_USER, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT, MYSQL_DB } = process.env;
    process.env.DATABASE_URL = `mysql://${MYSQL_USER}:${MYSQL_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}`;
  }
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export default prisma;