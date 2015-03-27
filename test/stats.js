var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test('stats stream sends all data and ends. '+__filename,function(t){
  var d = pdb(db());
  var w = d.saveReportsStream();


  w.write({troop:1,scout:1,report:"lalal",hi:Date.now()});
  w.write({troop:1,scout:1,report:"hi",hi:Date.now()});
  w.write({troop:1,scout:1,report:"hi",hi:Date.now()+1});
  w.write({troop:1,scout:1,report:"zugzug",hi:Date.now()});
  w.write({troop:1,scout:1,report:"hi",hi:Date.now()+2});

  w.end();

  var c = 0;

  var s = d.stats(1,1,"hi");
  s.on('data',function(data){
    ++c;
    t.ok(data.hi,'shoudl have hi property');
    t.equals(data.report,'hi','hi should be the report name');
  }).on('end',function(){
    t.end();
  });

});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
