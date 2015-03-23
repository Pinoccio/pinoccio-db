var test = require('tape');

test("can require lib",function(t){
  require('../');
  t.ok(1,'did require lib');
  t.end();
})
