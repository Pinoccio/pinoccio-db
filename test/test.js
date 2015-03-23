var test = require('tape');

test("can require lib "+__filename,function(t){
  require('../');
  t.ok(1,'did require lib');
  t.end();
})
