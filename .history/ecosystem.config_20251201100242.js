/**
 * PM2 Ecosystem Configuration
 * 
 * File này giúp quản lý nhiều Node.js processes với PM2
 * 
 * Cách dùng:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 restart ecosystem.config.js
 *   pm2 reload ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 delete ecosystem.config.js
 */

module.exports = {
  apps: [
    // ==================== BACKEND SERVER ====================
    {
      name: 'shop-backend',
      script: './server_node/server.js',
      cwd: './server_node',
      
      // Số instances (2 instances = load balancing)
      instances: 2,
      
      // Chế độ cluster (chia tải giữa các instance)
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      
      // Logging
      error_file: './logs/backend-err.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart
      autorestart: true,
      watch: false, // Tắt watch trong production (tránh restart khi file thay đổi)
      max_memory_restart: '1G', // Tự động restart nếu dùng quá 1GB RAM
      
      // Restart policy
      min_uptime: '10s', // Phải chạy ít nhất 10s mới tính là stable
      max_restarts: 10, // Tối đa 10 lần restart trong min_uptime
      
      // Node.js options
      node_args: '--max-old-space-size=2048', // Tăng memory limit lên 2GB
      
      // Ignore watch files
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git',
      ],
    },
    
    // ==================== FRONTEND SERVER (Next.js) ====================
    {
      name: 'shop-frontend',
      script: 'npm',
      args: 'start',
      cwd: './',
      
      // Chỉ cần 1 instance cho Next.js (Next.js tự xử lý load balancing)
      instances: 1,
      exec_mode: 'fork',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // Logging
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Restart policy
      min_uptime: '10s',
      max_restarts: 10,
      
      // Node.js options
      node_args: '--max-old-space-size=2048',
      
      // Ignore watch files
      ignore_watch: [
        'node_modules',
        '.next',
        'logs',
        '*.log',
        '.git',
      ],
    },
  ],
  
  // ==================== DEPLOYMENT CONFIG ====================
  // Có thể dùng cho PM2 deploy feature (nâng cao)
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/var/www/shopnoithat',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
};


