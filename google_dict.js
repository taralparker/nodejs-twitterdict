var google = require('./lib/google');

var natural = require('natural');
var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var config = require('./db_config');

// open mongolab database
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
};

// save doc to mongolab
var save = function(db,doc,callback) {
  db.collection(config.collection,function(err, collection) {
    var key = doc.key;
    collection.findOne({'key':key},function(err, r_doc) {
      if(err) throw err;
      if(r_doc) {
        for(k in doc) {
          if(k!='key') {
            r_doc[k] = doc[k];
          }
        }
        collection.save(r_doc, {safe:true}, function(err, result) {
          if(err) throw err;
          callback();
        });
      } else {
        collection.insert(doc,{safe:true},function(err,result) {
          if(err) throw err;
          callback();
        });
      }
    });
  });
};

var dict = {};

open(function(err, db) {
  google.search(config.keyword, function(err, page, next, links) {
    if(err) return;
    var count=0;
    var saved=0;
    for(var i=0;i<links.length;i++) {
      var cpage = links[i];
      if(cpage.href) {
        console.log(cpage.href);
        google.text(cpage.href, function(text) {
          var tfidf = new natural.TfIdf();
          tfidf.addDocument(text);
          tfidf.listTerms(0).forEach(function(item) {
            if(!/^\d+$/.test(item.term)) {
              var str='k.'+item.term;
              if(!dict[str]) {
                dict[str] = 1;
                console.log(count+' '+item.term);
                count++;
                save(db,{'key':item.term},function(err) {
                  saved++;
                  if(saved==count) {
                    db.close();
                  }
                  if(err) {
                    console.log(err);
                  }
                });
              }
            }
          });
        });   
      }
    }
  });
});

