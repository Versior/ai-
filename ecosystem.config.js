module.exports = {
  apps: [
    {
      name: 'versior-backend',
      script: 'node src/server.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'versior-frontend',
      script: 'npm run dev',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '1G',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ]
};