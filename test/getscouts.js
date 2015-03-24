var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can get scouts "+__filename,function(t){
  var d = pdb(db());

  d.writeTroop({},function(err,troop){
    d.writeScout(troop.id,{name:"stu"},function(err,scout){
      t.equals(scout.name,'stu','scouts name should be stu');
      d.writeScout(troop.id,{},function(err,scout){
        d.getScouts(troop.id,function(err,scouts){

          t.ok(!err,'should not have error getting scouts');
          t.equals(scouts.length,2,'should have 2 scouts.');
          t.equals(scouts[0].id,1,'scout id should be 1');
          t.equals(scouts[1].id,2,'scout id should be 2');
          t.end();
        })
      });
    })
  })


});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
