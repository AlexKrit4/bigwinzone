const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
    console.log(`📨 ${req.method} ${req.url}`);
    
    // Определяем путь к файлу
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    
    console.log(`📂 Ищу: ${filePath}`);
    
    // Предотвращаем выход за пределы директории
    const realPath = path.resolve(filePath);
    const baseDir = path.resolve(__dirname);
    
    if (!realPath.startsWith(baseDir)) {
        console.log(`❌ Доступ запрещен`);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access denied');
        return;
    }
    
    // Определяем тип контента
    const extname = path.extname(filePath).toLowerCase();
    let contentType = 'text/html';
    
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };
    
    contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Читаем и отправляем файл
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`❌ Файл не найден: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                console.log(`❌ Ошибка: ${err.message}`);
                res.writeHead(500);
                res.end('Server error', 'utf-8');
            }
        } else {
            console.log(`✅ Отправляю (${contentType}, ${content.length} байт)`);
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║            🚀 СЕРВЕР ЗАПУЩЕН И ГОТОВ!                     ║
╚════════════════════════════════════════════════════════════╝

🌐 Откройте в браузере:
   → http://localhost:${PORT}
   → http://127.0.0.1:${PORT}

📁 Директория: ${__dirname}

✅ Доступны файлы:
   • index.html
   • slot.js
   • styles.css
   • books.json
   • images/
   • cite/

⏹️  Для остановки сервера нажмите Ctrl+C

════════════════════════════════════════════════════════════
    `);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Ошибка: Порт ${PORT} уже занят!`);
        process.exit(1);
    } else {
        console.error('❌ Ошибка сервера:', err);
        process.exit(1);
    }
});
