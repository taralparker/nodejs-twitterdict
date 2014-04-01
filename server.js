var express = require('express');
var ObjectID = require('mongodb').ObjectID;
var MongoClient = require('mongodb').MongoClient;
var natural = require('natural');
var google = require('./lib/google');
var app = express();

var db_name = 'bully_dict';

var get_content = function(col_name,cb) {
  MongoClient.connect('mongodb://127.0.0.1:27017/'+db_name,function(err,db) {
    if(err) {
      db.close();
      cb([]);
    } else {
      var collection = db.collection(col_name);
      collection.find().toArray(function(err, results) { 
        if(err) {
          db.close();
          cb([]);
        } else {
          db.close();
          cb(results);
        }
      });
    }
  });
};



app.get('/',function(req,res) {
  var cmd_list = [
    {'view collection':'/db/list/:collection'},
    {'remove document':'/db/remove/:collection/:id'},
    {'remove collection':'/db/remove/:collection'},
    {'evaluate model':'/model/:collection/:support/:confidence'},
    {'add term':'/db/add/:collection?term=:term&corpus=:corpus'},
    {'google term':'/google/:collection/:id'}
  ] 
  res.json(cmd_list);
});

app.get('/db/add/:collection',function(req,res) {
  MongoClient.connect('mongodb://127.0.0.1:27017/'+db_name,function(err,db) {
    var collection = db.collection(req.params.collection);
    var content=req.query;
    var floatParams = ['support','confidence'];
    floatParams.forEach(function(name) {
      if(content[name]) {
        content[name] = parseFloat(content[name]);
      }
    });
    collection.insert(content,function(err, result) {
      db.close();  
      res.json(result);
    });
  });
});

app.get('/google/:collection/:id', function(req, res) {
  MongoClient.connect('mongodb://127.0.0.1:27017/'+db_name,function(err,db) {
    var collection = db.collection(req.params.collection);
    var id = new ObjectID.createFromHexString(req.params.id);
    collection.findOne({'_id':id},function(err,doc) {
      // google term
      delete doc._id;
      google.search(doc.term, function(err, page, next, links) {
       //  console.log('search '+doc.term+' '+page);
        doc['google_term'] = page; 
        google.search(doc.corpus, function(err, page, next, links) {
        //  console.log('search '+doc.corpus+' '+page);
          doc['google_corpus'] = page;
          google.search(doc.corpus+' '+doc.term, function(err, page, next, links) {
            doc['google_both'] = page;
            doc['support'] = doc.google_both/doc.google_corpus;
            doc['confidence'] = doc.google_both/doc.google_term;
            if(page) {
            doc['updated'] = new Date();
            collection.update({'_id':id},doc,true, function(err, doc) {
              collection.findOne({'_id':id},function(err,doc) {
                db.close();
                res.json(doc);
              });
            });
            } else {
              res.json(doc);
              db.close();
            }
          });
        });
      });
    });
  });
});

app.get('/db/remove/:collection/:id?', function(req, res) {
  MongoClient.connect('mongodb://127.0.0.1:27017/'+db_name,function(err,db) {
    var collection = db.collection(req.params.collection);
    if(req.params.id) {
      var id = new ObjectID.createFromHexString(req.params.id);
      collection.remove({'_id':id},{w:1},function(err,result) {
        db.close();
        res.json({'remove':result});
      });
    } else {
      collection.remove({},{w:1},function(err,result) {
        db.close();
        res.json({'remove':result});
      });
    }
  });
});

app.get('/db/list/:collection', function(req, res) {
  get_content(req.params.collection, function(results) {
    res.json(results);
  });
});

app.get('/model/:collection/:support/:confidence', function(req, res) {
  var support = parseFloat(req.params.support);
  var confidence = parseFloat(req.params.confidence);
  var keyword_list = [];
  var order_list = [];
  var hit_list = [];
  var total_bully = 0;
  var total_text = 0;
  var total_non_bully =0;
  get_content(req.params.collection, function(result) {  
    result.forEach(function(item) { 
      if(item.support > support && item.confidence > confidence) {
        keyword_list.push(item);
      }
    });
    get_content('text', function(result) {  
      total_text=result.length;
      result.forEach(function(item) {
        if(item.bully) total_bully++;
        var conf=0.0;
        var tmp = {'text':item.text,'bully':item.bully,'confidence':0};
        keyword_list.forEach(function(keyword) {
          var regex = new RegExp("\\s+"+keyword.term+"\\s+",'gi');
          if(item.text.match(regex)) {
            if(conf<keyword.confidence) {
             // console.log('['+keyword.term+'] '+item.text);
              conf=keyword.confidence;
              tmp['keyword']=keyword.term;
              tmp['confidence']=keyword.confidence;
            }
          }
        });
        // gather new word
        if(tmp['confidence'] > 0) { 
          var tfidf = new natural.TfIdf();
          tfidf.addDocument(item.text);
          var new_term = [];
          tfidf.listTerms(0).forEach(function(t_term) {
            new_term.push(t_term.term);
          });
          tmp['twitter_term']=new_term;
        }
       
        order_list.push(tmp);
        if(tmp.keyword) {
          hit_list.push(tmp);
        }
      });
      var acc= {'TP':0,'FP':0,'FN':0,'TN':0};
      hit_list.sort(function(a,b) { return b.confidence-a.confidence; });
      order_list.sort(function(a,b) { return b.confidence-a.confidence; });
      var total_non_bully = total_text - total_bully;
      var c_x=0;
      var c_y=0;
      var p_count = 0;
      var n_count = 0;
      var c_conf = -1;
      var auc=0.0;
      var roc=[];
      order_list.forEach(function(item,idx) {
        if(item.confidence != c_conf) {
          var n_x = c_x + n_count/(total_non_bully);
          var n_y = c_y + p_count/(total_bully);
          roc.push({'x':n_x,'y':n_y});
          auc += (n_x-c_x)*(c_y)+0.5*(n_x-c_x)*(n_y-c_y);
          c_x = n_x;
          c_y = n_y;
          p_count=0;
          n_count=0;
          c_conf=item.confidence;
        } else {
          if(idx==order_list.length-1) {
            auc += (1-c_x)*(c_y)+0.5*(1-c_x)*(1-c_y);
            roc.push({'x':1,'y':1});
          }
        }

        if(item.bully) {
          p_count++;
        } else {
          n_count++;
        }

        if(item.bully && item.keyword) {
          acc['TP']++;
        }
        if(!item.bully && item.keyword) {
          acc['FP']++;
        }
        if(item.bully && !item.keyword) {
          acc['FN']++;
        }
        if(!item.bully && !item.keyword) {
          acc['TN']++;
        }
      });
      
      res.json({
        'keyword_length':keyword_list.length,
        'accuracy':{
           'value':(acc.TP+acc.TN)/(acc.TP+acc.TN+acc.FN+acc.FP),
           'detail':acc
        },
        'auc':auc,
        'roc':roc,
        'hit_list':hit_list
      });
    });
  });
});

app.listen(8080);
