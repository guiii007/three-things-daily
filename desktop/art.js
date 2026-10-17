const palettes=[{main:'#ee7d87',shade:'#ce5d79',shine:'#ffc2b7'},{main:'#eec669',shade:'#cca249',shine:'#ffe7ae'},{main:'#8bc99c',shade:'#65a585',shine:'#c8e9b8'}];
  function drawCapsule(canvas,index){
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,40,24);ctx.save();ctx.translate(4,0);
    const p=palettes[index],ink='#604555',cream='#fff0d0',dot=(x,y,c,w=1,h=1)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
    const spans=[[8,23],[6,25],[4,27],[3,28],[2,29],[2,29],[2,29],[2,29],[2,29],[2,29],[3,28],[4,27],[6,25],[8,23]];
    spans.forEach(([l,r],row)=>{for(let x=l;x<=r;x++){const prev=spans[row-1],next=spans[row+1];const edge=x===l||x===r||!prev||!next||x<prev[0]||x>prev[1]||x<next[0]||x>next[1];dot(x,row+3,edge?ink:(x<15?(row>9?p.shade:p.main):cream));}});
    dot(7,5,p.shine,5);dot(5,6,p.shine,3);dot(4,7,p.shine);dot(14,5,p.shade,1,10);
    dot(18,8,ink,2,3);dot(25,8,ink,2,3);dot(18,8,'#fff9ed');dot(25,8,'#fff9ed');
    dot(17,12,'#eca4a0',2);dot(27,12,'#eca4a0',2);
    dot(20,12,ink);dot(24,12,ink);dot(21,13,ink,3);
    dot(8,17,ink,2,3);dot(22,17,ink,2,3);dot(7,20,ink,3);dot(22,20,ink,3);
    ctx.restore();
    // 两条向上弯的小手臂，接上奶油色的像素手套。
    dot(3,10,ink,2);dot(4,11,ink,2);dot(5,12,ink,2);
    dot(1,6,ink,2);dot(0,7,ink,4,3);dot(1,10,ink,3);
    dot(1,7,cream,2,2);dot(2,9,cream);dot(0,9,cream);
    dot(35,10,ink,2);dot(34,11,ink,2);dot(33,12,ink,2);
    dot(37,6,ink,2);dot(36,7,ink,4,3);dot(36,10,ink,3);
    dot(37,7,cream,2,2);dot(37,9,cream);dot(39,9,cream);
  }
  function drawSmile(canvas){
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,36,36);
    const dot=(x,y,c,w=1,h=1)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
    const inside=(x,y)=>(x-17.5)**2+(y-17.5)**2<=15.5**2;
    for(let y=0;y<36;y++)for(let x=0;x<36;x++)if(inside(x,y)){const edge=!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1);dot(x,y,edge?'#c58b49':(y>27?'#f2c174':'#ffe4a1'));}
    dot(9,6,'#fff4ce',5);dot(7,7,'#fff4ce',3);dot(6,8,'#fff4ce',2);
    const ink='#72514f';[[9,15],[10,14],[11,13],[12,13],[13,14],[14,15],[21,15],[22,14],[23,13],[24,13],[25,14],[26,15]].forEach(([x,y])=>dot(x,y,ink));
    dot(6,18,'#eca59c',5,2);dot(25,18,'#eca59c',5,2);
    [[11,23],[12,24],[13,25],[14,26],[15,26],[16,27],[17,27],[18,27],[19,27],[20,26],[21,26],[22,25],[23,24],[24,23]].forEach(([x,y])=>dot(x,y,ink));
  }

function drawCompanion(canvas,task,companions) {
  const pack=companions.find(p=>p.id===task.skin);
  if(!pack||pack.id==='capsule'){canvas.width=40;canvas.height=24;drawCapsule(canvas,task.slot);return;}
  canvas.width=pack.width;canvas.height=pack.height;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  pack.frames.idle.forEach((row,y)=>[...row].forEach((key,x)=>{if(key==='.')return;const color=pack.palette[key];ctx.fillStyle=color.startsWith('$')?palettes[task.slot][color==='$primary'?'main':color.slice(1)]:color;ctx.fillRect(x,y,1,1);}));
}
function drawCompanionSVG(svg,task,companions) {
  const source=document.createElement('canvas');source.width=40;source.height=24;drawCompanion(source,task,companions);
  const width=source.width,height=source.height;svg.setAttribute('viewBox','0 0 '+width+' '+height);
  const pixels=source.getContext('2d').getImageData(0,0,width,height).data,fragment=document.createDocumentFragment();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const offset=(y*width+x)*4;if(!pixels[offset+3])continue;
    const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
    for(const [name,value] of Object.entries({x,y,width:1,height:1,fill:'rgb('+pixels[offset]+','+pixels[offset+1]+','+pixels[offset+2]+')'}))rect.setAttribute(name,value);
    fragment.append(rect);
  }
  svg.replaceChildren(fragment);return {pixels,width,height};
}
