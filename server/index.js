const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const Drawing = require('./drawingModel'); // Add this

const {Server} = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect('mongodb://localhost:27017/whiteboard', { useNewUrlParser: true, useUnifiedTopology: true });

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

let drawingId = null;

// On server start, load or create a drawing doc
(async () => {
  let drawing = await Drawing.findOne();
  if (!drawing) {
    drawing = await Drawing.create({ strokes: [] });
  }
  drawingId = drawing._id;
})();

io.on('connection', async (socket) => {
    console.log(socket.id);

    // Send current drawing to new client
    const drawing = await Drawing.findById(drawingId);
    socket.emit('initDrawing', drawing ? drawing.strokes : []);

    // Listen for drawing events from the client
    socket.on('draw', async (data) => {
        // Save to DB
        await Drawing.findByIdAndUpdate(drawingId, { $push: { strokes: data } });
        socket.broadcast.emit('draw', data);
    });

    socket.on('clearCanvas', async () => {
        // Clear the canvas for all clients and DB
        await Drawing.findByIdAndUpdate(drawingId, { $set: { strokes: [] } });
        socket.broadcast.emit('clearCanvas');
    });

    // Undo: remove last stroke
    socket.on('undo', async () => {
        const drawing = await Drawing.findById(drawingId);
        if (drawing && drawing.strokes.length > 0) {
            drawing.strokes.pop();
            await drawing.save();
            io.emit('initDrawing', drawing.strokes); // Sync all clients
        }
    });

    // Redo: not handled globally, only local stack

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});