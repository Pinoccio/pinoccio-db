var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can get scouts "+__filename,function(t){
  var d = pdb(db());

  d.writeTroop({},function(err,troop){
    d.writeScout(troop.id,{name:"stu"},function(err,scout){
      d.getScouts(troop.id,function(err,scouts){
        t.ok(!err,'should not have error getting scouts');
        t.equals(scouts.length,1,'should have 1 scout.');

        d.deleteScout(troop.id,scouts[0].id,function(err,scout){
          t.ok(!err,'should not have error deleting scout ('+err+')');
          d.getScouts(troop.id,function(err,scouts){
            t.equals(scouts.length,0,'should return 0 scouts.');
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
