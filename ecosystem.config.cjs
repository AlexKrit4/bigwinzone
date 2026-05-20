module.exports = {
  apps: [
    {
      name: "books-server",
      script: "books-server.js",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
    },
    {
      name: "rave-casino",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
