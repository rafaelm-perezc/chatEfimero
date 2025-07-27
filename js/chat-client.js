class ChatClient {
    constructor() {
        this.username = this.generateUsername();
        this.socket = null;
        this.isConnected = false;
        this.messageTimers = new Map();
        this.sentMessageIds = new Set();
        this.pendingImage = null;

        this.initializeElements();
        this.initializeSocket();
        this.setupEventListeners();
    }

    initializeElements() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageForm = document.getElementById('messageForm');
        this.messageInput = document.getElementById('messageInput');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.sendButton = document.getElementById('sendButton');
        this.imageInput = document.getElementById('imageInput');
    }

    generateUsername() {
        const adjectives = ['Rápido', 'Feliz', 'Listo', 'Genial', 'Único', 'Activo', 'Creativo', 'Dinámico'];
        const nouns = ['Usuario', 'Chat', 'Mensaje', 'Red', 'Local', 'Grupo', 'Equipo', 'Comunidad'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 1000);
        return `${adj}${noun}${num}`;
    }

    initializeSocket() {
        const serverIP = window.location.hostname;
        const serverPort = 3000;

        try {
            this.socket = new WebSocket(`ws://${serverIP}:${serverPort}`);
            this.setupWebSocketEvents();
        } catch (error) {
            console.error('Error al conectar al WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }

    setupWebSocketEvents() {
        this.socket.onopen = () => {
            console.log('✅ Conectado al servidor WebSocket');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            this.enableInputs();
        };

        this.socket.onmessage = (event) => {
            try {
                const messageData = JSON.parse(event.data);
                if (this.sentMessageIds.has(messageData.id)) {
                    this.sentMessageIds.delete(messageData.id);
                    return;
                }

                const isOwnMessage = messageData.username === this.username;
                messageData.isOwn = isOwnMessage;

                this.displayMessage(messageData);

                if (!isOwnMessage && this.isConnected) {
                    this.socket.send(JSON.stringify({
                        type: 'read-confirmation',
                        id: messageData.id
                    }));
                }
            } catch (error) {
                console.error('❌ Error al procesar mensaje:', error);
            }
        };

        this.socket.onclose = () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.disableInputs();
            setTimeout(() => {
                this.initializeSocket();
            }, 3000);
        };

        this.socket.onerror = (error) => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.disableInputs();
        };
    }

    setupEventListeners() {
        this.messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        this.imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleImageSelection(file);
            }
        });
    }

    sendMessage() {
        const textMessage = this.messageInput.value.trim();
        if (textMessage && this.isConnected) {
            const messageData = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                username: this.username,
                content: textMessage,
                timestamp: new Date().toISOString(),
                type: 'text'
            };

            this.sentMessageIds.add(messageData.id);
            this.socket.send(JSON.stringify(messageData));
            this.messageInput.value = '';
        }
    }

    displayMessage(messageData) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${messageData.isOwn ? 'user' : 'other'}`;
        messageElement.dataset.messageId = messageData.id;

        const timestamp = new Date(messageData.timestamp);
        const hours = timestamp.getHours().toString().padStart(2, '0');
        const minutes = timestamp.getMinutes().toString().padStart(2, '0');

        let contentHTML = '';
        if (messageData.type === 'image') {
            contentHTML = `<img src="${messageData.content}" alt="Imagen" class="message-image">`;
        } else {
            contentHTML = `<div class="message-content">${messageData.content}</div>`;
        }

        messageElement.innerHTML = `
            <div class="message-header">
                <span class="username">${messageData.username}</span>
                <span class="timestamp">${hours}:${minutes}</span>
            </div>
            ${contentHTML}
            <div class="message-timer">Desaparece en 5s</div>
        `;

        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        this.startMessageTimer(messageElement);
    }

    startMessageTimer(messageElement) {
        let timeLeft = 5;
        const interval = setInterval(() => {
            timeLeft--;
            const timerElement = messageElement.querySelector('.message-timer');
            if (timerElement) {
                timerElement.textContent = `Desaparece en ${timeLeft}s`;
            }
            if (timeLeft <= 0) {
                clearInterval(interval);
                messageElement.classList.add('fade-out');
                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.parentNode.removeChild(messageElement);
                    }
                }, 500);
            }
        }, 1000);
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.innerHTML = `<span class="circle-icon"></span> Conectado como: ${this.username}`;
            this.connectionStatus.className = 'connection-status status-connected';
        } else {
            this.connectionStatus.innerHTML = `<span class="spinner"></span> Desconectado - Intentando reconectar...`;
            this.connectionStatus.className = 'connection-status status-disconnected';
        }
    }

    enableInputs() {
        this.messageInput.disabled = false;
        this.sendButton.disabled = false;
        this.imageInput.disabled = false;
    }

    disableInputs() {
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
        this.imageInput.disabled = true;
    }
}
