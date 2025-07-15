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
let allStrokes = []; // NEW: holds all strokes for display

// Canvas config
ctx.lineWidth = 2;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.strokeStyle = "white";

// Max stack size
const MAX_STACK_SIZE = 100; // Limit for undo/redo stacks

// Helper to push with limit for undo/redo stacks only
function pushWithLimit(stack, item) {
    stack.push(item);
    if (stack.length > MAX_STACK_SIZE) {
        stack.shift(); // Remove oldest from undo/redo history, but not from canvas
    }
}

// Redraw all strokes (use allStrokes)
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    allStrokes.forEach(stroke => {
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

// Mouse Events
canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
    currentStroke = []; // Start a new stroke
});

canvas.addEventListener('mouseup', () => {
    if (drawing && currentStroke.length > 0) {
        const strokeWithClient = { segments: currentStroke, clientId };
        allStrokes.push(strokeWithClient); // Always keep for display
        pushWithLimit(undoStack, strokeWithClient); // Only limit undo history
        socket.emit('drawStroke', strokeWithClient);
        redoStack = [];
    }
    drawing = false;
    currentStroke = [];
});

canvas.addEventListener('mouseout', () => {
    if (drawing && currentStroke.length > 0) {
        const strokeWithClient = { segments: currentStroke, clientId };
        allStrokes.push(strokeWithClient);
        pushWithLimit(undoStack, strokeWithClient);
        socket.emit('drawStroke', strokeWithClient);
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
        pushWithLimit(undoStack, { x1, y1, x2, y2, color: drawColor });
        redoStack = [];
    }
}

// Listen for initial drawing from server
socket.on('initDrawing', (strokes) => {
    allStrokes = strokes; // All strokes for display
    undoStack = strokes.slice(-MAX_STACK_SIZE); // Only keep latest for undo
    redoStack = [];
    redraw();
});

// Listen for drawing events from server
socket.on('drawStroke', (stroke) => {
    allStrokes.push(stroke);
    pushWithLimit(undoStack, stroke);
    redraw();
});

// Clear canvas event
socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    allStrokes = [];
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
    allStrokes = [];
    undoStack = [];
    redoStack = [];
    socket.emit('clearCanvas');
});

// Undo/Redo buttons
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

undoBtn.addEventListener('click', () => {
    const idx = [...undoStack].reverse().findIndex(s => s.clientId === clientId);
    if (idx === -1) return;
    const realIdx = undoStack.length - 1 - idx;
    const lastStroke = undoStack[realIdx];
    // Remove from allStrokes
    const displayIdx = allStrokes.findIndex(s =>
        s.clientId === lastStroke.clientId &&
        JSON.stringify(s.segments) === JSON.stringify(lastStroke.segments)
    );
    if (displayIdx !== -1) {
        allStrokes.splice(displayIdx, 1);
    }
    pushWithLimit(redoStack, lastStroke);
    socket.emit('undo', lastStroke);
    redraw();
});

redoBtn.addEventListener('click', () => {
    const idx = [...redoStack].reverse().findIndex(s => s.clientId === clientId);
    if (idx === -1) return;
    const realIdx = redoStack.length - 1 - idx;
    const stroke = redoStack.splice(realIdx, 1)[0];
    allStrokes.push(stroke);
    pushWithLimit(undoStack, stroke);
    socket.emit('drawStroke', stroke);
    redraw();
});

// Remove stroke event
socket.on('removeStroke', (stroke) => {
    // Remove from allStrokes
    const idx = allStrokes.findIndex(s =>
        s.clientId === stroke.clientId &&
        JSON.stringify(s.segments) === JSON.stringify(stroke.segments)
    );
    if (idx !== -1) {
        allStrokes.splice(idx, 1);
        redraw();
    }
    // Remove from undoStack as well (optional, for consistency)
    const undoIdx = undoStack.findIndex(s =>
        s.clientId === stroke.clientId &&
        JSON.stringify(s.segments) === JSON.stringify(stroke.segments)
    );
    if (undoIdx !== -1) {
        undoStack.splice(undoIdx, 1);
    }
});