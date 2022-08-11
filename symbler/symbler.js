const HEXCHARS = "0123456789abcdef";

const EPSILON = 0.001;

const ARCSTEP = 0.05;

function hex2val(ch) {
    return HEXCHARS.indexOf(ch);
}

function val2hex(val) {
    if (val > HEXCHARS.length) {
        return null;
    }
    return HEXCHARS[val];
}

const SymblerCommandDict = {
    //id: [name, argtype]
    0: ["SEL", ["VID"]],
    1: ["ADD", ["POS"]],
    2: ["CON", ["VID", "VID"]],
    3: ["LIN", ["POS"]],
    4: ["ARC", ["POS", "DIR"]],
    5: ["FIL", ["DIR"]],
    6: ["CUT", ["VID", "VID"]],
    7: ["MEM", []],
    8: ["FRG", []],
    9: ["CPY", ["POS", "DIR", "SCL"]],
    10:["MIR", ["POS", "DIR", "SCL"]],
    11:["DIR", ["VAL"]],
    12:["CLR", ["CLR"]],
    13:["DST", ["VAL"]]
}

class SymblerCommand {
    constructor(nom, args) {
        this.nom = nom;
        this.args = args;
    }
};

class SymblerCommandStack {
    constructor(cmds = []) {
        this.cmds = cmds;
    }

    get(i) {
        return this.cmds[i]
    }

    push(cmd) {
        this.cmds.push(cmd);
    }

    pop() {
        this.cmds.pop();
    }
};

class ParserState {
    constructor() {
        this.chpos = 0;
        this.nkey = 0;
    }
}

class SymblerState {
    constructor() {
        this.vertices = [];
        this.keyVertices = {};
        this.keynessList = [];
        this.nkey = 0;
        this.edges = [];
        this.memPosStk = [0];
        this.history = new SymblerCommandStack([]);
        this.dirStp = 3.14159 / 8;
        this.dstStp = 1;
        this.selectedV = -1;
        this.color = "black";
    }
}

class Symbler {

    _addVertex(state, x, y, isKey = false, selectIfKey = true) {
        let merged = false;

        for (var i = 0; i < state.vertices.length; ++i) {
            const v = state.vertices[i];
            if (Math.hypot(x - v[0], y - v[1]) < EPSILON) {
                if (isKey) {
                    if (!state.keynessList[i]) {
                        state.keyVertices[state.nkey] = i;
                        state.keynessList[i] = true;
                        state.nkey += 1;
                        if (selectIfKey) {
                            state.selectedV = state.nkey - 1;
                        }
                    }
                }
                merged = true;
                return i;
            }    
        }

        state.vertices.push([x, y]);
        state.keynessList.push(isKey);
        if (isKey) {
            state.keyVertices[state.nkey] = state.vertices.length - 1;
            state.nkey += 1;
            if (selectIfKey) {
                state.selectedV = state.nkey - 1;
            }
        }
        return state.vertices.length - 1;
    }

    _detectCrossection(x1a, y1a, x2a, y2a, x1b, y1b, x2b, y2b) {

        if ((x1a == x1b && y1a == y1b) || (x1a == x2b && y1a == y2b) || 
        (x2a == x1b && y2a == y1b) || (x2a == x2b && y2a == y2b)) {
            // there is already a vertex there
            return null;
        }

        const xOvrlp1 = Math.max(x1a, x1b);
        const xOvrlp2 = Math.min(x2a, x2b);
        const ymina = Math.min(y1a, y2a);
        const yminb = Math.min(y1b, y2b);
        const ymaxa = Math.max(y1a, y2a);
        const ymaxb = Math.max(y1b, y2b);
        const yOvrlp1 = Math.max(ymina, yminb);
        const yOvrlp2 = Math.min(ymaxa, ymaxb);

        if (xOvrlp1 > xOvrlp2 || yOvrlp1 > yOvrlp2) {
            // bounding rects do not collide
            return null;
        }

        const dx1 = x2a - x1a;
        const dy1 = y2a - y1a;
        const dx2 = x2b - x1b;
        const dy2 = y2b - y1b;
        
        const t1 = dx1 == 0 ? 999999999 : (dy1 / dx1);
        const t2 = dx2 == 0 ? 999999999 : (dy2 / dx2);

        if (t1 == t2) {
            // lines are parallel
            return null;
        }

        const b1 = y1a - x1a * t1;
        const b2 = y1b - x1b * t2;

        const cx = (b2 - b1) / (t1 - t2);
        const cy = t1 * cx + b1;

        const inBounds = cx >= xOvrlp1 - EPSILON && cx <= xOvrlp2 + EPSILON && cy >= yOvrlp1 - EPSILON && cy <= yOvrlp2 + EPSILON;
        if (inBounds) {
            return [cx, cy];
        }

        return null;
    }

    _detectCrossections(state, x1, y1, x2, y2) {
        let crosses = [];
        let newedges = [];
        for (var i = 0; i < state.edges.length; ++i) {
            const edge = state.edges[i];
            const v1 = state.vertices[edge[0]];
            const v2 = state.vertices[edge[1]];
            if (v1[0] != v2[0] || v1[1] != v2[1]) {
                const cross = this._detectCrossection(x1, y1, x2, y2, v1[0], v1[1], v2[0], v2[1]);
                if (cross === null) {
                    newedges.push(edge);
                } else {
                    const newid = this._addVertex(state, cross[0], cross[1], true, false);
                    newedges.push([edge[0], newid, edge[2]]);
                    newedges.push([newid, edge[1], edge[2]]);
                    crosses.push([cross[0], cross[1], newid]);
                }
            } else {
                newedges.push(edge);
            }
        }
        state.edges = newedges;
        return crosses;
    }

    _cutGraph(state, vid1, vid2) {
        let v1 = state.vertices[vid1];
        let v2 = state.vertices[vid2];
        const x1 = v1[0];
        const y1 = v1[1];
        const x2 = v2[0];
        const y2 = v2[1];
        const crosses = this._detectCrossections(state, x1, y1, x2, y2);
        if (crosses.length > 0) {
            let vtosort = [[x1, y1, vid1], [x2, y2, vid2]];
            for (var i = 0; i < crosses.length; ++i) {
                vtosort.push(crosses[i]);
            }  

            for (var i = 0; i < vtosort.length; ++i) {
                for (var j = i + 1; j < vtosort.length; ++j) {
                    if (vtosort[i][0] > vtosort[j][0] || (vtosort[i][0] == vtosort[j][0] && vtosort[i][1] > vtosort[j][1])) {
                        const tmp = vtosort[i];
                        vtosort[i] = vtosort[j];
                        vtosort[j] = tmp;
                    }
                }
            }

            for (var i = 0; i < vtosort.length - 1; ++i) {
                const vvid1 = vtosort[i][2];
                const vvid2 = vtosort[i+1][2];
                state.edges.push([vvid1, vvid2, state.color]);
            }            

            return true;
        }
        return false;
    }

    _addEdge(state, vid1, vid2) {
        let v1 = state.vertices[vid1];
        let v2 = state.vertices[vid2];

        if (Math.hypot(v1[0] - v2[0], v1[1] - v2[1]) < EPSILON) {
            return;
        }

        const swap = v1[0] > v2[0];
        if (swap) {
            const tmp = v1;
            v1 = v2;
            v2 = tmp;
        }

        if (!this._cutGraph(state, swap ? vid2 : vid1, swap ? vid1 : vid2)) {
            state.edges.push([swap ? vid2 : vid1, swap ? vid1 : vid2, state.color]);
        }
    }

    _addDot(state, vid) {
        state.edges.push([vid, vid, state.color]);
    }

    _calcNewPos(state, dir_, dist_) {
        const dir = dir_ * state.dirStp;
        const dst = dist_ * state.dstStp;
        const xoff = Math.cos(dir) * dst;
        const yoff = Math.sin(dir) * dst;
        const curx = state.nkey ? state.vertices[state.keyVertices[state.selectedV]][0] : 0;
        const cury = state.nkey ? state.vertices[state.keyVertices[state.selectedV]][1] : 0;

        const x = curx + xoff;
        const y = cury + yoff;
        return [x, y];
    }

    _findPathRecur(state, vid1, vid2, path = [], edges = [], curv = -1) {
        //console.log(curv, vid1, vid2);
        curv = (curv == -1) ? vid1 : curv;
        for (var i = 0; i < state.edges.length; ++i) {
            const edge = state.edges[i];
            if ((edge[0] == curv || edge[1] == curv) && edges.indexOf(i) == -1) {
                const nxt = (edge[0] == curv) ? edge[1] : edge[0];
                if (path.indexOf(nxt) == -1) {
                    let newpath = [...path];        
                    newpath.push(nxt);
                    let newedges = [...edges];
                    newedges.push(i);
                    if (nxt == vid2) {
                        console.log(newpath);
                        return newedges;
                    }
                    const p = this._findPathRecur(state, vid1, vid2, newpath, newedges, nxt);
                    if (p.length > 0) {
                        return p;
                    }
                }
            }
        }
        return [];
    }

    _digitsToNum(digits, from, to) {
        let val = 0;
        let pow = to - from - 1;
        for (var i = from; i < to; ++i) {
            val += digits[i] * Math.pow(16, pow);
            pow--;
        }
        return val;
    }

    _CMD_select(state, args) {
        const vid = this._digitsToNum(args, 0, this._getNcharsPerVID(state));
        state.selectedV = state.nkey ? (vid % state.nkey) : 0;
    }

    _CMD_add(state, args) {
        const dir = args[0];
        const dst = args[1];
        const newpos = this._calcNewPos(state, dir, dst);
        this._addVertex(state, newpos[0], newpos[1], true);
    }

    _CMD_connect(state, args) {
        const nchs = this._getNcharsPerVID(state);
        const vid1 = this._digitsToNum(args, 0, nchs);
        const vid2 = this._digitsToNum(args, nchs, nchs * 2);
        if ((vid1 in state.keyVertices) && (vid2 in state.keyVertices)) {
            this._addEdge(state, state.keyVertices[vid1], state.keyVertices[vid2]);
        }
    }

    _CMD_lineTo(state, args) {
        const dir = args[0];
        const dst = args[1];
        const newpos = this._calcNewPos(state, dir, dst);
        const prevSelected = state.selectedV;
        this._addVertex(state, newpos[0], newpos[1], true);
        this._addEdge(state, state.keyVertices[prevSelected], state.keyVertices[state.selectedV]);
    }

    _CMD_arc(state, args) {
        const dst = args[1];
        if (dst == 0) {
            this._addDot(state, state.keyVertices[state.selectedV]);
        } else {
            const dir = args[0];
            const halfspread = args[2];
            const center = this._calcNewPos(state, dir, dst);
            const start = this._calcNewPos(state, dir - halfspread, dst);
            const length = 2 * halfspread * dst;
            const nsegs = Math.ceil(length / ARCSTEP);
            const segarc = 2 * halfspread / nsegs;
            let prvV = this._addVertex(state, start[0], start[1], true, false);
            let nxtV = prvV;
            for (var i = 0; i <= nsegs; ++i) {
                const next = this._calcNewPos(state, dir - halfspread + segarc * i, dst);
                nxtV = this._addVertex(state, next[0], next[1], i == nsegs, false);
                if (i > 0) {
                    this._addEdge(state, prvV, nxtV);
                }
                prvV = nxtV;
            }state
        }
    }

    _CMD_fill(state, args) {
        
    }

    _CMD_cut(state, args) {
        const nchs = this._getNcharsPerVID(state);
        const vid1 = this._digitsToNum(args, 0, nchs);
        const vid2 = this._digitsToNum(args, nchs, nchs * 2);
        if ((vid1 in state.keyVertices) && (vid2 in state.keyVertices)) {
            const p = this._findPathRecur(state, state.keyVertices[vid1], state.keyVertices[vid2]);
            if (p.length > 0) {
                let newedges = [];
                for (var i = 0; i < state.edges.length; ++i) {
                    if (p.indexOf(i) == -1) {
                        newedges.push(state.edges[i]);
                    }
                }
                state.edges = newedges;
            }
        }
    }

    _CMD_memorize(state, args) {
        state.memPosStk.push(state.history.length);
    }

    _CMD_forget(state, args) {
        state.memPosStk.pop();
    }

    _CMD_clone(state, args) {

    }

    _CMD_mirror(state, args) {

    }

    _CMD_setDirStp(state, args) {
        const val = args[0];
        state.dirStp = 3.14159 / val;
    }

    _CMD_setDstStp(state, args) {
        const val = args[0];
        state.dstStp = val;
    }

    _CMD_setColor(state, args) {
        const r = args[0];
        const g = args[1];
        const b = args[2];
        const chr = val2hex(r);
        const chg = val2hex(g);
        const chb = val2hex(b);
        state.color = "#" + chr + chr + chg + chg + chb + chb;
    }

    _isWhiteSpace(ch) {
        return ch === ' ' || ch === '\t';
    }

    _cutWhiteSpace(pstate, str) {
        while (pstate.chpos < str.length && this._isWhiteSpace(str[pstate.chpos])) {
            pstate.chpos += 1;
        }
    }

    _parseChar(pstate, str) {
        this._cutWhiteSpace(pstate, str);
        if (pstate.chpos < str.length) {
            const ch = str[pstate.chpos];
            pstate.chpos += 1;
            if (HEXCHARS.indexOf(ch) != -1) {
                return hex2val(ch);
            } else {
                return ch.charCodeAt(0) % 16;
            }
        }
        return -1; 
    }

    _getNcharsPerVID(pstate) {
        return Math.max(Math.ceil(Math.log(pstate.nkey) / Math.log(16)), 1)
    }

    _getNcharsByArgtype(pstate, argtype) {
        let n = 0;
        for (var i = 0; i < argtype.length; ++i) {
            const arg = argtype[i];
            switch (arg) {
                case "VAL":
                    n += 1;
                    break;
                case "CLR":
                    n += 3;
                    break;
                case "DIR":
                    n += 1;
                    break;
                case "DST":
                    n += 1;
                    break;
                case "SCL":
                    n += 1;
                    break;
                case "POS":
                    n += 2;
                    break;
                case "VID":
                    n += this._getNcharsPerVID(pstate);
                    break;
                };
        }
        return n;
    }

    _getArgs(pstate, str, n) {
        let args = [];
        for (var i = 0; i < n; ++i) {
            const val = this._parseChar(pstate, str);
            if (val == -1) {
                return null;
            }
            args.push(val);
        }
        return args;
    }

    _parseCommand(pstate, state, str, val) {
        if (str.length == 0 || val == -1) {
            return false;
        }     
        const pcmd = SymblerCommandDict[val % Object.keys(SymblerCommandDict).length];
        const nom = pcmd[0];
        const argsts = pcmd[1];
        const args = this._getArgs(pstate, str, this._getNcharsByArgtype(pstate, argsts));
        const cmd = new SymblerCommand(nom, args);
        if (cmd.nom && cmd.args) {
            return cmd;
        }
        return null;
    }

    _doCommand(state, cmd) {
        if (state.vertices.length == 0) {
            this._addVertex(state, 0, 0, true);
        }

        const args = cmd.args;
        switch (cmd.nom) {
            case "SEL":
                this._CMD_select(state, args);
                break;
            case "ADD":
                this._CMD_add(state, args);
                break;
            case "CON":
                this._CMD_connect(state, args);
                break;
            case "LIN":
                this._CMD_lineTo(state, args);
                break;
            case "ARC":
                this._CMD_arc(state, args);
                break;
            case "FIL":
                this._CMD_fill(state, args);
                break;
            case "CUT":
                this._CMD_cut(state, args);
                break;
            case "MEM":
                this._CMD_memorize(state, args);
                break;
            case "FRG":
                this._CMD_forget(state, args);
                break;
            case "CPY":
                this._CMD_clone(state, args);
                break;
            case "MIR":
                this._CMD_mirror(state, args);
                break;
            case "DIR":
                this._CMD_setDirStp(state, args);
                break;
            case "DST":
                this._CMD_setDstStp(state, args);
                break;
            case "CLR":
                this._CMD_setColor(state, args);
                break;
            default:
                return;
        }
        state.history.push(cmd);
    }

    _parseString(str) {

        let pstate = new ParserState();
        let state = new SymblerState();

        let cmds = new SymblerCommandStack();
        let cmd = new SymblerCommand("", []);

        do {
            cmd = this._parseCommand(pstate, state, str, this._parseChar(pstate, str));
            if (cmd) {
                this._doCommand(state, cmd);
                pstate.nkey = state.nkey;
                cmds.push(cmd);
            }
        } while (cmd)

        return [state, cmds];
    }

    _generateLines(state = new SymblerState(), cmds = new SymblerCommandStack()) {
        let lines = [];

        for (var i = 0; i < state.edges.length; ++i) {
            const edge = state.edges[i];
            const v1 = state.vertices[edge[0]];
            const v2 = state.vertices[edge[1]];
            const color = edge[2];
            const key1 = state.keynessList[edge[0]];
            const key2 = state.keynessList[edge[1]];
            lines.push([v1, v2, color, [key1, key2]]);
        }

        /*for (var i = 0; i < state.nkey; ++i) {
            const v = state.vertices[state.keyVertices[i]];
            const color = "red";
            const key1 = true;
            const key2 = true;
            lines.push([v, v, color, [key1, key2]]);
            for (var j = 0; j < i; ++j) {
                lines.push([[v[0] + 0.05 + 0.05*j, v[1] + 0.05], [v[0] + 0.05 + 0.05*j, v[1] + 0.05], color, [key1, key2]]);
            }
        }*/
        
        console.log(cmds);
        console.log(state);

        return lines;
    }


    _normalizeLines(lines, sqSide, margin) {
        let newLines = [];

        let maxX = -Infinity;
        let minX = Infinity;
        let maxY = -Infinity;
        let minY = Infinity;

        for (var i = 0; i < lines.length; ++i) {
            maxX = Math.max(lines[i][0][0], Math.max(lines[i][1][0], maxX));
            minX = Math.min(lines[i][0][0], Math.min(lines[i][1][0], minX));
            maxY = Math.max(lines[i][0][1], Math.max(lines[i][1][1], maxY));
            minY = Math.min(lines[i][0][1], Math.min(lines[i][1][1], minY));
        }

        const diffX = Math.max((maxX - minX), EPSILON);
        const diffY = Math.max((maxY - minY), EPSILON);
        const maxDiff = Math.max(diffX, diffY);
        const centerX = diffX / 2;
        const centerY = diffY / 2;

        const w = sqSide - 2 * margin;

        const xoff = w / 2 - w * (diffX/2)/maxDiff;
        const yoff = w / 2 - w * (diffY/2)/maxDiff;

        for (var i = 0; i < lines.length; ++i) {
            const line = lines[i];
            const pt1 = line[0];
            const pt2 = line[1];
            const color = line[2];
            let x1 = margin + w * (pt1[0] - minX) / maxDiff + xoff;
            let y1 = sqSide - (margin + w * (pt1[1] - minY) / maxDiff + yoff);
            let x2 = margin + w * (pt2[0] - minX) / maxDiff + xoff;
            let y2 = sqSide - (margin + w * (pt2[1] - minY) / maxDiff + yoff);
            newLines.push([[x1, y1], [x2, y2], color, [line[3][0], line[3][1]]]);
        }

        return newLines;
    }

    drawSymbolByCmds(ctx, sqSide = 100, margin = 10, thickness = 3, roundEnds = false, 
                    state = new SymblerState(), cmds = new SymblerCommandStack()) {
        let lines = this._generateLines(state, cmds);
        lines = this._normalizeLines(lines, sqSide, margin + thickness / 2);

        ctx.lineWidth = thickness;
        lines
        for (var i = 0; i < lines.length; ++i) {
            const line = lines[i];
            
            ctx.strokeStyle = line[2];

            ctx.beginPath();
            ctx.moveTo(line[0][0], line[0][1]);
            ctx.lineTo(line[1][0], line[1][1]);
            ctx.stroke();

            if (roundEnds) {
                const key1 = line[3][0];
                const key2 = line[3][1];
                const r = thickness / 2;
                ctx.fillStyle = ctx.strokeStyle;
                //if (key1) {
                    ctx.beginPath();
                    ctx.arc(line[0][0], line[0][1], r, 0, 2 * 3.14159);
                    ctx.fill();
                //}
                //if (key2) {
                    ctx.beginPath();
                    ctx.arc(line[1][0], line[1][1], r, 0, 2 * 3.14159);
                    ctx.fill();
                //}
            }
        }
    }

    drawSymbolByString(ctx, str, sqSide = 100, margin = 10, thickness = 3, roundEnds = false) {
        const st_cmds = this._parseString(str);
        const state = st_cmds[0];
        const cmds = st_cmds[1];
        this.drawSymbolByCmds(ctx, sqSide, margin, thickness, roundEnds, state, cmds);
    }

};