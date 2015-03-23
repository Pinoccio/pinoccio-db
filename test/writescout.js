var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can make new troops",function(t){
  var d = pdb(db());

  //
  d.writeTroop({},function(err,troop){
    d.writeScout(troop.id,{name:'happy'},function(err,scout){
      t.ok(!err,'should not have error from writeScout');
      d.getScout(troop.id,scout.id,function(err,data){
        t.ok(!err,'should not have error from getScout');
        t.equals(scout.troop,troop.id,'scout troop id should match');
        t.equals(scout.id,1,'scout id should be 1');
        t.end();
      })
    })
  });

});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
