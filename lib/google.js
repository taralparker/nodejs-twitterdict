// STATUS: Documentation in progress

// Including various functions
var request = require('request') // HTTP request module
  , cheerio = require('cheerio') // Core jQuery for server usage.
  , fs = require('fs') // fs = file system (?)
  , querystring = require('querystring') // Utils for query strings
  , util = require('util'); // Internal NodeJS utils

// Setting initial variables
var linkSel = 'h3.r a'
  , descSel = 'div.s'
  , resultStats = '#resultStats'
  , itemSel = 'li.g'
  , nextSel = 'td.b a span';

// Is this the initial google search?
var URL = 'http://www.google.com/search?hl=en&q=%s&start=%s&sa=N&num=%s&ie=UTF-8&oe=UTF-8';

/* ### BODY ### */

// The following functions implement custom search, and text manipulation 
// allowing the retrieval of the top 10 results from an individual search.

function google() {}

// search : String x function
// This function makes a call to start the Google search query. It isn't clear what the
// callback does however. See g_count for example usage.
google.search = function(query, callback) {
  igoogle(query, 0, callback);
};

// text : URL x function
// This function makes a HTTP request and does something (not sure what, yet).
// Callback?
google.text = function(url, callback) {
  request(url, function(err, resp, body) {
    if ((err == null) && resp.statusCode === 200) {
      // console.log(body);
      var $ = cheerio.load(body, {
        normalizeWhitespace:true,
      });
      $('script').remove();

      callback($('body').text());
    }
  });
};


google.resultsPerPage = 10;

/* ### Why is this here? ### */

/*
function google(query, callback) {
  igoogle(query, 0, callback);
}
*/

// igoogle : String x Z x function
// Makes a new call to get search results based on start (limited number of results).
// Includes a variety of information with each item (title, link, description, href).
var igoogle = function(query, start, callback) {
  if (google.resultsPerPage > 100) google.resultsPerPage = 100; //Google won't allow greater than 100 anyway

  var newUrl = util.format(URL, querystring.escape(query), start, google.resultsPerPage);
  request(newUrl, function(err, resp, body) {
    if ((err == null) && resp.statusCode === 200) {
      var $ = cheerio.load(body)
        , links = []
        , text = [];
      
      var pages = parseInt($(resultStats).text().replace(/\D/g,''));

      $(itemSel).each(function(i, elem) {
        var linkElem = $(elem).find(linkSel)
          , descElem = $(elem).find(descSel)
          , item = {title: $(linkElem).text(), link: null, description: null, href: null}
          , qsObj = querystring.parse($(linkElem).attr('href'));
        
        if (qsObj['/url?q']) {
          item.link = qsObj['/url?q']
          item.href = item.link
        }
        
        $(descElem).find('div').remove();
        item.description = $(descElem).text();
        
        links.push(item);
      });

      var nextFunc = null;
      if ($(nextSel).last().text() === 'Next'){
        nextFunc = function() {
          igoogle(query, start + google.resultsPerPage, callback);
        }
      }
      
      callback(null, pages, nextFunc, links);
    } else {
      console.log('error '+resp.statusCode);
      console.log('error '+err);
      console.log('error '+body);
      callback(new Error('Error on response (' + resp.statusCode + '):' + err +" : " + body), null, null, null);
    }
  });
}

module.exports = google;
