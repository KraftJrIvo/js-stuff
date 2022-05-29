const BG_COLOR = "beige";
const MAX_LVL = 10;
const MAX_NUM = 1000;
const GRAPH_W = 0.8;
const GRAPH_H = 0.8;
const RADIUS  = 5;

var curExpr = 0;
const EXPRESSIONS = [
    "n - 1",
    "n - G(n - 1)",
    "n - G(G(n - 1))",
    "n - G(G(n - 1) + 1) + 1",
    "n - G(G(G(n - 1)))",
    "n - G(G(G(n - 1) + 1)) + 1",
    "G(n - G(n - 1)) + G(n - G(n - 2))",
    "F(n)",
    "M(n)"
]

function fib(n) {
    return (n <= 1) ? 1 : fib(n-2) + fib(n-1);
}

function M(n) {
    
    var val = (n <= 0) ? 0 : (n - F(M(n - 1)));
    if (val < 0) {
	val = 0;
    }
    if (val >= n) {
	val = Math.max(n-1, 0);
    }
    return val;
}

function F(n) {
    var val = (n <= 0) ? 1 : (n - M(F(n - 1)));
    if (val < 0) {
	val = 1;
    }
    if (val >= n) {
	val = Math.max(n-1, 1);
    }
    return val;
}


var valTable = {};
function G(n) {
    if (n in valTable) {
	if (valTable[n] == -666) {
	    return n;
	}
	return valTable[n];
    } else {
	valTable[n] = -666;
    }
    var val = (n <= 0) ? 1 : eval(EXPRESSIONS[curExpr]);
    if (val < 0) {
	val = 0;
    }
    if (val >= n) {
	val = Math.max(n-1, 0);
    }
    valTable[n] = val;
    return val;
}

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

//---
class Node {
    constructor(id, tag, to) {
	this.id = id;
	this.tag = tag;
	this.to = to;
	this.lvl = (to >= 0 && to < nodes.length) ? (nodes[to].lvl + 1) : 0;
	this.x = 0;
	this.y = 0;
    }

    setXY(nLvl, nOnLvl, thisOnLvl) {
	var gW = canvas.width * GRAPH_W;
	var gH = canvas.height * GRAPH_H;
	var nodW = gW / (nOnLvl + 1);
	var nodH = gH / nLvl;
	this.x = canvas.width / 2 - gW / 2 + nodW * (thisOnLvl + 1);
	this.y = canvas.height / 2 + gH / 2 - nodH * this.lvl;
    }

    draw(nLvl, nOnLvl, thisOnLvl) {
	ctx.strokeStyle = "black";
	if (this.to >= 0) {
	    var node = nodes[this.to];
	    ctx.beginPath();
	    ctx.moveTo(this.x, this.y);
	    ctx.lineTo(node.x, node.y);
	    ctx.stroke();
	}
	ctx.strokeStyle = "gray";
	ctx.fillStyle = "lightgray";
	ctx.beginPath();
	ctx.arc(this.x, this.y, RADIUS, 0, 2 * 3.14159);
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = "black";
	//ctx.strokeText(this.tag, this.x, this.y);
    }
}
var nodes = [];
//---

function updateCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function addConnect(n, to) {
    nodes.push(new Node(nodes.length, ""+n, to));
}

var maxLvl = 0;
var nOnLvls = {};

function reset() {
    maxLvl = 0;
    nOnLvls = {};
    valTable = {};
    nodes = [];
}

function buildGraph() {
    for (var i = 0; i < MAX_NUM; ++i) {
	var to = G(i);
	if ((to >= 0 && to <= nodes.length) || nodes.length == 0) {
	    var lvl = (to == nodes.length) ? 0 : nodes[to].lvl;
	    if (to >= 0 && to <= nodes.length && lvl == MAX_LVL) {
		return;
	    }
	    addConnect(i, to);
	    lvl = (nodes.length > 0) ? nodes[nodes.length - 1].lvl : 0;
	    if (lvl > maxLvl) {
		maxLvl = lvl; 
	    }
	    if (lvl in nOnLvls) {
		nOnLvls[lvl] += 1;
	    } else {
		nOnLvls[lvl] = 1;
	    }
	}
    }
}

function redraw() {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var counter = 0;
    for (var i = 0; i < nodes.length; ++i) {
	nodes[i].setXY(maxLvl + 1, nOnLvls[nodes[i].lvl], counter);
	if (i < nodes.length - 1 && nodes[i + 1].lvl != nodes[i].lvl) {
	    counter = 0;
	} else if (i > 0) {
	    counter++;
	}
    }
    for (var i = 0; i < nodes.length; ++i) {
	nodes[i].draw(maxLvl + 1, nOnLvls[nodes[i].lvl], counter);
	if (i < nodes.length - 1 && nodes[i + 1].lvl != nodes[i].lvl) {
	    counter = 0;
	} else if (i > 0) {
	    counter++;
	}
    }

    ctx.fillStyle = "black";
    ctx.font = "48px serif"
    ctx.fillText("G(n) = "+EXPRESSIONS[curExpr], 10, canvas.height - 10);
}

function chooseGraph(exprDelta) {
    const len = EXPRESSIONS.length;
    curExpr = (curExpr + exprDelta) % len;
    if (curExpr < 0) {
	curExpr = len - 1;
    }
    reset();
    updateCanvasSize();
    buildGraph();
    redraw();
}

chooseGraph(0);

document.body.onkeydown = function(event) {
    if (!event.repeat) {
	const c = event.keyCode;
	const delta = (c == 37) ? -1 : (c == 39) ? 1 : 0;
	chooseGraph(delta);
    }
}
