var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can make new troops "+__filename,function(t){
  var d = pdb(db());
  var seq = [
    function makeTroop(){
      d.writeTroop({name:'bob'},function(err,data){
        t.ok(!err,'should not have error ('+err+')');
        t.equals(data.id ,1,'should have id for new troop 1');
        t.equals(data.name,"bob","should have saved name");

        next();
      });
    },
    function makeTroop2(){
      d.writeTroop({name:'steve'},function(err,data){
        t.ok(!err,'should not have error ('+err+')');
        t.equals(data.id ,2,'should have id for new troop 2');
        t.equals(data.name,"steve","should have saved name");
        next();
      });
    }
  ],next = function(){
    if(seq.length) seq.shift()();
    else t.end();
  }

  next();

})


function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
