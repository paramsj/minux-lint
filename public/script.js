const socket = io();

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let lastX = 0;
let lastY = 0;
let color = "white"; 
// Canvas config
ctx.lineWidth = 2;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
//ctx.strokeStyle = '#000';
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
    }
}

// Listen for drawing events from server
socket.on('draw', ({ x1, y1, x2, y2, color }) => {
    draw(x1, y1, x2, y2, false, color);
});
// Clear canvas event
socket.on('clearCanvas', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    socket.emit('clearCanvas');
})