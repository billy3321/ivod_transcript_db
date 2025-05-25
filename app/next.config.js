if (process.env.NODE_ENV === 'development') {
  const backend = process.env.DB_BACKEND;
  if (backend === 'sqlite') {
    console.log(
      `使用資料庫: SQLite，檔案路徑: ${process.env.SQLITE_PATH || process.env.DATABASE_URL}`
    );
  } else if (backend) {
    console.log(
      `使用資料庫: ${backend}，連線 URL: ${process.env.DATABASE_URL}`
    );
  } else if (process.env.DATABASE_URL) {
    console.log(
      `使用資料庫連線字串: ${process.env.DATABASE_URL}`
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;