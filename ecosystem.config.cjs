module.exports = {
  apps: [
    {
      name: "xiaomaolaile-backend",
      script: "backend/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: 8787
      }
    }
  ]
};
