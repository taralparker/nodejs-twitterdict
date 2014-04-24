var natural = require('natural');

var tfidf = new natural.TfIdf();
tfidf.addDocument("this document is about dog.");
tfidf.listTerms(0).forEach(function(item) {
  console.log(item);
});
