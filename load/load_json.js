var fs = require('fs');

fs.readFile(process.argv[2],'utf8', function(err,data) {
  if(err) throw err;
  
  var json_obj = JSON.parse('['+data+']');
  console.log(json_obj[1]);
});
