var express = require('express');
var log4js = require('log4js');
var ObjectID = require('mongodb').ObjectID;
var MongoClient = require('mongodb').MongoClient;
var natural = require('natural');
var google = require('./lib/google');
var app = express();

var logger = log4js.getLogger();
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
      var search_text = null;
      var search_att = null;
      
      if(!doc.google_corpus) {
        // update corpus
        google.search(doc.corpus, function(err, page, next, links) {
          collection.update({}, {$set:{'google_corpus':page}}, {multi:true, upsert:true},function(err, result) {
            db.close();
            res.json({'update_corpus':result});
          });
          
        });
      } else {
        if(!doc.google || doc.google == 2) {
          search_text = '"'+doc.term+'"';
          logger.info('search '+search_text);
          search_att = 'google_term';
          doc['google']=1;
        } else {
          search_text = '"'+doc.term + '" "' +doc.corpus+'"';
          logger.info('search '+search_text);
          search_att = 'google_both';
          doc['google']=2;
        }
        
        google.search(search_text, function(err, page, next, links) {
          if(err) {
            doc[search_att] = null; 
          } else {
            if(page) {
              doc[search_att] = page; 
            } else {
              doc[search_att] = 0; 
            }
          }
          doc['support'] = doc.google_both/doc.google_corpus;
          if(doc.google_term==0) {
            doc['confidence'] = 0;
          } else {
            doc['confidence'] = doc.google_both/doc.google_term;
          }
          doc['updated'] = new Date();
          collection.update({'_id':id},doc,true, function(err, doc) {
            collection.findOne({'_id':id},function(err,doc) {
              db.close();
              res.json(doc);
            });
          });
        });
      }
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

app.get('/db/text/:collection', function(req, res) {
  get_content('text', function(result) {  
    var term_list = {};
    result.forEach(function(item) {
      if(item.bully) {
        var tfidf = new natural.TfIdf();
        tfidf.addDocument(item.text);
        tfidf.listTerms(0).forEach(function(term) {
          if(!/\d|_/.test(term.term)) {
            if(!term_list[term.term]) {
              term_list[term.term]=0;
            }
            term_list[term.term]++;
          }
        });
      }
    });
    var result_list = [];
    for(var key in term_list) {
      if(term_list.hasOwnProperty(key)) {
        result_list.push({'term':key,'freq':term_list[key]});
      }
    }
    result_list.sort(function(a, b) { return b.freq - a.freq; });
    res.json(result_list);
  }); 
  
});

app.get('/model/:collection/:support/:confidence', function(req, res) {
  var support = parseFloat(req.params.support);
  var confidence = parseFloat(req.params.confidence);
  var keyword_dict = {};
  var new_keyword = [];
  var keyword_list = [];
  var order_list = [];
  var hit_list = [];
  var total_bully = 0;
  var total_text = 0;
  var total_non_bully =0;
  get_content(req.params.collection, function(result) {  
    result.forEach(function(item) { 
      if(item.support > support && item.confidence > confidence) {
        if(item.confidence < 1.0) {
          keyword_list.push(item);
        }
      }
      keyword_dict[item.term]=1;
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
            if(!/\d|_/.test(t_term.term)) {
              if(!keyword_dict[t_term.term]) {
                keyword_dict[t_term.term] = 1;
                new_keyword.push(t_term.term);
                new_term.push(t_term.term);
              }
            }
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
        'new_term_length':new_keyword.length,
        'new_term':new_keyword,
        'hit_list':hit_list,
      });
    });
  });
});

app.get('/iterate/:collection/:keysize', function(req, res) {
  var keyword_dict = {};
  var new_keyword = [];
  var keyword_list = [];
  var order_list = [];
  var hit_list = [];
  var miss_list = [];
  var total_bully = 0;
  var total_text = 0;
  var total_non_bully =0;
  var keysize = parseInt(req.params.keysize);
  get_content(req.params.collection, function(result) {  
    var count = 0;
    result.sort(function(a,b) { 
      if(a.confidence && b.confidence) {
        return b.confidence - a.confidence;
      } else {
        return -1;
      }
    });
    result.forEach(function(item) { 
      if(count<keysize && item.confidence <= 1.0&& item.support <= 1.0) {
       // console.log(item.term + ' '+item.confidence);
        keyword_list.push(item);
        count++;
      }
      keyword_dict[item.term]=1;
    });
    keyword_list.sort(function(a,b) {return b.confidence-a.confidence;});
    get_content('text', function(result) {  
      total_text=result.length;
      result.forEach(function(item) {
        var ch_text = item.text.replace(/\W/ig,' ');
        ch_text = ' '+ch_text+' ';
        if(item.bully) total_bully++;
        var conf=0.0;
        var tmp = {'text':item.text,'bully':item.bully,'confidence':0};
        tmp['ch_text']=ch_text;
        keyword_list.forEach(function(keyword) {
          var regex = new RegExp("\\s+"+keyword.term+"\\s+",'gi');
          if(ch_text.match(regex)) {
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
            if(!/\d|_/.test(t_term.term)) {
              if(!keyword_dict[t_term.term]) {
                keyword_dict[t_term.term] = 1;
                new_keyword.push(t_term.term);
                new_term.push(t_term.term);
              }
            }
          });
          tmp['twitter_term']=new_term;
        }
       
        order_list.push(tmp);
        if(tmp.keyword && tmp.bully) {
          hit_list.push(tmp);
        } else {
          if(tmp.bully) {
            miss_list.push(tmp);
          }
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
      
      // update new keyword
      if(new_keyword.length > 0) {
        MongoClient.connect('mongodb://127.0.0.1:27017/'+db_name,function(err,db) {
          var collection = db.collection(req.params.collection);
          var inserted_count =0;
          new_keyword.forEach(function(item) {
            var doc = {};
            doc['term']=item;
            doc['corpus']=keyword_list[0].corpus;
            collection.insert(doc,{w:1}, function(err, obj) {
              inserted_count++;
              if(inserted_count == new_keyword.length) {
                db.close();
                res.json({
                  'keyword_length':keyword_list.length,
                  'accuracy':{
                    'value':(acc.TP+acc.TN)/(acc.TP+acc.TN+acc.FN+acc.FP),
                    'detail':acc
                  },
                  'auc':auc,
                  //'roc':roc,
                  'new_term_length':new_keyword.length,
                  'new_term':new_keyword,
                  'hit_list':hit_list,
                  'miss_list':miss_list,
                });
              }
            });
          });
        });
      } else {
        res.json({
          'keyword_length':keyword_list.length,
          'accuracy':{
             'value':(acc.TP+acc.TN)/(acc.TP+acc.TN+acc.FN+acc.FP),
             'detail':acc
          },
          'auc':auc,
          //'roc':roc,
          'new_term_length':new_keyword.length,
          'new_term':new_keyword,
          // 'keyword':keyword_list,
          'hit_list':hit_list,
          'miss_list':miss_list,
        });
      }
    });
  });
});

app.get('/key/:collection', function(req, res) {
  var keyword_list = [];
  var order_list = [];
  var waiting_term = 0;
  get_content(req.params.collection, function(result) {  
    
    result.forEach(function(item) { 
      if(item.confidence <= 1.0 && item.support <=1.0) {
        item['hit']=0;
        item['miss']=0;
        keyword_list.push(item);
      }
      if(!item.confidence) {
        waiting_term++;
      }
    });

    keyword_list.sort(function(a,b) {return b.confidence-a.confidence;});
    get_content('text', function(result) {  
      result.forEach(function(item) {
        var ch_text = item.text.replace(/\W/ig,' ');
        ch_text = ' '+ch_text+' ';
        for(var i=0;i<keyword_list.length;i++) {
          var keyword = keyword_list[i];
          var regex = new RegExp("\\s+"+keyword.term+"\\s+",'gi');
          if(ch_text.match(regex)) {
            if(item.bully) {
              keyword.hit++;
            } else {
              keyword.miss++;
            }
            break;
          }
        }
      });
      var f_list = [];
      keyword_list.forEach(function(item) {
        if(item.hit+item.miss > 0) {
          f_list.push({
            '_id':item._id,
            'term':item.term, 
            'hit':item.hit, 
            'miss':item.miss, 
            'confidence':item.confidence,
            'support':item.support,
            'updated':item.updated
          });
        }
      });
      res.json({
        'keyword_length':keyword_list.length,
        'waiting':waiting_term,
        'keyword':f_list,
      });
    });
  });
});


app.listen(8080);
