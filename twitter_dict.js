var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var config = require('./db_config');

var Twit = require('twit');
var twitter_config = require('./twitter_config');
var twitter = new Twit(twitter_config);

var stream = twitter.stream('statuses/sample');

var db = new Db(config.db, new Server(
   config.host,
   config.port,
   config.server_config),{safe:false});

var word_dict = {};

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
          results.sort(function(a,b) { return b.value - a.value; });
          var count=1;
          results.forEach(function(doc,idx) {
            if(doc.value < 1 && count<100 ) {
              console.log(count+' '+JSON.stringify(doc));
              if(!word_dict[doc._id]) {
                word_dict[doc._id] = doc;
                count++;
              }
            }
          });
          db.close();
          var new_rule_dict = {};
          stream.on('tweet', function(tweet) {
            if(tweet.lang=='en') {
              var count_word = 0;
              var key_list = [];
              for(key in word_dict) {
                if(tweet.text.indexOf(key)!=-1) {
                  key_list.push(key);
                  count_word++;
                }
              }
              if(count_word>1) {
                key_list.sort();
                var new_rule = '';
                key_list.forEach(function(item) {
                  new_rule+=item+' ';
                });

                if(!new_rule_dict[new_rule]) {
                  new_rule_dict[new_rule]=1;
                  console.log('->'+count_word+' ('+new_rule+') :'+tweet.text);
                }
              }
            }
          });
        });
      });
    } else {
      throw new Error('Error on DB authentication');
    }
  });
}); 
