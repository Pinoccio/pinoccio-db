var through = require('through')
var level = require('level');
var sublevel = require('level-sublevel');
var livestream = require('level-live-stream');
var crypto = require('crypto');
var xtend = require('xtend');
var uuid = require('node-uuid');

// bam
module.exports = function(dir){
  var db, sep = 'ÿ';
  if(dir && dir.createReadStream){
    db = dir;
  } else {
    db = level(dir,{valueEncoding:'json'});
    db = sublevel(db);
  }
  var o = {
    db:db,
    // a database always has a uuid that identifies it 
    getId:function(cb){
      
    },
    getTroops:function(cb){
      var z = this;
      var out = {};
      z.db.createReadStream({start:"troops"+sep,end:"troops"+sep+sep}).on('data',function(data){
        if(data.key.indexOf('sync'+sep) > -1) {
         // TODO put sync stream in the troop section. 
        } else {
          out[data.value.id] = data.value;
        }
      }).on('error',function(err){
        cb(err);
      }).on('end',function(){
        cb(false,out);
      });
    },
    getTroop:function(id,cb){
      var z = this;
      if(!id) return process.nextTick(function(){
        var e = new Error('id or key required to get troop');
        e.code = z.errors.noid;
        cb(e);
      });

      if(id.length == 32) {
        z.getTroopIdFromKey(id,function(err,id){
          if(err) return cb(err);
          db.get("troops"+sep+id,cb);
        });
        return;
      }

      db.get("troops"+sep+id,cb);

    },
    writeTroop:function(obj,cb){
      // create and or update a troop.
      obj = obj||{};

      var z = this;
      var prefix = "troops"+sep;
      var id = obj.troop||obj.id;

      if(!id) {
        // make troop
        z.getNextId('troops',function(err,id){
          
          if(err) return cb(err);
          obj.neverConnected = true;
          obj.id = obj.troop = id;
          z.assignTroopKey({id:obj.id},function(err,key){
            obj.key = key;
            if(err) return cb(err);
            z.db.put(prefix+obj.id,obj,function(err){
              if(err) return cb(err);
              cb(false,obj);
            });
          });         
        });
      } else {
        z.getTroop(id,function(err,data){
          if(err){
            if(err.code != z.errors.notroop) return cb(err);

            // if id is manually provided.

            obj.neverConnected = true;
            obj.troop = obj.id = id;
            // if key is present is gets force assigned to this mystery troop.
            z.assignTroopKey({id:obj.id,key:obj.key},function(err,key){
              if(err) return cb(err);
              obj.key = key;
              z.db.put(prefix+obj.id,obj,function(err){
                if(err) return cb(err);
                cb(false,obj);
              });
            });
            return;
          }

          obj = xtend(data||{},obj);

          // i dont care if this troop id is the next increment just save a troop at this id.
          obj.troop = obj.id = id;

          z.db.put(prefix+obj.id,obj,function(err){
            if(err) cb(err);
            cb(false,obj);
          });
        });
      }
    },
    deleteTroop:function(){
      // this writes a troop id \0 key to the db. this causes getTroops to skip it unless a deletes option is passed.

    },
    sync:function(options){
      // TODO 

      var z = this;
      // todo support non live.
      return livestream(cb,{start:"troops"+sep,end:"troop"+sep+sep,old:true}).pipe(through(function(){
        // filter stale
        // filter dleted troops anmd scouts.
      }));
    },
    saveReportsStream:function(troopId){
      var z = this;
      var s = through(function(data){
        // set troop id in incomming reports
        data.troop = troopId;
        // insert into sync section and stats section
        //TODO
      });

      s.pipe(db.writeStream());

      return s;
    },
    assignTroopKey:function(obj,cb){
      obj = obj||{};
      var z = this;
      if(!obj.id) return process.nextTick(function(){
        var e = new Error("missing required troop id assigning troop key");
        e.code = z.errors.key;
        cb(e);
      });

      var key = crypto.createHash('md5').update(crypto.randomBytes(210)).digest().toString('hex');
      if(obj.key) key = obj.key;
      z.db.put("key"+sep+key,obj.id,function(err){
        if(err) return cb(err);
        cb(false,key);
      });
    },
    getTroopIdFromKey:function(key,cb){
      this.db.get('key'+sep+key,cb);
    },
    getNextId:function fn(key,cb){
      key = 'ids'+sep+key;

      if(!fn.running) fn.running = {};
      if(fn.running[key]) return fn.running[key].push(cb); 
      fn.running[key] = [];

      db.get(key,function(err,value){

        if(err) {
          if((err+'').indexOf('NotFoundError') === -1){
            return cb(err);
          } else {
            value = 0;
          }
        }

        putKey(value+1,cb);

        function putKey (value,cb){
          db.put(key,value,function(err){
            if(fn.running[key].length){
              putKey(1+value,fn.running[key].shift());
            } else {
              delete fn.running[key];
            }
            cb(err,value);
          })
        }
      });
    }, 
    errors:{notroop:"NoTroop",key:"NoKeyId",noid:"NoTroopId"}
  }


  return o;

}

