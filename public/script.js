const socket = io();
let clientId = null;

socket.on('connect', () => {
    clientId = socket.id;
});

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let lastX = 0;
let lastY = 0;
let color = "white"; 

// Undo/Redo stacks
let undoStack = [];
let redoStack = [];
let currentStroke = []; // Add this

// Canvas config
ctx.lineWidth = 2;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.strokeStyle = "white";

// Mouse Events
canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
    currentStroke = []; // Start a new stroke
});

canvas.addEventListener('mouseup', () => {
    if (drawing && currentStroke.length > 0) {
        // Attach clientId to the stroke
        const strokeWithClient = { segments: currentStroke, clientId };
        undoStack.push(strokeWithClient);
        socket.emit('drawStroke', strokeWithClient); // Send the whole stroke with clientId
        redoStack = [];
    }
    drawing = false;
    currentStroke = [];
});

canvas.addEventListener('mouseout', () => {
    if (drawing && currentStroke.length > 0) {
        undoStack.push(currentStroke);
        socket.emit('drawStroke', currentStroke);
        redoStack = [];
    }
    drawing = false;
    currentStroke = [];
});

canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;

    const newX = e.offsetX;
    const newY = e.offsetY;

    draw(lastX, lastY, newX, newY, false, color); // Don't emit here
    currentStroke.push({ x1: lastX, y1: lastY, x2: newX, y2: newY, color });
    [lastX, lastY] = [newX, newY];
});

// Drawing function
function draw(x1, y1, x2, y2, tellOthers, drawColor) {
    ctx.strokeStyle = drawColor;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();

    if (tellOthers) {
        socket.emit('draw', { x1, y1, x2, y2, color: drawColor });
        undoStack.push({ x1, y1, x2, y2, color: drawColor });
        redoStack = []; // Clear redo on new draw
    }
}

// Redraw all strokes
function redraw(strokes) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(stroke => {
        stroke.segments.forEach(s => {
            ctx.strokeStyle = s.color;
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();
            ctx.closePath();
        });
    });
}

// Listen for initial drawing from server
socket.on('initDrawing', (strokes) => {
    undoStack = strokes.map(stroke => stroke);
    redoStack = [];
    redraw(undoStack);
});

// Listen for drawing events from server
socket.on('drawStroke', (stroke) => {
    undoStack.push(stroke);
    redraw(undoStack);
});

// Clear canvas event
socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStack = [];
    redoStack = [];
});

// Color picker event
const colorPicker = document.getElementById('colorPicker');
colorPicker.addEventListener('input', (e) => {
    color = e.target.value;
    ctx.strokeStyle = color;
});

// Canvas Clear
const clearButton = document.getElementById('clear');
clearButton.addEventListener('click',()=>{
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStack = [];
    redoStack = [];
    socket.emit('clearCanvas');
});

// Undo/Redo buttons
const undoBtn = document.createElement('button');
undoBtn.textContent = "Undo";
document.body.appendChild(undoBtn);

const redoBtn = document.createElement('button');
redoBtn.textContent = "Redo";
document.body.appendChild(redoBtn);

undoBtn.addEventListener('click', () => {
    // Find last stroke by this client
    const idx = [...undoStack].reverse().findIndex(s => s.clientId === clientId);
    if (idx === -1) return;
    const realIdx = undoStack.length - 1 - idx;
    const lastStroke = undoStack[realIdx];
    redoStack.push(lastStroke);
    socket.emit('undo', lastStroke); // Let server broadcast, don't update undoStack here
});

redoBtn.addEventListener('click', () => {
    // Find last redo stroke by this client
    const idx = [...redoStack].reverse().findIndex(s => s.clientId === clientId);
    if (idx === -1) return;
    const realIdx = redoStack.length - 1 - idx;
    const stroke = redoStack.splice(realIdx, 1)[0];
    socket.emit('drawStroke', stroke); // Let server broadcast, don't update undoStack here
});

// Remove stroke event
socket.on('removeStroke', (stroke) => {
    const idx = undoStack.findIndex(s =>
        s.clientId === stroke.clientId &&
        JSON.stringify(s.segments) === JSON.stringify(stroke.segments)
    );
    if (idx !== -1) {
        undoStack.splice(idx, 1);
        redraw(undoStack);
    }
});