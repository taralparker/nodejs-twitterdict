var fs = require('fs');
var S  = require('string');

fs.readFile('terms', 'utf8', function (err, data){
	if(err){
		console.log(err);
	}
	var terms = S(data).lines();
	getTweets(terms);
});

function getTweets(terms){
	fs.readFile('dataset24hr_2.txt' , 'utf8', function (err, data){
		if(err){
			console.log('err');
		} 

		//tweets = S(data).lines();
		getCoreferences(S(data).lines(), terms);
	
	});
}

function getCoreferences(tweets, terms){
	//var tweets;
	var i = 0;
	var k = 0;	
	var j = 0;
	var coreferences = '';
	var temp = '';
	var tempOpp = '';
	var tweet_count = 0;	
	var tweet = '';
	var term  = '';
	while(i < tweets.length){
		tweet = ' ' + tweets[i] + ' ';
		if((tweets[i] != '-----NEXTTWEET-----') && ( tweets[i] != '\n')){
			while(k < terms.length){
				term = ' ' + terms[k] + ' ';
				if((tweet.indexOf(term) != -1) && (j < 2) && (!S(terms[k]).isEmpty())){
					j++;
					if(j == 2){
						tempOpp = terms[k] + ' ' +  temp;
					}
					temp += (terms[k] + ' ');		
				}
				k++;
			}
			if( (j >= 2) && (coreferences.indexOf(temp) == -1) && (coreferences.indexOf(tempOpp) == -1) ){
				coreferences += (temp + '\n'); 
				console.log(temp);
			}
			k = 0;
			j = 0;
			temp = '';
		}
		if(tweets[i] == '-----NEXTTWEET-----'){
			tweet_count++;
		}

		i++;	
	}
	console.log(coreferences);
	console.log('Tweet count: ' + tweet_count);
}




