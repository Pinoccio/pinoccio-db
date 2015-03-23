var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test(__filename,function(t){
  var d = pdb(db());

  d.writeTroop({name:"bob"},function(err,obj){
    t.ok(!err,'should not have error adding troop');
    d.deleteTroop(obj.id,function(err,data){
      t.ok(!err,'should not have error deleting troop');
      t.ok(data.deleted,'should have set deleted flag');

      //TODO FETCH TROOPS AND MAKE SURE this one is excluded.

      t.end(); 
    });
  });


});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
