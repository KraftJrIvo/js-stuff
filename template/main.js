const BG_COLOR = "beige";

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

function updateCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function redraw() {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

updateCanvasSize();
redraw();
