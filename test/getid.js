var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var pdb = require('../');

test("can get database uuid "+__filename,function(t){
  var d = pdb(db());

  d.getId(function(err,id){
    t.ok(!err,'should not have error ('+err+')');
    t.ok(id,'should have id '+id);
    t.end();
  })


});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
