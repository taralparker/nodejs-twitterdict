var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var config = require('../db_config');
var fs = require('fs');
var csv = require('csv');

var db = new Db(config.db, new Server(config.host,config.port,
   config.server_config),{safe:false});

db.open(function(err, db) {
  var content_list = [];
  var bully_count =0;
  db.collection('text',function(err, collection) {
    collection.remove({},{w:1}, function(err, result) {
      console.log('removed '+result);
      csv().from.path(__dirname+'/content.csv', {delimiter:',', escape:'"'})
        .on('record', function(row, index) {
          var bully=false;
          if(row[17]=='Bully') {
            bully_count++;
            bully=true;
          }
          var twitter={'text':row[1],'bully':bully};
          content_list.push(twitter);
        })
        .on('end', function() {
          var count=0;
          content_list.forEach(function(item) {
            collection.insert(item, {w:1}, function(err, objects) {
              if(err) console.warn(err.message);
              count++;
              if(count==content_list.length) {
                console.log('inserted '+count);
                db.close();
              }
            });
          });
      });
    });
  });
}); 
