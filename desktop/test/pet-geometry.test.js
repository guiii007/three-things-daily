const {test}=require('node:test');
const assert=require('node:assert/strict');
const {petDimensions,scaledShape}=require('../pet-geometry');
test('最小、默认、最大尺寸，像素点击区域缩放不越界',()=>{
  assert.deepEqual(petDimensions(20),{width:24,height:14});
  assert.deepEqual(petDimensions(100),{width:120,height:72});
  assert.deepEqual(petDimensions(200),{width:240,height:144});
  const source=[{x:0,y:7,width:4,height:1},{x:12,y:3,width:20,height:1},{x:36,y:7,width:4,height:1},{x:11,y:20,width:3,height:1}];
  for(let percent=20;percent<=200;percent++){
    const dimensions=petDimensions(percent),rects=scaledShape(source,percent);
    for(const r of rects){assert.ok(r.x>=0&&r.y>=0&&r.width>0&&r.height>0);assert.ok(r.x+r.width<=dimensions.width&&r.y+r.height<=dimensions.height);}
  }
  assert.deepEqual(scaledShape([{x:12,y:3,width:20,height:1}],200),[{x:72,y:18,width:120,height:6}]);
});

test('96×96 小鸡保持正方形比例，点击区域同步缩放',()=>{
  assert.deepEqual(petDimensions(100,96,96),{width:120,height:120});
  assert.deepEqual(petDimensions(200,96,96),{width:240,height:240});
  assert.deepEqual(scaledShape([{x:24,y:48,width:48,height:4}],200,96,96),[{x:60,y:120,width:120,height:10}]);
});
