module.exports = {
  apps: [
    {
      name: 'antigravity-wechat-bridge',
      script: './node_modules/tsx/dist/cli.mjs',
      args: 'scripts/start-live-wechat.ts',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
