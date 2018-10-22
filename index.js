'use strict';
const Alexa = require('ask-sdk-core');
const request = require('request-promise-native');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        console.log('LaunchRequestHandler')
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    async handle(handlerInput) {
        console.log('LaunchRequestHandler handle');
        const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
        const speechText = 'Welcome to Word Association! When you say a word, I\'ll respond with the first thing that comes to mind and then we\'ll go back and forth from there! Remember! Stop, cancel, exit, and help are special words, so only use them when you want to stop or when you need help.<break time="500ms"></break>You go first!! Start by saying "Let\'s start with BLANK" or "<phoneme alphabet="ipa" ph="əˈsoʊʃieɪt">associate</phoneme> BLANK".';
        return responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Welcome', "Welcome to Word Association!")
            .getResponse();
    }
};

const WordAssociationIntentHandler = {
    canHandle(handlerInput) {
        console.log('WordAssociationIntentHandler');
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'WordAssociationIntent'
            && handlerInput.requestEnvelope.request.dialogState !== 'COMPLETED';
    },
    async handle(handlerInput) {
        console.log('WordAssociationIntentHandler handle');
        const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
        const { intent } = requestEnvelope.request;
        let word = intent.slots.word.value;

        if (!word || word.length < 1)
            return ErrorHandler();
        if (word && (word.toLowerCase() == "cancel" || word.toLowerCase() == "stop"))
            return CancelAndStopIntentHandler.handle(handlerInput);
        if (word && (word.toLowerCase() == "exit"))
            return SessionEndedRequestHandler.handle(handlerInput);
        if (word && (word.toLowerCase() == "help"))
            return HelpIntentHandler.handle(handlerInput);
        if (word && (/repeat/ig.test(word)))
            return RepeatIntentHandler.handle(handlerInput);


        word = word.replace(/(let's start with|I'll start with|let's go with|how about|that reminds me of|associate)\s+/ig,"");

        // keep track of the words in session
        let words = [];
        let sessionAttributes = attributesManager.getSessionAttributes();
        if (sessionAttributes && sessionAttributes.words)
        {
            words = sessionAttributes.words;
        }
        words.push(word.toUpperCase());

        // start to formulate flourishes for responses
        const errorResponse = Constants.ERROR_RESPONSES[Math.round(Math.random() * (Constants.ERROR_RESPONSES.length-1))];
        const randomPrefix = Constants.PREFIXES[Math.round(Math.random() * (Constants.PREFIXES.length-1))];


        let wordResponse = null;
        let isError = false;
        console.log(word);
        const API_PARAMS = {
            resolveWithFullResponse: true,
            url: "https://api.wordassociations.net/associations/v1.0/json/search?apikey=&lang=en&type=response&indent=no&pos=noun,adjective,verb,adverb&text=" + encodeURIComponent(word),
            json: true
        };
          await request(API_PARAMS)
            .then(function(response) {
              if (response
                && response.statusCode == 200
                && response.body
                && response.body.response
                && response.body.response[0]
                && response.body.response[0].items
                && response.body.response[0].items[0])
                {
                    let items = response.body.response[0].items;
                    
                    let threshholdItems = [];
                    for (var i = 0; i < items.length; i++)
                    {
                        if (items[i] 
                            && items[i].weight 
                            && items[i].weight >= Constants.THRESHHOLD 
                            && items[i].item 
                            && words.indexOf(items[i].item.toUpperCase()) < 0)
                        {
                            threshholdItems.push(items[i]);
                        }
                    }

                    // get items length and randomly pick one
                    var random = Math.round(Math.random() * (threshholdItems.length-1));
                    
                    if (threshholdItems
                        && threshholdItems[0]
                        && threshholdItems[random]
                        && threshholdItems[random].item)
                     {
                        wordResponse = threshholdItems[random].item;
                        words.push(wordResponse.toUpperCase());
                    }   
                    else
                    {
                        wordResponse = errorResponse;
                        words.pop();
                        isError = true;
                    }
                }

              else {
                console.log('response: ', response.statusCode, response.body);
                wordResponse = errorResponse;
                words.pop();
                isError = true;
              }
            })
            .catch(function(err) {
                console.log('error: ', err);
                wordResponse = errorResponse;
                words.pop();
                isError = true;
            });

            sessionAttributes.words = words;
            attributesManager.setSessionAttributes(sessionAttributes);

            return responseBuilder
                .speak((isError ? "" : randomPrefix) + wordResponse)
                .withSimpleCard(wordResponse.toUpperCase(), (isError ? "" : randomPrefix) + wordResponse)
                .addElicitSlotDirective("word")
                .getResponse();
        
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        console.log('HelpIntentHandler')
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        console.log('HelpIntentHandler handle')
        const speechText = 'Sounds like you\'re asking for help... You can say any word and I\'ll attempt to respond to it with a word it reminds me of. Or you can say stop, cancel, or exit at any time. Start by saying "<phoneme alphabet="ipa" ph="əˈsoʊʃieɪt">associate</phoneme> BLANK".';

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Help', speechText)
            .getResponse();
    }
};

const RepeatIntentHandler = {
    canHandle(handlerInput) {
        console.log('RepeatIntentHandler')
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent';
    },
    handle(handlerInput) {
        console.log('RepeatIntentHandler handle')
        const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
        const { intent } = requestEnvelope.request;

        let speechText = "";
        let sessionAttributes = attributesManager.getSessionAttributes();
        if (sessionAttributes && sessionAttributes.words && sessionAttributes.words[0])
        {
            speechText = sessionAttributes.words[sessionAttributes.words.length-1];
        }

        return responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .withSimpleCard('Repeated', speechText)
            .addElicitSlotDirective("word")
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        console.log('CancelAndStopIntentHandler')
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        console.log('CancelAndStopIntentHandler handle')
        const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
        let extra = "See you next time!";
        let extraAdded = false;
        console.log(attributesManager.getSessionAttributes())
        if (attributesManager)
        {
            let sessionAttributes = attributesManager.getSessionAttributes();
            if (sessionAttributes && sessionAttributes.words && sessionAttributes.words[0])
            {
                extraAdded = true;
                extra = "We went from " + sessionAttributes.words[0] + " to " + sessionAttributes.words[sessionAttributes.words.length-1] + " in " + sessionAttributes.words.length + " total word" + (sessionAttributes.words.length == 1 ? "" : "s") + "! " + extra;
            }
        }
        let speechText = "Sounds like you want to stop" + (extraAdded ? "... but that was fun! " : ". ") + extra;
       
        return handlerInput.responseBuilder
            .speak(speechText)
            .withSimpleCard('Goodbye', speechText)
            .getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        console.log('FallbackIntentHandler')
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        console.log('FallbackIntentHandler handle')
        const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
        
        // const speechText = "We're already playing. Say any word and we'll continue."
        // return responseBuilder
        //     .speak(speechText)
        //     .withSimpleCard('Fallback', speechText)
        //     .getResponse();
        return LaunchRequestHandler.handle(handlerInput);
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        console.log('SessionEndedRequestHandler')
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log('SessionEndedRequestHandler handle')
        //any cleanup logic goes here
        const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
        let extra = "See you next time!";
        if (attributesManager)
        {
            let sessionAttributes = attributesManager.getSessionAttributes();
            if (sessionAttributes && sessionAttributes.words && sessionAttributes.words[0])
            {
                extra = "We went from " + sessionAttributes.words[0] + " to " + sessionAttributes.words[sessionAttributes.words.length-1] + " in " + sessionAttributes.words.length + " total word" + (sessionAttributes.words.length == 1 ? "" : "s") + "! " + extra;
            }
        }
        const speechText = "That was fun! " + extra;
        return handlerInput.responseBuilder
            .speak(speechText)
            .withSimpleCard('Goodbye', speechText);
    }
};

const ErrorHandler = {
    canHandle() {
        console.log('ErrorHandler')
      return true;
    },
    handle(handlerInput, error) {
        console.log('ErrorHandler handle')
      console.log(`Error handled: ${error.message}`);
    return handlerInput.responseBuilder
        .speak('Sorry, I can\'t understand the command. Please say again.')
        .reprompt('Sorry, I can\'t understand the command. Please say again.')
        .getResponse();
    },
};

const Constants = {
    ERROR_RESPONSES:[
        "Hmm. I'm having a hard time thinking of something for that one. Can you give me another word?",
        "Sorry, I got nothing... can we try a different word?",
        "Uh oh. Something went wrong. Please repeat that for me?"
    ],
    PREFIXES: [
        "",
        "",
        "",
        "",
        "",
        "That reminds me of... ",
        "That reminds me of... ",
        "How about... ",
        "How about... ",
        "Oooh, good one! Let's go with... "
    ],
    THRESHHOLD: 75
};


exports.handler = Alexa.SkillBuilders.custom()
     .addRequestHandlers(HelpIntentHandler,
                         CancelAndStopIntentHandler,
                         SessionEndedRequestHandler,
                         FallbackIntentHandler,
                         RepeatIntentHandler,
                         WordAssociationIntentHandler,
                         LaunchRequestHandler)
     .addErrorHandlers(ErrorHandler)
     .lambda();