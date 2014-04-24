var http = require('http');
var log4js = require('log4js');
var logger = log4js.getLogger();

function callRequest() {
  var col_name = process.argv[2];
  http.get("http://129.118.162.97:8080/db/list/"+col_name,function(res) {
    var body = '';
    res.on('data', function(d) {
      body+=d;
    });
    res.on('end', function() {
      var col_obj = JSON.parse(body);
      var target_doc = null;
      col_obj.forEach(function(doc) {
        if(!doc.confidence && !target_doc) {
          if(doc.confidence==null && doc.updated) {
            target_doc=doc;
          }
        }
      });
      if(!target_doc) {
        col_obj.sort(function(a, b) { 
          if(a.updated && b.updated) {
            var a_day = new Date(a.updated);
            var b_day = new Date(b.updated);
            return a_day.getTime() -b_day.getTime(); 
          } else {
            if(!a.updated && b.updated) {
              return -1;
            }  
            if(a.updated && !b.updated) {
              return 1;
            }
            if(a.updated && b.updated) {
              return 0;
            }
          }
        });
      }
      if(!target_doc) {
        target_doc=col_obj[0];
      }
      // logger.info(target_doc);
      // logger.info(col_obj);
      http.get("http://129.118.162.97:8080/google/"+col_name+"/"+
        target_doc._id,function(res) {
        var body = '';
        res.on('data', function(d) {
          body+=d;
        });
        res.on('end', function() {
          logger.info(body);
          setTimeout(function() {
            callRequest();
          },30000);
        });
      });
     
      
    });
    
  });
}


callRequest();
