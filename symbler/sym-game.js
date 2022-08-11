const BG_COLOR = "beige";

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

var symbler = new Symbler();

function redraw() {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function redrawSymbol() {
    redraw();
    //const str = document.getElementById("query").textContent;
    let str = "0"; // nothing
    //str = "301"; // horizontal line
    //str = "30a1673ca"; //cross
    //str = "30a3673ca0432706cf00302"; //cross + /
    //str = "3421424c24024018400800182304";
    str = "342 142 4c24 02 4c18 4008 00 182 304 ";
    //str = "In the town where I was bornLived a man who sailed to sea";
    
    symbler.drawSymbolByString(ctx, str, canvas.width, 10, 15, true);
}

redraw();

redrawSymbol();