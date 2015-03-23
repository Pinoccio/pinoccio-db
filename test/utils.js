var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("do utils work. "+__filename,function(t){
  var d = db();

  d.put('hi',2,function(){
    d.get('hi',function(err,data){
      t.equals(data,2,'should have 2 from database');
      t.end();
    })
  })




});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
