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
          if(this.google_page) {
            emit('google_page',1);
          }
          if(this.google_page_keyword) {
            emit('google_page_keyword',1);
          }
          if(this.google_page && this.google_page_keyword) {
            emit('both',1);
          }
        };
        var reduce = function(k, vals) {
          var sum=0;
          for(var i=0;i<vals.length;i++) {
            sum+=vals[i];
          }
          return sum;
        };
        collection.mapReduce(map,reduce, {out:{inline:1},verbose:true},
          function(err,results,stats) {
          results.forEach(function(doc) {
            console.log(JSON.stringify(doc));
          });
          db.close();
        });
      });
    } else {
      throw new Error('Error on DB authentication');
    }
  });
}); 
