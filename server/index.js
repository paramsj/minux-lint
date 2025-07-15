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
    socket.on('drawStroke', async (stroke) => {
        await Drawing.findByIdAndUpdate(drawingId, { $push: { strokes: [stroke] } });
        io.emit('drawStroke', stroke); // <-- Use io.emit instead of socket.broadcast.emit
    });

    socket.on('clearCanvas', async () => {
        // Clear the canvas for all clients and DB
        await Drawing.findByIdAndUpdate(drawingId, { $set: { strokes: [] } });
        socket.broadcast.emit('clearCanvas');
    });

    // Undo: remove last stroke by this client
    socket.on('undo', async (stroke) => {
        const drawing = await Drawing.findById(drawingId);
        if (drawing) {
            // Find the last matching stroke
            for (let i = drawing.strokes.length - 1; i >= 0; i--) {
                if (
                    drawing.strokes[i].clientId === stroke.clientId &&
                    JSON.stringify(drawing.strokes[i].segments) === JSON.stringify(stroke.segments)
                ) {
                    drawing.strokes.splice(i, 1);
                    break;
                }
            }
            await drawing.save();
            io.emit('removeStroke', stroke); // Only broadcast the removed stroke
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