const express = require('express');
const http = require('http');
const path = require('path');

const {Server} = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

io.on('connection',(socket)=>{
    console.log(socket.id);
    
    // Listen for drawing events from the client
    socket.on('draw',(data)=>{
        socket.broadcast.emit('draw',data);
    });
    socket.on('clearCanvas',()=>{
        // Clear the canvas for all clients
        socket.broadcast.emit('clearCanvas');
    });
    // Handle disconnection
    socket.on('disconnect',()=>{
        console.log('User disconnected: ' + socket.id);
    })
})

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});