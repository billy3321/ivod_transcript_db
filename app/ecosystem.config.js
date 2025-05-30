module.exports = {
  apps: [{
    name: 'ivod-app',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/ivod_transcript_db/app',
    instances: 'max', // 使用所有 CPU 核心
    exec_mode: 'cluster', // 叢集模式
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '/home/ubuntu/ivod_transcript_db/app/.env',
    error_file: '/var/log/pm2/ivod-app-error.log',
    out_file: '/var/log/pm2/ivod-app-out.log',
    log_file: '/var/log/pm2/ivod-app.log',
    time: true,
    // 自動重啟設定
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // 優雅關閉
    kill_timeout: 5000,
    // 健康檢查
    health_check_url: 'http://localhost:3000/api/health',
    health_check_grace_period: 3000,
    // 日誌設定
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // 進程監控
    monitoring: true,
    // 記憶體監控
    max_memory_restart: '1G',
    // CPU 監控
    listen_timeout: 3000,
    // 忽略的監控項目
    ignore_watch: [
      'node_modules',
      '.next',
      'logs',
      'cypress'
    ]
  }]
};