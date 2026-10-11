const {test}=require('node:test'),assert=require('node:assert/strict');
const {HoldGesture}=require('../hold-gesture');
const start={x:100,y:100},bounds={x:350,y:350,width:120,height:72};
test('轻点松手立即打开，没有双击等待时间',()=>{
  const g=new HoldGesture(start,bounds,1000);assert.equal(g.sample(start,true,1100).phase,'holding');assert.equal(g.sample(start,false,1150).phase,'tap');assert.equal(g.sample(start,false,1200).phase,'idle');
});
test('按住半秒捏起，持续移动，松手用最后的屏幕位置落下',()=>{
  const g=new HoldGesture(start,bounds,1000);assert.equal(g.sample(start,true,1499).phase,'holding');assert.equal(g.sample(start,true,1500).phase,'picked');
  const moved=g.sample({x:-800,y:1000},true,1600);assert.equal(moved.phase,'dragging');assert.equal(moved.position.x,-550);assert.equal(moved.position.y,1250);
  const released=g.sample({x:-780,y:1020},false,1620);assert.equal(released.phase,'released');assert.equal(released.position.x,-530);assert.equal(released.position.y,1270);
  assert.equal(g.sample(start,false,1630).phase,'idle');
});
test('短按快速划动不会误弹面板，也不会进入摆放',()=>{
  const g=new HoldGesture(start,bounds,0);assert.equal(g.sample({x:130,y:100},true,150).phase,'holding');assert.equal(g.sample({x:130,y:100},false,200).phase,'idle');assert.equal(g.picked,false);
});
test('长按原地松手仍是放下，不误触任务面板',()=>{
  const g=new HoldGesture(start,bounds,0);assert.equal(g.sample(start,true,550).phase,'picked');assert.equal(g.sample(start,false,600).phase,'released');
});
