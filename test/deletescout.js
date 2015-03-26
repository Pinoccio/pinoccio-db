var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can get scouts "+__filename,function(t){
  var d = pdb(db());

  d.writeTroop({},function(err,troop){
    d.writeScout(troop.id,{name:"stu"},function(err,scout){
      d.get(troop.id,function(err,troop){
        t.ok(!err,'should not have error getting scouts');
        t.equals(Object.keys(troop.scouts).length,1,'should have 1 scout.');



        d.deleteScout(troop.id,Object.keys(troop.scouts)[0],function(err,scout){
          t.ok(!err,'should not have error deleting scout ('+err+')');
          d.get(troop.id,function(err,troop){
            t.equals(Object.keys(troop.scouts).length,0,'should return 0 scouts.');
            t.end();
          });
        });
      })
    })
  })


});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
