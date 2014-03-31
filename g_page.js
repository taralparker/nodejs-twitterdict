var google = require('./lib/google');
var natural = require('natural');

var page = 'http://www.nytimes.com/2010/06/28/style/28bully.html?pagewanted=all&_r=0';

var dict = {};

google.text(page, function(text) {
  var tfidf = new natural.TfIdf();
  var count = 0;
  tfidf.addDocument(text);
  tfidf.listTerms(0).forEach(function(item) {
    if(!/^\d+$/.test(item.term)) {
      var str='k.'+item.term;
      if(!dict[str]) {
        dict[str] = 1;
        console.log(count+' '+item.term);
        count++;
      }
    }
  });
});

