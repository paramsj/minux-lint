const socket = io();

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

// Canvas config
ctx.lineWidth = 2;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.strokeStyle = "white";

// Mouse Events
canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);

canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;

    const newX = e.offsetX;
    const newY = e.offsetY;

    draw(lastX, lastY, newX, newY, true, color); 
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
    strokes.forEach(s => {
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.closePath();
    });
}

// Listen for initial drawing from server
socket.on('initDrawing', (strokes) => {
    undoStack = [...strokes];
    redoStack = [];
    redraw(undoStack);
});

// Listen for drawing events from server
socket.on('draw', ({ x1, y1, x2, y2, color }) => {
    draw(x1, y1, x2, y2, false, color);
    undoStack.push({ x1, y1, x2, y2, color });
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
    if (undoStack.length === 0) return;
    const last = undoStack.pop();
    redoStack.push(last);
    redraw(undoStack);
    socket.emit('undo');
});

redoBtn.addEventListener('click', () => {
    if (redoStack.length === 0) return;
    const stroke = redoStack.pop();
    undoStack.push(stroke);
    draw(stroke.x1, stroke.y1, stroke.x2, stroke.y2, true, stroke.color);
});