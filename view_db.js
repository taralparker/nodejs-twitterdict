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
        collection.find().toArray(function(err, docs) {
          if(err) throw err;
          docs.forEach(function(doc) {
            console.log(doc);
          });
          console.log(docs.length);
          db.close();
        });
      });
    } else {
      throw new Error('Error on DB authentication');
    }
  });
}); 
