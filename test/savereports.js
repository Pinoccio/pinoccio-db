var test = require('tape');
var level = require('levelup');
var memd = require('memdown');

var spigot = require('stream-spigot')

var pdb = require('../');

test('save reports'+__filename,function(t){
  var d = pdb(db());

  var s = d.saveReportsStream();


  var events = {};

  var em = s.emit;
  s.emit = function(ev,data){

    if(!events[ev]) events[ev] = 0;
    events[ev]++;
    if(ev === 'data') console.log(data);
    return em.apply(this,arguments);
  }

  //
  spigot({objectMode: true},[
    {troop:1,scout:1,report:"hi",data:1,t:1}
    ,{troop:1,scout:1,report:"hi",data:1,t:2}    
    ,{troop:1,scout:1,report:"hi",data:1,t:3}    
  ]).pipe(s).on('finish',function(){
    t.equals(events.data,6,'should have had 6 data events');
    t.end(); 
  });

});

function db(){
  return level('',{db:memd,valueEncoding:'json'});
}
