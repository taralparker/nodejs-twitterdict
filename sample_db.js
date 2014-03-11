var Db = require('mongodb').Db;
var Server = require('mongodb').Server;

var config = require('./db_config');

var db = new Db(config.db, new Server(
   config.host,
   config.port,
   config.server_config), {safe:false});


var getCollection = function(db, collection, cb) {
  db.open(function(err, db) {
    if(err) throw err;
    db.authenticate(
       config.authenticate.user,
       config.authenticate.pass,function(err,res) {
       if(!err) {
         db.collection(collection, function(err, col) {
           if(err) throw err;
           // collection
           cb(col);
         });
       }
    });
  });
}


// Test Insert
// http://mongodb.github.io/node-mongodb-native/
var insert_test = function() {
  getCollection(db, config.collection, function(col) {
    col.insert({'hello':'world'}); 
    // Wait for a second before finishing up, to ensure the item is in the disk
    setTimeout(function() {
      col.findOne({'hello':'world'}, function(err, item) {
        if(err) throw err;
        console.log(item);
        db.close();
      });
    }, 1000);
  });
}

