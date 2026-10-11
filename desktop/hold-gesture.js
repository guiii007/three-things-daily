class HoldGesture {
  constructor(point,bounds,startedAt=Date.now()) { this.point=point;this.bounds=bounds;this.startedAt=startedAt;this.picked=false;this.moved=false;this.ended=false; }
  sample(point,down,now=Date.now()) {
    if(this.ended)return {phase:'idle'};
    const dx=point.x-this.point.x,dy=point.y-this.point.y;
    if(Math.hypot(dx,dy)>10)this.moved=true;
    const position={...this.bounds,x:this.bounds.x+dx,y:this.bounds.y+dy};
    if(!down){this.ended=true;return {phase:this.picked?'released':this.moved?'idle':'tap',position:this.picked?position:null};}
    if(!this.picked&&now-this.startedAt>=500){this.picked=true;return {phase:'picked',position};}
    return {phase:this.picked?'dragging':'holding',position:this.picked?position:null};
  }
}
module.exports={HoldGesture};
