var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var config = require('./db_config');
var google = require('./lib/google');

var open = function(callback) {
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
        callback(null, db);
      } else {
        throw new Error('Error on DB authentication');
      }
    });
  }); 
}

var google_page = function() {
  open(function(err, db) {
    if(err) throw err;
    db.collection(config.collection,function(err, collection) {
      collection.findOne({
       'google_page':{$exists:false}
      },function(err, doc) {
        if(doc) {
        google.search(doc.key, function(err, page, next, links) {
          if(err) throw err;
          doc['google_page']=page;
          doc['time']=new Date();
          collection.save(doc,function(err, result) {
            if(err) throw err;
            console.log(doc);
            db.close();
          });
        });
        } else {
          db.close();
        }
      });
    });
  });
};

var google_page_keyword = function() {
  open(function(err, db) {
    if(err) throw err;
    db.collection(config.collection,function(err, collection) {
      collection.findOne({
       'google_page_keyword':{$exists:false}
      },function(err, doc) {
        if(doc) {
        google.search(doc.key+' '+config.keyword, 
          function(err, page, next, links) {
          if(err) throw err;
          doc['google_page_keyword']=page;
          doc['time']=new Date();
          collection.save(doc,function(err, result) {
            if(err) throw err;
            console.log(doc);
            db.close();
          });
        });
        } else {
         db.close();
        }
      });
    });
  });
};

var wtime=(Math.random()*20+40)*1000;
console.log('sleep '+wtime+' ms');
setInterval(google_page,wtime);
setInterval(google_page_keyword,wtime+20*1000);

