var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var config = require('./db_config');

var db = new Db(config.db, new Server(
   config.host,
   config.port,
   config.server_config),{safe:false});
db.open(function(err, db) {
  if(err) throw err;
  db.authenticate(
     config.authenticate.user,
     config.authenticate.pass,function(err, res) {
    if(!err) {
      db.collection(config.collection,function(err, collection) {
        var map = function() {
          if(this.google_page && this.google_page_keyword) {
            emit(this.key,this.google_page_keyword/this.google_page);
          }
        };
        var reduce = function(k, vals) {
          return 1;
        };
        collection.mapReduce(map,reduce, {out:{inline:1},verbose:true},
          function(err,results,stats) {
          if(err) throw err;
          results.forEach(function(doc) {
            console.log(doc);
          });
          db.close();
        });
      });
    } else {
      throw new Error('Error on DB authentication');
    }
  });
}); 
