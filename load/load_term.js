var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var config = require('../db_config');
var fs = require('fs');
var csv = require('csv');

var db = new Db(config.db, new Server(config.host,config.port,
   config.server_config),{safe:false});

db.open(function(err, db) {
  var term_list = [];
  db.collection('term',function(err, collection) {
    collection.remove({'init':true},{w:1}, function(err, result) {
      console.log('removed '+result);
      csv().from.path(__dirname+'/terms.csv', {delimiter:',', escape:'"'})
        .on('record', function(row, index) {
          var tmp = {'term':row[0],
            'init':true,
            'support':parseFloat(row[1]),
            'confidence':parseFloat(row[2])};
          term_list.push(tmp);})
        .on('end', function() {
          var count=0;
          term_list.forEach(function(term_item) {
            collection.insert(term_item, {w:1}, function(err, objects) {
              if(err) console.warn(err.message);
              count++;
              if(count==term_list.length) {
                console.log('inserted '+count);
                db.close();
              }
            });
          });
      });
    });
  });
}); 
