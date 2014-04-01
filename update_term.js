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
      col_obj.sort(function(a, b) { 
        if(a.updated && b.updated) {
          return a.updated-b.updated; 
        } else {
          if(a.updated) {
            return 1;
          }  
        }
      });
      http.get("http://129.118.162.97:8080/google/"+col_name+"/"+
        col_obj[0]._id,function(res) {
        var body = '';
        res.on('data', function(d) {
          body+=d;
        });
        res.on('end', function() {
          logger.info(body);
          setTimeout(function() {
            callRequest();
          },90000);
        });
      });
     
      
    });
    
  });
}


callRequest();
