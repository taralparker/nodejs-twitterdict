var google = require('./lib/google');


google.search('cyberbully macaroni', function(err, page, next, links) {
  console.log(page);
});
