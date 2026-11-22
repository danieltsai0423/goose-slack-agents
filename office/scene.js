import { createOfficeLife } from './life.js';

// A small, original cutaway office. Static scenery is drawn once at its native resolution.
const WIDTH = 512;
const HEIGHT = 256;
const ink = '#38464b';
const woodEdge = '#63463d';
const desks = [
  { id: 'claude', x: 107, y: 101, team: 'claude', lead: true, variant: 0 },
  { id: 'codex', x: 405, y: 101, team: 'codex', lead: true, variant: 1 },
  { id: 'claude-research', x: 54, y: 173, team: 'claude', variant: 2 },
  { id: 'claude-review', x: 155, y: 184, team: 'claude', variant: 3 },
  { id: 'codex-build', x: 357, y: 184, team: 'codex', variant: 4 },
  { id: 'codex-test', x: 458, y: 173, team: 'codex', variant: 5 },
];

function painter(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  function box(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function poly(points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
  }
  function trim(x, y, w, h, edge, fill) {
    box(x, y, w, h, edge);
    box(x + 1, y + 1, w - 2, h - 2, fill);
  }
  return { ctx, box, poly, trim };
}

function seeded(seed) {
  return function next() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function skyline(p, x, y, w, h, start) {
  const { ctx, box, trim } = p;
  trim(x - 3, y - 2, w + 6, h + 7, '#778f86', '#e0d6b5');
  trim(x - 2, y - 3, w + 4, h + 5, '#435b60', '#658083');
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  box(x, y, w, h, '#9ed6da');
  box(x, y, w, h * 0.55 | 0, '#80bbcd');
  box(x, y, w, 4, '#72a8c0');
  function cloud(cx, cy, size) {
    box(cx, cy + 3, size, 2, '#e9ece2');
    box(cx + 3, cy + 1, size - 7, 3, '#f9f3dd');
    box(cx + 7, cy - 1, size - 14, 2, '#f9f3dd');
  }
  cloud(x + 10, y + 9, 31);
  cloud(x + 54, y + 15, 27);
  cloud(x + 91, y + 4, 34);
  const rnd = seeded(start);
  let bx = x - 3;
  while (bx < x + w) {
    const bw = Math.round(6 + rnd() * 11);
    const bh = Math.round(6 + rnd() * 17);
    const by = y + h - bh;
    const body = rnd() < 0.5 ? '#85b3b8' : '#77a7b1';
    box(bx, by, bw, bh, body);
    box(bx + 2, by - 2, bw - 3, 2, body);
    box(bx + bw - 3, by, 3, bh, '#719ba7');
    for (let wy = by + 3; wy < y + h - 1; wy += 5)
      for (let wx = bx + 2; wx < bx + bw - 3; wx += 4)
        if (rnd() > 0.23) box(wx, wy, 2, 2, rnd() > 0.5 ? '#b8d3c7' : '#709aa5');
    bx += bw + 1;
  }
  for (let i = 0; i < w; i += 10) {
    const hh = 2 + Math.floor(rnd() * 5);
    box(x + i, y + h - hh, 12, hh, '#79a99a');
    box(x + i + 2, y + h - hh - 2, 7, 3, '#91bca9');
  }
  // Slim glints in the glass stay clear of the window framing.
  p.poly([[x + 22,y],[x + 28,y],[x + 5,y+h],[x-1,y+h]], '#e7f1dc48');
  p.poly([[x + 30,y],[x + 32,y],[x + 9,y+h],[x+7,y+h]], '#e7f1dc40');
  const bars = [0, Math.floor(w/3), Math.floor(w*2/3), w-2];
  for (const xx of bars) {
    box(x + xx, y, 3, h, '#496572');
    box(x + xx, y, 1, h, '#bdc9b9');
  }
  box(x, y + 10, w, 2, '#647f82');
  box(x, y + 10, w, 1, '#b7c9bf');
  ctx.restore();
  box(x-4,y+h,w+8,3,'#e9d7b0');
  box(x-3,y+h+3,w+6,2,'#937764');
}

function plant(p, x, floor, size = 1, variation = 0) {
  const {ctx, box} = p;
  ctx.save(); ctx.translate(x,floor); ctx.scale(size,size);
  box(-8,-1,19,2,'#6f614d55');
  box(-6,-9,13,7,'#754d48'); box(-5,-2,11,2,'#775048');
  box(-5,-8,10,6,'#c0795a'); box(-4,-7,2,5,'#df9972'); box(2,-8,3,6,'#a55d4c');
  box(-7,-11,15,3,'#795049'); box(-6,-11,12,2,'#dda37c'); box(-5,-12,10,1,'#584638');
  box(0,-32,2,22,'#425b41'); box(-4,-26,1,12,'#547647');
  const leaves = [[0,-36,-1],[-4,-32,-1],[2,-31,1],[-6,-26,-1],[4,-25,1],[-5,-21,-1],[3,-21,1],[0,-26,1]];
  leaves.forEach(([lx,ly,dir],i) => {
    const offset = (variation + i) % 3 - 1;
    const c = ['#568459','#649353','#488262'][i%3];
    const hx=lx+offset;
    if(dir < 0) {
      box(hx-6,ly,5,2,'#3b644c'); box(hx-7,ly+2,9,3,c); box(hx-5,ly+5,8,3,c); box(hx-1,ly+8,4,2,'#40674b');
      box(hx-5,ly+2,5,1,'#91ae64'); box(hx-3,ly+4,4,1,'#77a45d');
    } else {
      box(hx+3,ly,5,2,'#406950'); box(hx,ly+2,9,3,c); box(hx-2,ly+5,8,2,c); box(hx-3,ly+7,4,2,'#3d6a50');
      box(hx+4,ly+1,3,1,'#a1b76a'); box(hx+1,ly+3,5,1,'#7ea95f');
    }
  });
  ctx.restore();
}

function books(p,x,y,length,seed) {
  const colors=['#a95a4f','#84a4a0','#e6be7c','#617e86','#c38162','#668984','#d0af89'];
  const rnd=seeded(seed);
  let offset=0;
  while(offset<length-3) {
    const w=2+Math.floor(rnd()*3), h=6+Math.floor(rnd()*4);
    p.box(x+offset,y-h,w,h,colors[Math.floor(rnd()*colors.length)]);
    if(w>2) p.box(x+offset,y-h+2,w-1,1,'#ead6ab');
    offset+=w+1;
  }
}

function cabinet(p,x,y,w) {
  const {box,trim}=p;
  box(x+2,y+21,w+2,4,'#77695655');
  trim(x,y,w,23,'#635344','#c19672');
  box(x+1,y,w-2,3,'#e8bf89'); box(x+2,y+4,w-4,17,'#96735a');
  for(let j=0;j<3;j++) {
    const xx=x+3+j*Math.floor((w-4)/3);
    trim(xx,y+5,Math.floor((w-5)/3),15,'#b28a67','#cfa57c');
    box(xx+3,y+8,4,1,'#7b6d62');
  }
  box(x+3,y+23,3,2,'#6a574c'); box(x+w-6,y+23,3,2,'#6a574c');
}

function rug(p,x,y,w,h,edge,base,thread) {
  const {box}=p;
  for(let n=1;n<w;n+=4) {
    box(x+n,y-2,2,2,'#d9ba89'); box(x+n,y+h,2,2,'#cdaa78');
  }
  box(x,y,w,h,edge); box(x+1,y+1,w-2,h-2,base);
  box(x+3,y+3,w-6,1,thread); box(x+3,y+h-4,w-6,1,thread);
  box(x+3,y+3,1,h-6,thread); box(x+w-4,y+3,1,h-6,thread);
  for(let cx=x+8;cx<x+w-8;cx+=12) {
    box(cx,y+5,3,1,thread); box(cx+1,y+6,1,1,thread);
    box(cx,y+h-6,3,1,thread); box(cx+1,y+h-7,1,1,thread);
  }
}

function lounge(p) {
  const {box,trim}=p;
  rug(p,222,136,68,77,'#82765d','#a7a788','#ccc7a0');
  // Upholstered loveseat with piping and separate seat cushions.
  box(228,155,57,3,'#716b5360');
  trim(229,135,53,20,'#496258','#72917c');
  box(231,134,49,4,'#789780'); box(234,134,43,1,'#aac1a0');
  box(232,143,47,4,'#466d63');
  trim(233,147,22,6,'#608778','#91ac92');
  trim(255,147,23,6,'#608778','#88a68d');
  for(const xx of [227,278]) { trim(xx,141,6,13,'#476759','#8caa8b'); box(xx+1,142,4,2,'#b0bc96'); }
  box(231,155,4,3,'#665746'); box(276,155,4,3,'#665746');
  trim(234,138,8,8,'#ac805d','#deb278'); box(236,140,4,4,'#e8c890');
  // Rounded corners on the low oak coffee table.
  box(236,180,39,4,'#6d675642');
  box(238,178,3,5,'#725940'); box(268,178,3,5,'#725940');
  box(237,165,34,14,woodEdge); box(234,168,40,8,woodEdge);
  box(237,166,34,10,'#d6a570'); box(235,168,38,7,'#dcae77'); box(238,166,30,1,'#edd099');
  trim(240,168,9,6,'#698280','#8fa6a0'); box(241,169,4,1,'#d4d3a9');
  box(262,169,5,5,'#e4d8b5'); box(263,168,3,1,'#6b5449'); box(267,170,2,2,'#b3a689');
  plant(p,256,173,0.46,2);
}

function drawWall(p) {
  const {box,trim}=p;
  box(0,0,WIDTH,70,'#cbd2bf');
  box(0,0,WIDTH,4,'#697b72'); box(0,4,WIDTH,2,'#e4e0c5');
  for(let xx=7;xx<WIDTH;xx+=13) box(xx,7,1,51,'#d8d9c4');
  box(0,51,WIDTH,10,'#a9baa9'); box(0,50,WIDTH,2,'#e6e2c6');
  box(0,60,WIDTH,6,'#957461'); box(0,60,WIDTH,2,'#d3b489'); box(0,66,WIDTH,2,'#846e5c');
  skyline(p,20,12,111,37,19); skyline(p,381,12,111,37,85);
  // Whiteboard with pinned research notes.
  trim(145,12,52,25,'#6a7169','#d8caa5');
  trim(147,14,48,21,'#c6b991','#b89573');
  box(151,17,10,11,'#ede1ba'); box(153,19,6,1,'#8bada1'); box(153,22,5,1,'#b6a47e');
  box(166,18,9,5,'#d6ae72'); box(169,17,2,2,'#985e4e'); box(180,22,9,9,'#c1d1b5');
  box(183,21,2,2,'#648283'); box(164,28,7,4,'#e4cd99');
  cabinet(p,146,48,57);
  books(p,149,48,24,113); plant(p,192,48,0.51);
  // Back-wall bookcase, sundries and dark shelves.
  trim(307,11,57,58,'#705443','#b18761');
  box(309,12,53,2,'#e0b885');
  for(const row of [26,41,56]) {
    box(310,row-10,51,10,'#896d57'); books(p,312,row,47,row+2);
    box(308,row,55,2,'#d2aa7a'); box(309,row+2,53,1,'#84664f');
  }
  box(309,60,52,6,'#bd966f'); box(334,60,1,6,'#926e54');
  box(330,62,2,1,'#69594b'); box(338,62,2,1,'#69594b');
  // Small double glass doors at the centre of the office.
  trim(235,17,43,50,'#606e66','#d6b68d');
  trim(238,19,18,46,'#786850','#bd9878');
  trim(257,19,18,46,'#786850','#bd9878');
  for(const xx of [240,259]) {
    trim(xx,22,14,26,'#7b7f70','#91ada8');
    p.poly([[xx+2,43],[xx+10,23],[xx+13,23],[xx+5,43]],'#b5cbc0');
    box(xx+1,53,11,1,'#d3b590');
  }
  box(252,49,2,5,'#685c4b'); box(259,49,2,5,'#685c4b');
  box(233,66,47,2,'#7d7767');
  // Clock with short hands.
  box(251,5,11,9,'#65746a'); box(253,3,7,13,'#65746a');
  box(252,6,9,7,'#f1e7bc'); box(254,4,5,11,'#f1e7bc');
  box(256,7,1,4,'#535b55'); box(257,10,3,1,'#8b6753');
  for(const xx of [5,214,295,502]) {
    box(xx,4,4,55,'#a1afa0'); box(xx+1,4,2,54,'#e6ddbd');
  }
  // Brass wall sconces either side of the glass doors.
  for(const xx of [222,284]) {
    box(xx,25,3,7,'#838878');box(xx-2,23,7,4,'#ac9975');
    box(xx-1,24,5,3,'#f5e8bc');box(xx+1,28,1,4,'#8d785c');
  }
}

function floor(p) {
  const {box,poly}=p;
  box(0,59,WIDTH,HEIGHT-59,'#b48f69');
  const rnd=seeded(23183);
  const cols=['#d6b386','#cfac80','#d8b98b','#d5b082','#d4b589','#cfab80','#ddbd8f'];
  for(let n=0; n<15;n++){
    let x=-(n%3)*22, y=62+n*14;
    while(x<WIDTH) {
      const w=52+Math.floor(rnd()*23);
      box(x,y,w-1,13,cols[Math.floor(rnd()*cols.length)]);
      box(x+1,y,w-2,1,'#eacba056'); box(x+w-1,y+1,1,12,'#ba976f');
      for(let i=0;i<4;i++) {
        const xx=x+4+Math.floor(rnd()*(w-15)), yy=y+3+Math.floor(rnd()*8);
        box(xx,yy,4+Math.floor(rnd()*10),1,'#b391703c');
      }
      x+=w;
    }
  }
  box(0,67,WIDTH,4,'#8d765b55'); box(0,71,WIDTH,3,'#a48c6a42');
  poly([[28,68],[116,68],[73,119],[-17,119]],'#ffebba2b');
  poly([[389,68],[481,68],[438,119],[345,119]],'#ffebba36');
  for(const start of [27,388]) {
    for(let i=0;i<3;i++)
      poly([[start+i*32,68],[start+2+i*32,68],[start-38+i*32,116],[start-40+i*32,116]],'#bda67c30');
  }
  box(0,67,4,HEIGHT-67,'#917960'); box(4,67,3,HEIGHT-67,'#b99b77');
  box(508,67,4,HEIGHT-67,'#917960'); box(505,67,3,HEIGHT-67,'#b99b77');
  box(0,251,WIDTH,5,'#8d735c'); box(3,250,506,2,'#ebc99c');
  // Softly woven desk mats mark the two teams.
  for (const s of desks) {
    const colors=s.team==='claude'?['#a78468','#c3a183','#dcc2a2']:['#80998d','#a1b4a2','#c8d0ad'];
    rug(p,s.x-39,s.y-1,78,s.lead?44:46,...colors);
  }
}

const letters={
 A:['010','101','111','101','101'],C:['111','100','100','100','111'],D:['110','101','101','101','110'],
 E:['111','100','110','100','111'],L:['100','100','100','100','111'],O:['111','101','101','101','111'],
 U:['101','101','101','101','111'],X:['101','101','010','101','101']
};
function plaque(p,x,y,label,blue) {
  p.box(x-2,y-2,label.length*4+3,9,blue?'#405864':'#885d4e');
  p.box(x-1,y-1,label.length*4+1,7,blue?'#567c8a':'#b6775e');
  [...label].forEach((c,i)=>letters[c].forEach((row,dy)=>[...row].forEach((px,dx)=>{
    if(px==='1')p.box(x+i*4+dx,y+dy,1,1,'#fff4d2');
  })));
}

function workstation(p,s) {
  const {box,trim}=p, x=s.x, y=s.y, blue=s.team==='codex';
  // Standing lamp with a bent neck, pencil cup, memo pad and a little computer tower.
  const left=x-35, right=x+35;
  box(left+3,y+25,68,5,'#765b494a');
  trim(left+2,y+13,5,14,woodEdge,'#9c785a'); trim(right-8,y+12,6,16,woodEdge,'#a68262');
  trim(right-23,y+13,18,14,woodEdge,'#ac8664');
  box(right-22,y+18,16,1,'#846951'); box(right-16,y+16,6,1,'#dfcba8'); box(right-16,y+21,6,1,'#d7bf9d');
  trim(left,y,71,17,woodEdge,'#d4a470');
  box(left+1,y+1,69,2,'#efc693');
  box(left+1,y+13,69,3,'#b77f59'); box(left+1,y+12,69,1,'#edbb86');
  box(left+4,y+4,16,1,'#c6966b'); box(right-14,y+9,7,1,'#bd8a64');
  const sx=x+(s.lead?1:-1), sw=s.lead?27:24;
  box(sx+9,y+2,5,3,'#4d5d5c'); box(sx+6,y+5,12,2,'#615e55');
  trim(sx,y-13,sw,17,'#35464b','#687b7a'); trim(sx+2,y-11,sw-4,12,'#2f505b',blue?'#527989':'#547c76');
  box(sx+3,y-10,sw-6,2,blue?'#779cac':'#87a49a');
  for(let i=0;i<3;i++) {
    box(sx+4+(i%2),y-6+i*2,6+(s.variant+i)%5,1,blue?'#aad9d1':'#bbd6a2');
    box(sx+sw-9,y-5+i*2,3+(i%2),1,blue?'#c2baa8':'#e2bd8f');
  }
  box(sx+sw-4,y+2,1,1,'#cddf9c');
  trim(x-3,y+7,18,5,'#8e806b','#d0c4a5');
  for(let i=0;i<7;i++) box(x-1+i*2,y+8,1,2,'#a29988');
  box(x+18,y+8,3,3,'#e1d3b5');
  if(s.variant%2===0){
    // Desk lamp
    box(left+4,y+6,9,2,'#716959'); box(left+8,y-7,2,14,'#586864');
    box(left+8,y-8,7,2,'#66746b'); box(left+14,y-8,3,2,'#51625f');
    box(left+12,y-6,8,3,blue?'#73959e':'#b47955'); box(left+11,y-3,10,2,'#f1d99a');
  } else {
    books(p,left+3,y+6,14,23+s.variant);
    box(left+2,y+6,14,1,'#ac795e');
  }
  if(s.lead) plaque(p,x+4,y+16,s.team.toUpperCase(),blue);
  box(left+18,y+3,6,5,'#e5d5b9'); box(left+19,y+3,4,1,'#755f4c');
  box(left+24,y+4,2,2,'#cdad87');
  // The chair remains visible when its worker is absent.
  const cx=x-11, cy=y+22;
  box(cx-7,cy+9,15,2,'#6c685851'); box(cx-1,cy+5,3,5,'#4c5753');
  box(cx-6,cy+9,12,2,'#52605b'); box(cx-7,cy+10,3,2,ink); box(cx+5,cy+10,3,2,ink);
  trim(cx-7,cy-5,15,10,ink,blue?'#577b84':'#90776a');
  box(cx-5,cy-6,11,2,blue?'#7e989a':'#b59780');
}

function teamProps(p) {
  const {box,trim}=p;
  // A mobile storyboard: little colour thumbnails and notes attached with brass pins.
  const x=169,y=96;
  box(x+1,y+28,34,2,'#7b684846');
  for(const n of [x+4,x+27]) {
    box(n,y+13,2,15,'#846f58');box(n-2,y+27,6,1,'#6a655a');
    box(n-2,y+28,2,2,'#4d5955');box(n+2,y+28,2,2,'#4d5955');
  }
  trim(x,y,34,20,'#7e6b56','#ece3c5');box(x+1,y+1,32,1,'#faf0cd');
  box(x+2,y+17,30,2,'#b69c7d');box(x+5,y+17,6,1,'#898879');
  for(const [i,col] of ['#d9a675','#9fb9ac','#d2b789'].entries()){
    const nx=x+3+i*10;
    box(nx,y+4,8,8,col);box(nx+3,y+3,2,2,'#8e7860');
    box(nx+1,y+10,5,1,'#9d9f82');box(nx+1,y+13,6,1,'#baad92');
  }
  // Opposite it, an equipment rack and its cable reel.
  const rx=310,ry=103;
  box(rx+2,ry+27,23,2,'#76674c42');
  trim(rx,ry,21,26,'#485d5c','#8c9b8e');
  box(rx+1,ry+1,19,2,'#bbc4aa');
  for(const dy of [5,11,17]){
    trim(rx+3,ry+dy,15,5,'#526869','#667d7a');
    box(rx+4,ry+dy+2,6,1,'#9ab2a5');box(rx+14,ry+dy+2,2,1,dy===11?'#e2b571':'#a6c797');
  }
  box(rx+2,ry+25,3,3,'#59645c');box(rx+16,ry+25,3,3,'#59645c');
  box(rx+2,ry-3,12,3,'#aaa58f');box(rx+3,ry-4,10,2,'#e3d5b5');
}

function backLayer(canvas) {
  const p=painter(canvas);
  floor(p); drawWall(p);
  lounge(p);
  plant(p,19,89,0.94,3); plant(p,489,90,0.97);
  plant(p,211,103,0.76,1); plant(p,298,102,0.77,4);
  teamProps(p);
  for(const s of desks) workstation(p,s);
  plant(p,21,243,1.13,1); plant(p,495,245,1.08,3);
  // A short communal reference shelf at the front edge.
  const {box,trim}=p;
  cabinet(p,219,225,74);
  books(p,223,225,17,432); plant(p,277,225,0.62,3);
  trim(249,220,15,5,'#91765f','#ded0a8');
  box(250,218,12,3,'#8da397'); box(251,218,10,1,'#afc3ad');
}

const people=[
  {hair:'#733e32',light:'#bb7950',skin:'#eab891',shirt:'#c67858',fold:'#935140',trousers:'#526b68'},
  {hair:'#354956',light:'#637b80',skin:'#dbb08d',shirt:'#5e91aa',fold:'#416d86',trousers:'#445768'},
  {hair:'#493739',light:'#835858',skin:'#c78e6b',shirt:'#c5a355',fold:'#977c46',trousers:'#655567'},
  {hair:'#86593d',light:'#c69361',skin:'#e8bd99',shirt:'#749779',fold:'#557461',trousers:'#636678'},
  {hair:'#493d3b',light:'#876c51',skin:'#bf8666',shirt:'#6f94a4',fold:'#4d7080',trousers:'#625e69'},
  {hair:'#563d4c',light:'#886276',skin:'#e7b18a',shirt:'#aa85a2',fold:'#815e80',trousers:'#50667a'},
];
const workingStates=new Set(['planning','working','running','busy','delegated','reviewing','queued']);

const places = {
  board:       { x: 183, y: 132, side: 'claude', via: [{x: 207, y: 142}] },
  boardRight:  { x: 199, y: 135, side: 'claude', via: [{x: 207, y: 146}] },
  windowLeft:  { x: 60, y: 88, side: 'claude', via: [{x: 55, y: 143}, {x: 55, y: 88}] },
  plantLeft:   { x: 216, y: 115, side: 'claude', via: [{x: 215, y: 138}] },
  shelfLeft:   { x: 210, y: 234, side: 'claude', via: [] },
  loungeLeft:  { x: 234, y: 205, side: 'claude', via: [] },
  rack:        { x: 318, y: 139, side: 'codex', via: [{x: 304, y: 144}] },
  workbench:   { x: 341, y: 148, side: 'codex', via: [{x: 304, y: 149}] },
  shelf:       { x: 347, y: 85, side: 'codex', via: [{x: 347, y: 150}, {x: 347, y: 91}] },
  windowRight: { x: 461, y: 88, side: 'codex', via: [{x: 457, y: 147}, {x: 457, y: 88}] },
  loungeRight: { x: 277, y: 204, side: 'codex', via: [] }
};
const lanes = { claude: 207, codex: 304 };
const homePosition = s => ({ x: s.x - 11, y: s.y + 33 });

function routeTo(s, place) {
  const home=homePosition(s), aisle=s.lead?145:226;
  return [home, {x:home.x,y:aisle}, {x:lanes[s.team],y:aisle},
    {x:lanes[s.team],y:200}, {x:lanes[place.side],y:200}, ...place.via, place];
}

function pointAlong(points, progress) {
  const segments=points.slice(1).map((to,index)=>{
    const from=points[index];
    return { from, to, length: Math.hypot(to.x-from.x,to.y-from.y) };
  }).filter(segment=>segment.length);
  let remaining=segments.reduce((total,segment)=>total+segment.length,0)*progress;
  for(const {from,to,length} of segments) {
    if(remaining<=length) {
      const fraction=remaining/length;
      return {x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction,left:to.x<from.x};
    }
    remaining-=length;
  }
  return points.at(-1);
}

function stepPose(s, life, index, reduce) {
  if(reduce) return null;
  const place=places[life.place ?? ['loungeLeft','loungeRight'][index]];
  const path=routeTo(s,place);
  if(life.elapsed<life.walk) {
    return { ...pointAlong(path,life.elapsed/life.walk), moving:true };
  }
  const returnAt=life.endsAt-life.start-life.walk;
  if(life.elapsed>=returnAt) {
    return { ...pointAlong(path.toReversed(),Math.min(1,(life.elapsed-returnAt)/life.walk)), moving:true };
  }
  return { ...place, prop:life.prop, left:index===1 };
}

function heldProp(p, type, x, y) {
  const {box}=p;
  if(type==='cup'){box(x,y,5,5,'#56443d');box(x+1,y+1,3,3,'#eee1be');box(x+5,y+1,1,3,'#f5dfac');}
  if(type==='book'||type==='note'){
    box(x,y,7,5,type==='book'?'#725b42':'#7d6b59');
    box(x+1,y+1,5,3,type==='book'?'#d6b377':'#fcf0c9');box(x+2,y+2,3,1,'#9c8765');
  }
  if(type==='tools'){box(x,y+2,6,2,'#b7cbca');box(x+4,y,2,4,'#526866');box(x,y+2,2,2,'#665447');}
  if(type==='water'){box(x,y+1,5,4,'#668b9d');box(x+5,y+1,3,1,'#b0d3d1');box(x+1,y,3,1,'#aec1bc');}
}

function sitter(p,s,agent,tick,pose,deskProp) {
  const {box}=p; const c=people[s.variant]; const busy=workingStates.has(agent.status);
  const x=Math.round(pose?.x ?? s.x-11), y=Math.round(pose ? pose.y-10 : s.y+23);
  const stride=pose?.moving?(tick%4<2?1:-1):0;
  const headY = y-21+(stride || (busy && (tick+s.variant)%5===1)?1:0);
  const eyesClosed=(tick+s.variant*7)%29===0;
  if(pose){
    box(x-8,y+9,16,2,'#52433558');
    if(pose.left){p.ctx.save();p.ctx.translate(2*x,0);p.ctx.scale(-1,1);}
  }
  box(x-5,y+1+stride,5,8,ink); box(x+2,y+1-stride,5,8,ink);
  box(x-4,y+2+stride,3,5,c.trousers); box(x+3,y+2-stride,3,5,c.trousers);
  box(x-5,y+7+stride,5,3,'#423e40'); box(x+2,y+7-stride,7,3,'#423e40');
  box(x-5,y+9+stride,5,1,'#9c876d'); box(x+2,y+9-stride,7,1,'#9c876d');
  box(x-6,y-10,12,12,ink); box(x-7,y-8,14,9,ink);
  box(x-5,y-9,10,10,c.shirt); box(x-5,y-8,3,8,c.fold); box(x-4,y,9,2,c.fold);
  box(x-1,y-9,5,2,'#f1d9ae'); box(x+1,y-7,2,6,c.fold);
  if(s.lead) { box(x+1,y-7,2,6, s.team==='claude'?'#f0d197':'#a9c9c7'); box(x-3,y-3,2,1,'#f6ddac'); }
  // Forearm bends towards the keyboard when a task is in progress.
  const prop=pose?.prop??deskProp;
  const handY = prop==='cup'?y-10:busy && (tick+s.variant)%2===0?y-8:y-6;
  box(x+5,y-8,3,6,ink); box(x+5,y-8,2,4,c.shirt);
  box(x+6,handY,5,3,c.skin); box(x+8,handY-1,3,1,'#eac39e');
  box(x-7,y-8,3,7,ink); box(x-6,y-7,2,4,c.fold); box(x-6,y-3,2,3,c.skin);
  box(x-4,headY-2,9,2,c.hair); box(x-6,headY,13,9,c.hair);
  box(x-5,headY+6,12,6,c.hair); box(x-3,headY+10,8,3,c.hair);
  box(x-2,headY+3,8,8,c.skin); box(x+1,headY+10,4,2,c.skin);
  box(x+6,headY+6,2,2,c.skin); box(x-4,headY+6,3,3,c.skin);
  box(x-5,headY+1,9,3,c.light); box(x-3,headY-1,6,2,c.light);
  if(s.variant===0 || s.variant===3) {
    box(x-6,headY+3,9,2,c.hair); box(x-2,headY+5,3,2,c.hair);
    box(x+4,headY+7,1,eyesClosed?1:2,'#493e3c');
    if(s.variant===3) box(x+2,headY+7,5,1,'#514b48');
  } else if(s.variant===1 || s.variant===4) {
    box(x-6,headY+2,14,2,c.hair); box(x+3,headY+3,4,1,c.light);
    box(x-1,headY+6,8,1,'#3f5053'); box(x+1,headY+7,2,2,'#4f6668'); box(x+5,headY+7,2,2,'#4f6668');
  } else {
    box(x-7,headY+5,3,9,c.hair); box(x-8,headY+7,3,5,c.light);
    box(x+2,headY+5,4,1,c.hair); box(x+4,headY+7,1,eyesClosed?1:2,'#554036');
    if(s.variant===5) { box(x-6,headY-4,5,4,c.hair); box(x-5,headY-4,3,2,c.light); }
  }
  box(x+4,headY+10,2,1,'#ac7460');
  if(prop) heldProp(p,prop,x+9,handY-3);
  if(pose?.left)p.ctx.restore();
  if(busy) {
    const dx=x+17+(tick%4)*2;
    box(dx,s.y-8,2,1,'#d1e9c5');
    const statusColor=agent.status==='delegated'?'#e1b264':'#83c5a0';
    box(s.x+31,s.y-11,4,4,ink); box(s.x+32,s.y-10,2,2,statusColor);
  }
}

function asList(input) {return Array.isArray(input)?input:Object.values(input||{});}

export function createOfficeScene(canvas, {onSelect=()=>{},onLife=()=>{}}={}) {
  canvas.width=WIDTH; canvas.height=HEIGHT;
  canvas.style.imageRendering='pixelated';
  const cache=document.createElement('canvas'); cache.width=WIDTH; cache.height=HEIGHT;
  backLayer(cache);
  const p=painter(canvas), ctx=p.ctx;
  let agents=new Map(desks.filter(s=>s.lead).map(s=>[s.id,{id:s.id,status:'idle'}]));
  let selected=null, hovered=null;
  let tick=0, timer=null, visible=true, dead=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const ambient=createOfficeLife();
  let roster=[], tasks=[], lifeEnabled=true, frame=null, previousLife='', positions=new Map();
  const deskProps=['cup','note','book','note','tools','cup'];
  function render() {
    if(dead) return;
    const now=performance.now();
    const animateLife=lifeEnabled&&visible&&!document.hidden;
    frame=ambient.step(now,roster,tasks,animateLife);
    positions=new Map();
    for(const [index,id] of (frame?.actors || []).entries()){
      const seat=desks.find(entry=>entry.id===id);
      const pose=stepPose(seat,frame,index,reduced.matches);
      if(pose)positions.set(id,pose);
    }
    const phase=frame && (frame.elapsed<frame.walk?'out':frame.elapsed>=frame.endsAt-frame.start-frame.walk?'back':'activity');
    const lifeKey=frame?[frame.id,phase,frame.speech?.key].join(':'):'';
    if(previousLife!==lifeKey){
      previousLife=lifeKey;
      const speaker=frame?.speech;
      const point=speaker && (positions.get(speaker.actor) || homePosition(desks.find(seat=>seat.id===speaker.actor)));
      onLife(frame?{actors:frame.actors,kind:frame.kind,action:frame.action,phase,
        speech:speaker?{...speaker,x:point.x/WIDTH,y:point.y/HEIGHT}:null}:null);
    }
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    ctx.drawImage(cache,0,0);
    const depth = seat=>positions.get(seat.id)?.y??homePosition(seat).y;
    for(const s of desks.toSorted((a,b)=>depth(a)-depth(b))) {
      const agent=agents.get(s.id);
      if(!agent)continue;
      const pose=positions.get(s.id);
      if(selected===s.id || hovered===s.id){
        const col=s.team==='claude'?'#9f593c':'#395f74';
        const center=Math.round(pose?.x??s.x-11), by=Math.round(pose?pose.y+3:s.y+36);
        const bx=center-9;
        p.box(bx,by,19,2,'#f9ebc7');p.box(bx+2,by,15,1,col);
        p.poly([[center-2,by+3],[center+3,by+3],[center,by+6]],col);
      }
      const deskProp=animateLife&&!reduced.matches&&agent.status==='idle'&&!frame?.actors.includes(s.id)&&
        (now+s.variant*2090)%(5100+s.variant*1140)<1250?deskProps[s.variant]:null;
      sitter(p,s,agent,tick,pose,deskProp);
    }
    const tip=desks.find(s=>s.id===hovered);
    if(tip && agents.has(tip.id) && frame?.speech?.actor!==tip.id) {
      const text=String(agents.get(tip.id).name || (tip.team===tip.id?tip.team:tip.id)).slice(0,21);
      ctx.font='bold 9px ui-monospace, "Microsoft JhengHei", monospace';
      const position=positions.get(tip.id);
      const center=position?.x??tip.x, top=Math.round(position?position.y-51:tip.y-28);
      const ww=Math.ceil(ctx.measureText(text).width)+10, left=Math.min(WIDTH-ww-2,Math.max(2,center-ww/2|0));
      p.box(left,top,ww,13,ink); p.box(left+1,top+1,ww-2,11,'#ffefd0');
      ctx.fillStyle=ink;ctx.textBaseline='top';ctx.fillText(text,left+5,top+2);
    }
  }
  function update(state={}) {
    if(state.agents) {
      roster=asList(state.agents);
      agents=new Map(roster.map(agent=>[agent.id,agent]));
    }
    if(state.tasks)tasks=state.tasks;
    if(typeof state.lifeEnabled==='boolean')lifeEnabled=state.lifeEnabled;
    if('selected' in state || 'selectedId' in state) {
      selected=state.selected??state.selectedId??null;
    }
    render();
    schedule();
  }
  function at(e) {
    const r=canvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*WIDTH/r.width,y:(e.clientY-r.top)*HEIGHT/r.height};
  }
  function hit({x,y}) {
    for(const [id,point] of positions) {
      if(Math.abs(x-point.x)<=12 && y>=point.y-34 && y<=point.y+4)return id;
    }
    return desks.find(s=>agents.has(s.id) && Math.abs(x-s.x)<36 && y>=s.y-16 && y<=s.y+35)?.id||null;
  }
  function move(e) {
    const id=hit(at(e));
    if(id!==hovered){hovered=id;render();}
    canvas.style.cursor=id?'pointer':'default';
  }
  function select(e) {
    const id=hit(at(e));
    if(id)onSelect(id);
  }
  function leave(){hovered=null;render();}
  function schedule() {
    clearTimeout(timer);
    if(dead||!visible||document.hidden||(!lifeEnabled&&reduced.matches))return;
    const busy=[...agents.values()].some(a=>workingStates.has(a.status));
    const moving=!reduced.matches&&[...positions.values()].some(pose=>pose.moving);
    timer=setTimeout(()=>{if(!reduced.matches)tick++;render();schedule();},
      moving?95:frame?180:busy?350:lifeEnabled?500:1100);
  }
  function refreshVisibility(){render();schedule();}
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;refreshVisibility();
  }):null;
  observer?.observe(canvas);
  const events={click:select,pointermove:move,pointerleave:leave};
  for(const [name,fn] of Object.entries(events))canvas.addEventListener(name,fn);
  document.addEventListener('visibilitychange',refreshVisibility);reduced.addEventListener('change',refreshVisibility);
  render();schedule();
  return {update,setState:update,destroy() {
    dead=true;clearTimeout(timer);observer?.disconnect();
    for(const [name,fn] of Object.entries(events))canvas.removeEventListener(name,fn);
    document.removeEventListener('visibilitychange',refreshVisibility);reduced.removeEventListener('change',refreshVisibility);
  }};
}
