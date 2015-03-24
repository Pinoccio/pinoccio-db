var level = require('level');
var sublevel = require('level-sublevel');
var livestream = require('level-live-stream');
var through2 = require('through2');
var crypto = require('crypto');
var xtend = require('xtend');
var uuid = require('node-uuid');
var bytewise = require('bytewise');
var ts = require('monotonic-timestamp');// for sequence ids.

module.exports = function(dir,opts){
  var db, sep = 'ÿ';
  if(dir && dir.createReadStream){
    db = dir;
  } else {
    db = level(dir,{valueEncoding:'json'});
    db = sublevel(db);
  }

  opts = opts||{};

  var o = {
    db:db,
    // a database always has a uuid that identifies it
    // whenever a db is referenced from some place outside it will need this uuid.
    _dbid:[],
    getId:function(cb){
      var z = this;
      if(opts.id) return setImmediate(function(){
        cb(false,opts.id);
      });

      if(z._dbid.length) return z._dbid.push(cb);
      z._dbid.push(cb);

      var cbs = function(err,data){
        var a = z._dbid;
        z._dbid = [];
        while(a.length) a.shift()(err,data);
      }

      db.get('id',function(err,id){
        if(err) {
          if((err+'').indexOf('NotFoundError') > -1){
            id = uuid.v4();
            db.put('id',id,function(err){
              if(err) return cbs(err);
              opts.id = id;
              cbs(false,id);
            });
          } else return cbs(err,id);
        }
        return cbs(false,id);
      });

    },
    getTroops:function(cb){
      var z = this;
      var out = [];
      z.db.createReadStream({start:"troops"+sep,end:"troops"+sep+sep}).on('data',function(data){
        if(data.key.indexOf(sep+'r'+sep) > -1) {
         // TODO put sync stream in the troop section. 
        } else {
          out.push(data.value);
        }
      }).on('error',function(err){
        cb(err);
      }).on('end',function(){
        out.sort(function(v1,v2){
          if(v1.id > v2.id) return 1;
          return o;
        })
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

      db.get("troops"+sep+id,function(err,data){
        if(err && (err+'').indexOf('NotFoundError') > -1){
          err.code = z.errors.notroop;
        }
        cb(err,data);
      });
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

          var afterKey = function(err,key){
            obj.key = key;
            if(err) return cb(err);
            z.db.put(prefix+obj.id,obj,function(err){
              if(err) return cb(err);
              cb(false,obj);
            });
          }

          // the key was provided.
          if(obj.key && obj.key.length === 32){
            return afterKey(false,obj.key);
          }

          z.assignTroopKey({id:obj.id},afterKey);

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
    _deletes:{},
    deleteTroop:function(id,cb){
      // i make sure the troop exists and all i do is set a deleted flag to the time on the troop's object.
      var z = this;
      var prefix = "troops"+sep;

      if(z._deletes[id]) return z._deletes[id].push(cb);
      z._deletes[id] = [cb];

      z.getTroop(id,function(err,data){
        if(err) return cbs(err)
        // if it's deleted already do nothing.
        if(data.deleted) return cbs(false,data);

        data.deleted = Date.now();

        z.db.put(prefix+data.id,data,function(err){
          cbs(err,data);
        }); 
      });

      function cbs(err,data){
        var a = z._deletes[id];
        delete z._deletes[id];
        while(a.length) a.shift()(err,data);
      }
    },
    writeScout:function(troop,obj,cb){
      var z = this;
      var prefix = "troops"+sep+troop+sep;
      z.getTroop(troop,function(err,troop){
        if(err) return cb(err);
        // get troop supports key as weel as id so make sure i pass on id.
        troop = troop.id;
        if(!obj.id) {
          z.getNextId("troops"+sep+troop,function(err,id){
            if(err) return cb(err);
            obj.id = id;
            obj.troop = troop;
            db.put(prefix+id,obj,function(err,data){
              cb(err,obj);
            });
          })
        } else {
          z.getScout(troop,obj.id,function(err,data){
            if(err && err.code !== z.errors.noscout) {
              return cb(err);
            }

            obj = xtend(data||{},obj);
            obj.troop = troop;
            db.put(prefix+obj.id,obj,function(err,data){
              cb(err,obj);
            });
          });
        }
      });
    },
    deleteScout:function(troop,id,cb){
      var z = this;
      var prefix = "troops"+sep+troop+sep;
      z.getScout(troop,id,function(err,obj){
        if(err) return cb(err);
        obj.deleted = Date.now();
        db.put(prefix+id,obj,function(err){
          cb(err,obj);
        })
      }) 
    },
    getScout:function(troop,id,cb){
      var z = this;
      var prefix = "troops"+sep+troop+sep;

      if(!id || !troop) return process.nextTick(function(){
        var e = new Error('troop and id required to get scout');
        e.code = z.errors.noid;
        cb(e);
      });

      z.db.get(prefix+id,function(err,data){
        if(err && (err+'').indexOf('NotFoundError') > -1){
          err.code = z.errors.noscout;
        }
        cb(err,data);
      }); 
    },
    getScouts:function(troop,cb){
      var z = this;
      var out = [];
      z.db.createReadStream({start:"troops"+sep+troop+sep,end:"troops"+sep+troop+sep+sep}).on('data',function(data){
        if(data.key.indexOf(sep+'r'+sep) > -1) {
         // TODO put sync stream in the scout data 
        } else if(!data.value.deleted){
          out.push(data.value);
        }
      }).on('error',function(err){
        cb(err);
      }).on('end',function(){
        out.sort(function(v1,v2){
          if(v1.id > v2.id) return 1
          return 0;
        });
        cb(false,out);
      });   
    },
    sync:function(options){
      var z = this;
      // todo support non live.
      //
      var deleted = {
        troops:{},
        scouts:{}
      };
      
      var live = livestream(cb,{start:"troops"+sep,end:"troop"+sep+sep,old:true}).on('sync',function(){
        this.emit('data',{sync:true});
        // this event lets remote connections know when the state is "true".
      });
      

      var s = through2.obj(function(data,enc,cb){

        var chunks = data.key.split(sep);
        var troop = chunks[1];
        var scout = chunks[2];
        var report = chunks[4];

        // filter deleted troops and scouts. yeah i need to do this. it's the only reason you would delete troops.
        if(report){
          // a report.
          if(deletes.troops[troop] || deletes.scouts[troop+sep+scout]){
            return cb();
          }
        } else if(scout){
          // scout data object
          if(deletes.troops[troop]){
            return cb();
          }

          if(data.deleted) {
            deletes.scouts[troop+sep+scout] = 1;
            return cb();
          }
          // make this a scout report
          data = {report:"scout-data",data:data,t:ts(),scout:scout,troop:troop};
        } else if(troop){
          // troop data object
          if(data.deleted) {
            deletes.troops[troop] = 1;
            return cb();
          }
          // make this a troop report.
          data = {report:"troop-data",data:data,t:ts(),troop:troop};
        } else {
          return cb();
        }

        // filter stale? no. if i can do it from this data they can.
        this.push(data);
        cb();
      })

      // can't leave errors unbound
      live.on('error',function(err){
        s.emit('error',err);
      });

      return live.pipe(s);
    },
    stats:function(){
      
    },
    validateReport:function(report){
      // a report needs.
      if(!report.troop) return false;
      if(!report.scout) return false;
      if(!report.report) return false;
      return true;
    },
    saveReportsStream:function(){
      var z = this;
      var s = through2.obj(function(data,enc,cb){
        if(!data) return cb();// skip empty events.
        if(!this.validateReport(data)) {
          var e = new Error('invalid report object. missing required troop,scout or report '+JSON.stringify(report));
          e.code = z.errors.invalidreport;
          return this.emit('error',e);
        }
        // insert into sync section and stats section
        // {troop:,report:,scout:,data:,_t:}
        
        //
        // We want to find a way to use the board's internal event timestamp for absolute ordering/deduping but 
        //  i have a few parts to make before that can be true. 
        // without that you can never compare samples that have a greater rate than the latency to get to the server
        //
        data.t = ts();

        var key = "troops"+sep+troopId+sep+data.scout+sep+'r'+sep+report;
        var history = "tlog"+sep+troopId+sep+data.scout+sep+report+sep+bte(data._t);
        // update the live view
        this.push({type:"put",key:key,value:data});
        // update the history log
        this.push({type:"put",key:history,value:data});
        cb();
      });

      s.pipe(db.writeStream()).on('error',function(err){
        s.emit('error',err);
      });

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
          });
        }
      });
    }, 
    errors:{notroop:"NoTroop",key:"NoKeyId",noid:"MissingId",noscout:"NoScout",invalidreport:"InvalidReportObject"}
  }


  return o;

}


function bte(v){
  return bytewise.encode(v).toString('hex');
}

function btd(v){
  return bytewise.decode(new Buffer(v,'hex'));
}
