var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var config = require('./db_config');

var dict_db = function() {
};

dict_db.open = function(callback) {
  var db = new Db(config.db, new Server(
    config.host,
    config.port,
    config.server_config),{safe:false});
  db.open(function(err, db) {
    if(err) {
      callback(err,null);
    } else {
      db.authenticate(
         config.authenticate.user,
         config.authenticate.pass,function(err, res) {
        if(!err) {
          callback(null, db);
        } else {
          callback(new Error('Error on DB authentication'),null);
        }
     });
   }
  });
};

dict_db.save = function(db,doc,callback) {
  db.collection(config.collection,function(err, collection) {
    var key = doc.key;
    collection.findOne({'key':key},function(err, r_doc) {
      if(r_doc) {
        for(k in doc) {
          if(k!='key') {
            r_doc[k] = doc[k];
          }
        }
        collection.save(r_doc, {safe:true}, function(err, result) {
          if(!err) {
            callback(null);
          } else {
            callback(err);
          }
        });
      } else {
        collection.insert(doc,{safe:true},function(err,result) {
          if(!err) {
            callback(null);
          } else {
            callback(err);
          }
        });
      }
    });
  });
}


module.exports = dict_db;
