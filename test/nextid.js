var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can generate increment ids serially",function(t){
  var d = pdb(db());
  
  // can get next id serially.
  d.getNextId('hi',function(err,id){

    t.equals(id,1,'id should be 1');

    d.getNextId('hi',function(err,id){
      
      t.equals(id,2,'id should be 2');
      t.end();
    });
  });

});


test("can generate increment ids in parallel",function(t){
  var d = pdb(db());
  t.plan(2);
  d.getNextId('hi',function(err,id){
    t.equals(id,1,'id should be 1');
  });

  d.getNextId('hi',function(err,id){
    t.equals(id,2,'id should be 2');
  });

});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
