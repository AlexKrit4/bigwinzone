module.exports = {
  apps: [
    {
      name: "xboot-books-server",
      script: "xboot-books-server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        XBOOT_BOOKS_PORT: 3848,
      },
    },
    {
      name: "rave-casino",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
