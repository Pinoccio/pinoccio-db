var level = require('level');
var sublevel = require('level-sublevel');
var livestream = require('level-live-stream');
var through2 = require('through2');
var crypto = require('crypto');
var xtend = require('xtend');
var uuid = require('node-uuid');
var bytewise = require('bytewise');
var ts = require('monotonic-timestamp');// for sequence ids.
var LevelWriteStream = require("level-write-stream")

module.exports = function(dir,opts){
  var db, sep = 'ÿ';
  if(dir && dir.createReadStream){
    db = dir;
  } else {
    db = level(dir,{valueEncoding:'json'});
    db = sublevel(db);
  }

  if(!db.createWriteStream) {
    db.createWriteStream = LevelWriteStream(db)
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
    getTroopData:function(id,cb){
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

      console.log('writing new  troop',obj);

      var z = this;
      var prefix = "troops"+sep;
      var id = obj.troop||obj.id;

      if(!id) {
        // make troop
        z.getNextId('troops',function(err,id){
          
          if(err) return cb(err);
          obj.id = obj.troop = id;

          var afterKey = function(err,key){
            obj.key = key;
            if(err) return cb(err);
            z.db.put(prefix+obj.id,obj,function(err){
              if(err) return cb(err);
              cb(false,obj);
              console.log('cb with ',obj);
            });
          }

          // the key was provided.
          if(obj.key && obj.key.length === 32){
            console.log('key passed in!',obj.key);
            return afterKey(false,obj.key);
          }

          z.assignTroopKey({id:obj.id},afterKey);

        });
      } else {
        z.getTroopData(id,function(err,data){
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

      z.getTroopData(id,function(err,data){
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
      z.getTroopData(troop,function(err,troop){
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
          z.getScoutData(troop,obj.id,function(err,data){
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
      z.getScoutData(troop,id,function(err,obj){
        if(err) return cb(err);
        obj.deleted = Date.now();
        db.put(prefix+id,obj,function(err){
          cb(err,obj);
        })
      }) 
    },
    getScoutData:function(troop,id,cb){
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
    // generic get any current data for troops, a troop, scouts, a scout
    get:function(/*troop,scout,*/cb){
      var z = this;
      var args = [].slice.call(arguments);
      var cb = args.pop();
      var troop = args.shift();
      var scout = args.shift();

      var result = {};
      var range = "";
      if(scout) range = troop+sep+scout;
      else if (troop) range = ''+troop;

      z.sync({range:range}).on('data',function(data){

        if(data.report == "troop-data"){
          if(data.deleted) return;
          if(!result[data.troop]) result[data.troop] = data.data;

          data.data.scouts = {};
          data.data.reports = {};
        } else if(data.report == "scout-data"){
          if(!result[data.troop]) return;
          if(!result[data.troop].scouts[data.scout]) result[data.troop].scouts[data.scout] = data.data;
          data.data.reports = {};

        } else if(data.report) {
          if(!result[data.troop]) return;
          if(!result[data.troop].scouts[data.scout]) return;

          if(data.scout){
            result[data.troop].scouts[data.scout].reports[data.report] = data;
          } else { 
            result[data.troop].reports[data.report] = data;
          }
        }

      }).on('end',function(){
        if(troop){
          result = result[troop];
          if(scout && result){
            result = result.scouts[scout];
          }
        }

        cb(false,result);
        cb = function(){};
      }).on('error',function(err){
        cb(err);
        cb = function(){};     
      });

    },
    sync:function(options){
      var z = this;
      var deletes = {};
      var range = options.range||'';
      if(range.join) range = range.join(sep);

      var opts = {start:"troops"+sep+range,end:"troops"+sep+range+sep+sep};

      var stream;

      if(options.tail) {
        opts.old = true;
        stream = livestream(z.db,opts).on('sync',function(){
          this.emit('data',{sync:true});
          // this event lets you know when this stream has sent all of the events that have happened...
          // and is starting to wait for new events to happen
        });
      } else {
        stream = z.db.createReadStream(opts);
      }

      var s = through2.obj(function(data,enc,cb){
        // sync event from live stream.
        if(data.sync){
          this.push(data);
          return cb()
        }
        var chunks = data.key.split(sep);
        var troop = chunks[1];
        var scout = chunks[2];
        var report = chunks[4];

        // filter deleted troops and scouts. yeah i need to do this. it's the only reason you would delete troops.
        if(report){
          data = data.value;
          // a report.
          if(deletes[troop] || deletes[troop+sep+scout]){
            return cb();
          }
        } else if(scout) {
          // scout data object
          if(deletes[troop]) {
            return cb();
          }

          if(data.value.deleted) {
            deletes[troop+sep+scout] = 1;
            return cb();
          } else if(deletes[troop+sep+scout]) {
            // un-delete
            delete deletes[troop+sep+scout];
          }
          // make this a scout report
          data = {report:"scout-data",data:data.value,t:ts(),scout:scout,troop:troop};
        } else if(troop) {
          // troop data object
          if(data.value.deleted) {
            deletes[troop] = 1;
            return cb();
          } else if(deletes[troop]) {
            // un-delete
            delete deletes[troop];
          }
          // make this a troop report.
          data = {report:"troop-data",data:data.value,t:ts(),troop:troop};
        } else {
          return cb();
        }

        // filter stale? no. if i can do it from this data they can.
        this.push(data);
        cb();
      })

      // can't leave errors unbound
      stream.on('error',function(err){
        s.emit('error',err);
      });

      return stream.pipe(s);
    },
    stats:function(troop,scout,options){
      if(typeof options == "string") options = {report:options};
      options = options||{};
      var report = options.report; // the report or reports you want to stream.
      var start = options.start||0; // the time t start streaming historical data.
      var end = options.end; // the time to stop sending historical data.
      var tail = options.end?false:options.tail;// keep streaming live after end has been reached.

      if(!end) end = sep;
      else end = bte(+end);

      var prefix = "tlog"+sep+troop+sep+scout+sep+report+sep;
      var opts = {start:prefix+bte(+start),end:prefix+end};
      
      // do this.
      var z = this;
      var stream;
      if(tail) {
        opts.old = true;
        
        stream = livestream(z.db,opts).on('sync',function(){
          this.emit('data',{value:{sync:true}});
        });
      } else {
        stream = z.db.createReadStream(opts)
      }

      var s = through2.obj(function(data,enc,cb){
        this.push(data.value);
        cb(); 
      });

      // can't leave errors unbound
      stream.on('error',function(err){
        s.emit('error',err);
      });

      return stream.pipe(s);
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
        if(!z.validateReport(data)) {
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

        var key = "troops"+sep+data.troop+sep+data.scout+sep+'r'+sep+data.report;
        var history = "tlog"+sep+data.troop+sep+data.scout+sep+data.report+sep+bte(data.t);
        // update the live view
        this.push({type:"put",key:key,value:data});
        // update the history log
        this.push({type:"put",key:history,value:data});
        cb();
      });


      s.pipe(db.createWriteStream()).on('error',function(err){
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
  if(isNaN(v)) v = 0;
  return bytewise.encode(v).toString('hex');
}

function btd(v){
  return bytewise.decode(new Buffer(v,'hex'));
}
