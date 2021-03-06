var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can get list of troops "+__filename,function(t){
  var d = pdb(db());

  d.writeTroop({name:'hi'},function(){
    d.writeTroop({name:'ho'},function(){
      d.get(function(err,troops){
        t.equals(troops[1].name,'hi','troop 1 name should match');
        t.equals(troops[2].name,'ho','troop 2 name should match');
        t.end();
      });
    })
  })


});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
