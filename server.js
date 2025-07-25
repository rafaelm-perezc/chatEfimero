const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
            if(error.code == 'ENOENT') {
                fs.readFile('./index.html', (err, content) => {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

// Almacenamiento simple de mensajes
let messages = [];

wss.on('connection', (ws) => {
    console.log('🟢 Nuevo cliente conectado');
    
    ws.on('message', (message) => {
        try {
            const messageData = JSON.parse(message.toString());
            
            switch (messageData.type) {
                case 'user-info':
                    ws.send(JSON.stringify({
                        type: 'user-info-ack'
                    }));
                    break;
                    
                case 'request-historical':
                    ws.send(JSON.stringify({
                        type: 'historical-messages',
                        messages: messages
                    }));
                    break;
                    
                case 'typing':
                case 'stop-typing':
                    // Broadcast a todos
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(message);
                        }
                    });
                    break;
                    
                case 'read-receipt':
                    console.log('📬 Acuse de lectura:', messageData.messageId, 'por', messageData.readerId);
                    // Broadcast a todos
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(message);
                        }
                    });
                    break;
                    
                case 'text':
                case 'image':
                    // Guardar y broadcast
                    messages.push(messageData);
                    console.log('💾 Mensaje guardado:', messageData.id);
                    
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(message);
                        }
                    });
                    break;
            }
        } catch (error) {
            console.error('❌ Error:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🔴 Cliente desconectado');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor en http://0.0.0.0:${PORT}`);
});
