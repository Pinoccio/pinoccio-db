var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can get new troops "+__filename,function(t){
  var d = pdb(db());

  makeTroop(d,function(err,obj){
    t.ok(!err,'should not have error making troop');

    var seq = [
      function getTroopById(){
        d.getTroop(obj.id,function(err,data){
          t.equals(data.key,obj.key,'tokens should match if loaded by id');
          next();
        })
      },
      function getTroopByKey(){
        d.getTroop(obj.key,function(err,data){
          t.equals(data.id,obj.id,'ids should match if loaded by key');
          next();
        })
      }
    ],next = function(){
      if(seq.length) seq.shift()();
      else t.end();
    }

    next();
  });
})

function makeTroop(d,cb){
  d.writeTroop({name:'bob'},cb);
}

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
