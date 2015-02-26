// STATUS : Documentation in progress. Question: Should we refactor stuff like line 11?
// It doesn't feel right to have a function being called and created at the same time,
// it doesn't feel modular or clean.

var google = require('./lib/google');
var natural = require('natural');

var page = 'http://www.nytimes.com/2010/06/28/style/28bully.html?pagewanted=all&_r=0';

var dict = {};

// I think this is finding all of the terms in a page being pulled by google.text.
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

