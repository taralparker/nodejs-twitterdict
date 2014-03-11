var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var config = require('./db_config');

var db = new Db(config.db, new Server(
   config.host,
   config.port,
   config.server_config),{safe:false});
db.open(function(err, db) {
    db.collection(config.collection,function(err, collection) {
      collection.find().toArray(function(err, docs) {
        if(err) throw err;
        var google=0;
        var google_w=0;
        docs.forEach(function(doc) {
          console.log(doc);
          if(doc.google_page) google++;
          if(doc.google_page_keyword) google_w++;
        });
        console.log('Doc '+docs.length);
        console.log('google_page '+google);
        console.log('google_page_keyword '+google_w);
        db.close();
    });
  });
}); 
