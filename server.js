const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const pendingMessages = [];

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                fs.readFile('./index.html', (err, content) => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('🟢 Nuevo cliente conectado');

    pendingMessages.forEach(msg => {
        ws.send(JSON.stringify(msg));
    });

    ws.on('message', (message) => {
        try {
            const messageData = JSON.parse(message.toString());

            if (messageData.type === 'read-confirmation') {
                const index = pendingMessages.findIndex(m => m.id === messageData.id);
                if (index !== -1) {
                    pendingMessages.splice(index, 1);
                    console.log(`✅ Mensaje ${messageData.id} eliminado tras confirmación`);
                }
                return;
            }

            pendingMessages.push(messageData);

            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(messageData));
                }
            });
        } catch (error) {
            console.error('❌ Error al procesar mensaje:', error);
        }
    });

    ws.on('close', () => {
        console.log('🔴 Cliente desconectado');
    });

    ws.on('error', (error) => {
        console.error('❌ Error en conexión WebSocket:', error);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log('📡 Servidor WebSocket escuchando en el mismo puerto');
});
